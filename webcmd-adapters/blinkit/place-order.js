// User-local override of blinkit/place-order — shadows the packaged 0.4.3 adapter.
//
// WHY THIS EXISTS
// The packaged adapter matches only /^place order$/i, /^pay( now)?$/i and /^cash on delivery$/i,
// all anchored. Blinkit's cart panel ends at a compound green bar reading "₹184 TOTAL Proceed To
// Pay ›", so nothing ever matches and the command returns status "blocked" while reporting exit 0.
// Upstream does that ON PURPOSE — its own test asserts the script must NOT contain "Proceed", i.e.
// packaged place-order will only ever click a genuinely-final button on an already-advanced
// checkout screen. That is a sound default; it is just one screen earlier than this project needs.
//
// This override walks the funnel instead, and keeps the honesty properties that matter:
//   - ADVANCE steps (Proceed To Pay / Continue / selecting Cash on Delivery) move money nowhere.
//   - COMMIT steps (Place Order / Pay Now / Pay ₹N) are the only ones that can charge, are only
//     ever reached with --confirm, and are clicked at most once per run.
//   - Reaching a human-only rail (UPI PIN, OTP, 3DS) returns status "action_required" rather than
//     pretending success — the exact failure mode Mandate Gate's ADR-013 exists to catch.
//   - A commit click that yields no order id returns "submitted_unconfirmed", never "placed", so
//     gate.ts fails closed (no ledger draw, no signed receipt) while still warning the operator
//     that an order MAY exist and must be checked before retrying.
//
// Restore the packaged behaviour with `webcmd adapter reset blinkit`, or by deleting this file
// (place-order.upstream-0.4.3.bak in this directory is the verbatim packaged original).
import { ArgumentError, CommandExecutionError } from '@agentrhq/webcmd/errors';
import { cli, Strategy } from '@agentrhq/webcmd/registry';
import { DOMAIN, ensureCartHasItems, ensureLoggedIn, openCartPanel, readCartState, summarizeCartResponse } from './utils.js';

/** Checkout funnels are shallow; this only bounds a pathological click loop. */
const MAX_CHECKOUT_STEPS = 6;
/** Blinkit writes the order id asynchronously after the commit click — poll rather than sleep once. */
const ORDER_PROBE_ATTEMPTS = 12;
const ORDER_PROBE_INTERVAL_SECONDS = 2;
/** "Select Payment Method" renders its options via PayU/Juspay lookups that outlast a fixed sleep.
 * The first version of this adapter scanned 2s after the click, saw a spinner, and reported an
 * empty screen — poll for the screen to actually change instead. */
const SETTLE_ATTEMPTS = 16;
const SETTLE_INTERVAL_SECONDS = 1.5;

/** Walks one checkout step: scan, classify, click, report. Returns a serialisable descriptor.
 * `mode` is 'observe' (never click — used while waiting for a screen to settle),
 * 'advance-only' (never click a commit control) or 'full'. */
function buildStepEvaluate(mode) {
  return `
    (() => {
      const MODE = ${JSON.stringify(mode)};
      // Ordered longest-first so "proceed to pay" beats "pay now" on a compound label.
      const ADVANCE = ['proceed to checkout', 'continue to payment', 'proceed to pay', 'pay on delivery', 'cash on delivery', 'proceed', 'continue'];
      const COMMIT = ['confirm and pay', 'complete payment', 'confirm & pay', 'complete order', 'confirm order', 'place order', 'pay now'];
      const BLOCKED = ['enter upi pin', 'enter your upi pin', 'verify otp', 'enter otp', 'resend otp', 'scan the qr', 'scan qr', 'add new address', 'add a new address', '3d secure', 'authenticate'];
      // Reported, never auto-clicked — this is how --advance-only answers "is COD offered here?".
      const PAYMENT_OPTIONS = ['cash on delivery', 'pay on delivery', 'upi', 'credit card', 'debit card', 'add new card', 'net banking', 'netbanking', 'wallet', 'paytm', 'phonepe', 'google pay', 'amazon pay', 'simpl', 'lazypay', 'gift card', 'blinkit cash', 'grofers cash'];

      // Blinkit's site-wide footer carries links like "E-Gift Cards" that trivially match the
      // payment vocabulary. Only trust payment-method detection once we are actually on the
      // checkout route, otherwise home-page chrome reads as a rendered payment list.
      const ON_CHECKOUT = /checkout|payment/i.test(location.pathname);

      const norm = (node) => String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
      const visible = (node) => {
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const style = window.getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return Number(style.opacity) !== 0;
      };
      // Blinkit greys out "Pay Now" until a payment method is chosen. Clicking a disabled control
      // is a silent no-op, so it must never be mistaken for a committed purchase.
      const disabled = (node) => {
        let current = node;
        for (let depth = 0; current && depth < 4; depth += 1) {
          if (current.disabled === true) return true;
          if (current.getAttribute && (current.getAttribute('aria-disabled') === 'true' || current.hasAttribute('disabled'))) return true;
          const style = window.getComputedStyle(current);
          if (style && (style.pointerEvents === 'none' || Number(style.opacity) < 0.5)) return true;
          current = current.parentElement;
        }
        return false;
      };

      const classify = (lower) => {
        let kind = '';
        let phrase = '';
        for (const p of COMMIT) if (lower.includes(p) && p.length > phrase.length) { kind = 'commit'; phrase = p; }
        // ADVANCE wins ties by length, which is what keeps "₹184 TOTAL Proceed To Pay" out of COMMIT.
        for (const p of ADVANCE) if (lower.includes(p) && p.length > phrase.length) { kind = 'advance'; phrase = p; }
        // "Pay ₹184" style final buttons carry no keyword phrase — but never treat a
        // "…Proceed To Pay ₹184" bar as a commit control.
        if (!kind && /^pay\\b/.test(lower) && /\\d/.test(lower) && !lower.includes('proceed')) { kind = 'commit'; phrase = 'pay <amount>'; }
        return { kind, phrase };
      };

      const candidates = [];
      const blockedHints = [];
      const paymentNodes = [];
      const nodes = document.querySelectorAll('button, [role="button"], a, div, span, li');
      for (const node of nodes) {
        // Cheap prefilter first — innerText and getBoundingClientRect both force layout.
        const rough = String(node.textContent || '');
        if (!rough || rough.length > 200) continue;
        const roughLower = rough.toLowerCase();
        const mayMatch = ADVANCE.some((p) => roughLower.includes(p))
          || COMMIT.some((p) => roughLower.includes(p))
          || BLOCKED.some((p) => roughLower.includes(p))
          || PAYMENT_OPTIONS.some((p) => roughLower.includes(p))
          || /pay\\s*₹?\\s*\\d/.test(roughLower);
        if (!mayMatch) continue;

        const text = norm(node);
        if (!text || text.length > 80) continue;
        const lower = text.toLowerCase();
        if (BLOCKED.some((p) => lower.includes(p))) blockedHints.push(text);
        if (!visible(node)) continue;
        if (ON_CHECKOUT && PAYMENT_OPTIONS.some((p) => lower.includes(p))) paymentNodes.push({ node, text });
        const { kind, phrase } = classify(lower);
        if (!kind) continue;
        candidates.push({ node, text, kind, phrase, disabled: disabled(node) });
      }

      // Keep only the most specific node for each control — Blinkit nests the clickable label
      // several divs deep inside a wrapper that carries the same text.
      const deepest = candidates.filter((c) => !candidates.some((o) => o !== c && c.node.contains(o.node)));
      const commits = deepest.filter((c) => c.kind === 'commit' && !c.disabled);
      const advances = deepest.filter((c) => c.kind === 'advance' && !c.disabled);
      const disabledCommits = deepest.filter((c) => c.kind === 'commit' && c.disabled);
      // Same deepest-wins rule: without it a wrapper div reports the entire payment section as
      // one "method" whose label is every option concatenated together.
      const deepestPayments = paymentNodes.filter((c) => !paymentNodes.some((o) => o !== c && c.node.contains(o.node)));

      // Deduplicate by label — the same control often matches at several nesting depths.
      const describe = (list) => Array.from(new Set(list.map((c) => c.text)));
      const result = {
        clicked: null,
        text: '',
        phrase: '',
        commitCandidates: describe(commits),
        advanceCandidates: describe(advances),
        disabledCommits: describe(disabledCommits),
        paymentOptions: Array.from(new Set(deepestPayments.map((c) => c.text))),
        blockedHints: Array.from(new Set(blockedHints)),
        url: location.href,
      };

      if (MODE === 'observe') return result;
      const target = (MODE === 'full' && commits.length) ? commits[0] : (advances.length ? advances[0] : null);
      if (!target) return result;
      if (target.kind === 'commit' && MODE !== 'full') return result;

      target.node.click();
      result.clicked = target.kind;
      result.text = target.text;
      result.phrase = target.phrase;
      return result;
    })()
  `;
}

/** Reads a real merchant order id after a commit click. Redux first, then the URL, then visible
 * text — a receipt should never rest on a body-text regex when structured state is available. */
function buildOrderProbeEvaluate() {
  return `
    (() => {
      const state = window.__reduxStore__?.getState?.();
      const pick = (...values) => values
        .map((value) => String(value ?? '').trim())
        .find((value) => value && value !== 'undefined' && value !== 'null') || '';

      const fromStore = pick(
        state?.data?.order?.orderId, state?.data?.order?.order_id,
        state?.ui?.order?.orderId, state?.ui?.order?.order_id,
        state?.ui?.checkout?.order?.order_id, state?.ui?.checkout?.orderId,
        state?.data?.checkout?.orderId, state?.data?.checkout?.order_id
      );

      const url = location.href;
      const fromUrl = url.match(/(?:order[_-]?id=|\\/order(?:s)?\\/|\\/order-summary\\/)([A-Za-z0-9-]{5,})/i);
      const body = document.body.innerText || '';
      const fromText = body.match(/order\\s*(?:id|no\\.?|number)\\s*[:#-]?\\s*([A-Z0-9][A-Za-z0-9-]{4,})/i);

      return {
        orderId: fromStore || (fromUrl ? fromUrl[1] : '') || (fromText ? fromText[1] : ''),
        source: fromStore ? 'redux' : fromUrl ? 'url' : fromText ? 'text' : '',
        failed: /payment failed|transaction failed|could not be placed|order failed|payment declined/i.test(body),
        placed: /order placed|order confirmed|thank you for your order/i.test(body),
        url,
      };
    })()
  `;
}

/** Blinkit renders its payment methods through Zomato's zpaykit, inside a CROSS-ORIGIN IFRAME
 * (www.zomato.com/zpaykit/init). A top-level document.querySelectorAll cannot see or click any of
 * it — the first version of this adapter concluded "no payment methods rendered" while the real
 * screen showed Wallets / Cards / Netbanking / UPI / Cash / Pay Later. Everything below reaches
 * into that frame via page.frames() + page.evaluateInFrame(). */
const FRAME_HINT = /zpaykit|zomato/i;
/** zpaykit groups methods under collapsed accordions. The cash option RENDERS as just "Cash"
 * (with a "Please keep exact change handy…" note) — the name "Cash on Delivery" appears only in
 * zpaykit's getPaymentMethods API payload, never in the DOM. Opening that section IS the
 * selection: it is what flips the parent page's "Pay Now" from grey to green. */
const COD_OPTION_PHRASES = ['cash on delivery', 'pay on delivery', 'cash'];

/** Scans (and optionally clicks) inside the zpaykit frame. `mode` is 'observe' or 'click'. */
function buildFrameEvaluate(phrases, mode) {
  return `
    (() => {
      const PHRASES = ${JSON.stringify(phrases)};
      const CLICK = ${JSON.stringify(mode)} === 'click';
      const norm = (node) => String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
      const visible = (node) => {
        const rect = node.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const style = window.getComputedStyle(node);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return Number(style.opacity) !== 0;
      };

      const labels = [];
      const matches = [];
      for (const node of document.querySelectorAll('button, [role="button"], a, div, span, li, label')) {
        const rough = String(node.textContent || '');
        if (!rough || rough.length > 200) continue;
        const text = norm(node);
        if (!text || text.length > 80) continue;
        if (!visible(node)) continue;
        labels.push(text);
        if (PHRASES.some((p) => text.toLowerCase().includes(p))) matches.push({ node, text });
      }
      const deepest = matches.filter((c) => !matches.some((o) => o !== c && c.node.contains(o.node)));
      const result = {
        found: deepest.map((c) => c.text),
        clicked: '',
        // Drop wrapper labels that are just their children concatenated ("Wallets UPI Cash …"),
        // otherwise the reported method list reads as one giant run-on option.
        labels: (() => {
          const unique = Array.from(new Set(labels));
          return unique.filter((a) => !unique.some((b) => b !== a && a.includes(b))).slice(0, 40);
        })(),
        url: location.href,
      };
      if (CLICK && deepest.length) {
        deepest[0].node.click();
        result.clicked = deepest[0].text;
      }
      return result;
    })()
  `;
}

/** Identity of a rendered screen, used to tell "the next step loaded" from "still the old one". */
function signatureOf(observation) {
  if (!observation) return '';
  return [
    observation.url || '',
    ...(observation.commitCandidates || []),
    ...(observation.advanceCandidates || []),
    ...(observation.paymentOptions || []),
  ].join('|');
}

cli({
  site: 'blinkit',
  name: 'place-order',
  access: 'write',
  description: 'Advance the Blinkit checkout and submit the final order/payment action. Requires --confirm.',
  domain: DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  navigateBefore: false,
  args: [
    { name: 'confirm', type: 'bool', default: false, help: 'Required acknowledgement that this may place/pay for a real order' },
    { name: 'advance-only', type: 'bool', default: false, help: 'Walk the checkout up to the payment step and report it, without ever clicking a paying button' },
  ],
  columns: ['status', 'confirmed', 'itemCount', 'payable', 'orderId', 'url', 'message'],
  func: async (page, kwargs) => {
    // kebab-case flags arrive camelCased; accept both so the arg name can't silently no-op.
    const advanceOnly = kwargs.advanceOnly === true || kwargs['advance-only'] === true;
    if (!kwargs.confirm && !advanceOnly) {
      return [{
        status: 'no-op',
        confirmed: false,
        message: 'Pass --confirm to submit a real Blinkit order/payment action, or --advance-only to inspect the payment step without paying.',
      }];
    }
    if (kwargs.confirm !== undefined && kwargs.confirm !== false && kwargs.confirm !== true) {
      throw new ArgumentError('--confirm must be a boolean flag');
    }

    await openCartPanel(page);
    const state = await readCartState(page);
    ensureLoggedIn(state, 'blinkit place-order');
    const summary = summarizeCartResponse(state);
    ensureCartHasItems(summary);
    if (summary.checkoutBlocked) throw new CommandExecutionError('Blinkit checkout is blocked for this cart');

    const mode = advanceOnly ? 'advance-only' : 'full';
    const trail = [];
    const seenClicks = new Set();
    let committed = false;
    let last = null;
    let codSelected = false;
    let frameReport = null;
    let frameNote = '';

    /** Picks Cash on Delivery inside the zpaykit iframe. Selecting a payment method charges
     * nothing — only the parent page's "Pay Now" commits, and that stays behind --confirm. */
    const selectCashOnDelivery = async () => {
      const frames = await page.frames().catch(() => []);
      const list = Array.isArray(frames) ? frames : [];
      // frames() shape is not contractually documented, so match on its stringified form rather
      // than assuming a `.url` property.
      const index = list.findIndex((f) => FRAME_HINT.test(typeof f === 'string' ? f : JSON.stringify(f ?? '')));
      if (index < 0) return { ok: false, reason: 'zpaykit payment frame not found' };

      const inFrame = (phrases, frameMode) =>
        page.evaluateInFrame(buildFrameEvaluate(phrases, frameMode), index).catch(() => null);

      /** The only trustworthy proof a payment method got selected: the parent page's paying
       * control stopped being disabled. Far more robust than matching a row's label. */
      const payControlEnabled = async (attempts) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          await page.wait(SETTLE_INTERVAL_SECONDS);
          const observed = await page.evaluate(buildStepEvaluate('observe')).catch(() => null);
          if (observed) last = observed;
          if (observed?.commitCandidates?.length) return true;
        }
        return false;
      };

      let probe = null;
      for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
        probe = await inFrame(COD_OPTION_PHRASES, 'observe');
        if (probe?.labels?.length) break;
        await page.wait(SETTLE_INTERVAL_SECONDS);
      }
      frameReport = probe;
      if (!probe) return { ok: false, reason: 'could not read the zpaykit payment frame' };
      if (!probe.found.length) return { ok: false, reason: 'no cash option is offered in this payment frame' };

      // A previous run may already have left cash selected — do not toggle it back off.
      const before = await page.evaluate(buildStepEvaluate('observe')).catch(() => null);
      if (before?.commitCandidates?.length) {
        last = before;
        trail.push('select:"Cash" (already selected)');
        return { ok: true };
      }

      const chosen = await inFrame(COD_OPTION_PHRASES, 'click');
      if (chosen) frameReport = chosen;
      if (!chosen?.clicked) return { ok: false, reason: 'could not click the cash option' };
      trail.push(`select:"${chosen.clicked}"`);
      if (await payControlEnabled(SETTLE_ATTEMPTS)) return { ok: true };

      // The section is a toggle: if that click closed an already-open one, one more click reopens
      // it. Only give up after this.
      const retry = await inFrame(COD_OPTION_PHRASES, 'click');
      if (retry?.clicked) trail.push(`select:"${retry.clicked}" (retry)`);
      if (await payControlEnabled(SETTLE_ATTEMPTS)) return { ok: true };

      return { ok: false, reason: 'selected cash but the pay control never became enabled' };
    };

    for (let step = 0; step < MAX_CHECKOUT_STEPS; step += 1) {
      const result = await page.evaluate(buildStepEvaluate(mode)).catch((error) => {
        throw new CommandExecutionError(`blinkit place-order step failed: ${error?.message || error}`);
      });
      if (!result) throw new CommandExecutionError('blinkit place-order returned no step result');
      last = result;

      if (!result.clicked) break;
      // A control whose label never changes after clicking means the funnel is not advancing;
      // stop rather than clicking the same thing until the step budget runs out.
      const clickKey = `${result.clicked}:${result.text}`;
      if (seenClicks.has(clickKey)) break;
      seenClicks.add(clickKey);
      trail.push(`${result.clicked}:"${result.text}"`);

      if (result.clicked === 'commit') {
        committed = true;
        break;
      }

      // Wait for the next screen to actually render before scanning it again. A fixed sleep here
      // caught "Select Payment Method" mid-spinner and reported it as an empty screen.
      const before = signatureOf(result);
      for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
        await page.wait(SETTLE_INTERVAL_SECONDS);
        const observed = await page.evaluate(buildStepEvaluate('observe')).catch(() => null);
        if (!observed) continue;
        last = observed;
        // A greyed-out "Pay Now" still counts as "the checkout shell has rendered" — the payment
        // methods themselves live in the zpaykit iframe, so waiting for top-level paymentOptions
        // here would always time out.
        const actionable = observed.commitCandidates.length || observed.advanceCandidates.length
          || observed.disabledCommits.length || observed.paymentOptions.length || observed.blockedHints.length;
        if (signatureOf(observed) !== before && actionable) break;
      }

      // On the checkout shell the only way forward is inside the payment frame.
      if (!codSelected && /checkout/i.test(String(last?.url || ''))) {
        const outcome = await selectCashOnDelivery();
        codSelected = outcome.ok;
        if (!outcome.ok) {
          frameNote = outcome.reason;
          break;
        }
        // selectCashOnDelivery only returns ok once the parent's pay control is enabled, and it
        // refreshes `last` on the way — the next loop iteration will find and handle it.
      }
    }

    const base = { confirmed: Boolean(kwargs.confirm), itemCount: summary.itemCount, payable: summary.payable };
    const walked = trail.length ? ` Walked: ${trail.join(' → ')}.` : '';
    const offered = last?.commitCandidates?.length ? ` Final control ready: ${last.commitCandidates.join(' | ')}.` : '';
    const greyed = last?.disabledCommits?.length ? ` Disabled until a payment method is chosen: ${last.disabledCommits.join(' | ')}.` : '';
    // Payment methods come from inside the zpaykit frame, not the top-level document.
    const codLine = codSelected ? ' Selected Cash on Delivery.' : (frameNote ? ` ${frameNote}.` : '');
    const methods = frameReport?.labels?.length
      ? ` Payment frame offers: ${frameReport.labels.slice(0, 12).join(' | ')}.`
      : '';
    const blocking = last?.blockedHints?.length ? ` Needs a human: ${last.blockedHints.join(' | ')}.` : '';

    if (!committed) {
      // advance-only never commits by design; a full run reaching here hit a human-only rail.
      const status = advanceOnly ? 'advanced' : 'action_required';
      const lead = advanceOnly
        ? 'Advance-only: stopped before any paying action.'
        : 'Reached a checkout step this adapter will not click through automatically. Approve the payment in the visible browser, then re-run.';
      return [{
        ...base,
        status,
        orderId: '',
        url: last?.url || '',
        message: `${lead}${walked}${codLine}${methods}${offered}${greyed}${blocking}`.trim(),
      }];
    }

    // Committed. Poll for the merchant's own confirmation rather than trusting the click.
    let probe = null;
    for (let attempt = 0; attempt < ORDER_PROBE_ATTEMPTS; attempt += 1) {
      await page.wait(ORDER_PROBE_INTERVAL_SECONDS);
      probe = await page.evaluate(buildOrderProbeEvaluate()).catch(() => null);
      if (probe?.orderId || probe?.failed) break;
    }

    if (probe?.failed && !probe?.orderId) {
      return [{
        ...base,
        status: 'failed',
        orderId: '',
        url: probe?.url || last?.url || '',
        message: `Blinkit reported a payment/order failure.${walked}`,
      }];
    }

    if (!probe?.orderId) {
      // The dangerous case: a paying button WAS clicked. Never report success, and say plainly
      // that an order may exist so nobody retries into a double charge.
      return [{
        ...base,
        status: 'submitted_unconfirmed',
        orderId: '',
        url: probe?.url || last?.url || '',
        message: `A paying action was clicked but Blinkit returned no order id within ${ORDER_PROBE_ATTEMPTS * ORDER_PROBE_INTERVAL_SECONDS}s. AN ORDER MAY HAVE BEEN PLACED — check Blinkit order history before retrying.${walked}`,
      }];
    }

    return [{
      ...base,
      status: 'placed',
      orderId: probe.orderId,
      url: probe.url || '',
      message: `Order confirmed by Blinkit (order id via ${probe.source}).${walked}`,
    }];
  },
});

export const __test__ = {
  buildStepEvaluate,
  buildOrderProbeEvaluate,
  buildFrameEvaluate,
};
