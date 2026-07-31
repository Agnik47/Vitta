// The automatic purchase pipeline: search → filter → product selection (human, upstream of this
// file) → PROCEED → everything below runs with no further human input until a final result.
//
// Hard boundary (CLAUDE.md rule 2, ADR-015): this file orchestrates: it decides WHAT to run and
// WHEN, never WHETHER a spend is allowed. Every money-moving or browser-driving step is a spawn of
// the real `gate`/`search` CLIs via gate-spawn.ts — this file never imports src/policy/decide.ts,
// src/webcmd/executor.ts, or DodoCreditLedger directly, and contains no model/LLM call of any kind.
// The one judgement call a human makes — which product — already happened before this runs; nothing
// here second-guesses it.
//
// Fail closed throughout: any step that doesn't produce clear, positive evidence stops the whole
// run rather than guessing forward. A run that stops early is a correct, honest result — never
// silently treated as success.
import { runGate, runSearch } from './gate-spawn';
import { MERCHANT_PROFILES, type PurchaseMerchant } from './merchants';
import { parseCommitOutput } from './parse-commit-output';
import { withRetry } from './retry';

/** One line to add to the merchant's real cart before checkout. A "Purchase Job" is always scoped
 *  to a single merchant (a real checkout can't span two marketplaces), but a merchant's cart is
 *  naturally multi-line — this mirrors that: one job, one real checkout, N real add-to-cart calls. */
export interface PurchaseItem {
  /** Already resolved to the form this merchant's add-to-cart wants (id or URL) — see
   *  dashboard/lib/product-ref.ts, whose logic this mirrors for the CLI path. */
  productRef: string;
  productName: string;
  quantity: number;
}

export interface PurchaseInput {
  merchant: PurchaseMerchant;
  /** Every line to add before checkout — at least one. */
  items: PurchaseItem[];
  /** Whether to clear the real cart before adding — true only the first purchase of a session for
   *  this merchant; the caller tracks that, not this file (keeps the agent stateless per run). */
  clearCartFirst: boolean;
  /** Free-delivery-style threshold. Below it, the agent adds a cheap real top-up automatically —
   *  no human is asked again once Proceed has been clicked. */
  minCartInr?: number;
  /** A hard ceiling. Above it, the run stops closed rather than proceeding — this is a safety rail
   *  the human set, not something to negotiate around. */
  maxCartInr?: number;
  /** The mandate this run commits against — needed only for the auto-fund-and-retry step
   *  (`gate fund <mandateId> --auto`). `gate run` itself resolves the mandate on its own (the most
   *  recently created one), so this is never required for the commit step, only for topping it up. */
  mandateId?: string;
}

export type PurchaseStepName =
  | 'precondition'
  | 'clear-cart'
  | 'add-to-cart'
  | 'verify-cart'
  | 'order-value-check'
  | 'fund'
  // The real gate.ts commit sequence, split into its real, distinct sub-facts rather than one
  // opaque 'commit' step — see docs/OUTCOME.md's "two-stage tracking" entry for the full reasoning.
  // 'commit' itself is kept for the policy-DENY case specifically (nothing was ever authorized, so
  // there's no 'authorize'/'merchant-confirm' step to distinguish it from).
  | 'commit'
  | 'authorize'
  | 'merchant-confirm'
  | 'draw'
  | 'confirm';

export interface PurchaseStepEvent {
  step: PurchaseStepName;
  status: 'running' | 'done' | 'skipped' | 'failed';
  detail: string;
  timestamp: string;
}

export interface PurchaseResult {
  ok: boolean;
  merchant: PurchaseMerchant;
  /** Human-readable summary — the one item's name, or "<first item> and N more". */
  productName: string;
  /** Every line this run tried to add, for a UI that wants the full breakdown rather than the
   *  summary string above. */
  items: PurchaseItem[];
  verdict?: 'ALLOW' | 'DENY' | 'STEP_UP';
  denyCode?: string;
  /** The real, signed TransactionAuthorization id — present whenever decide() returned ALLOW for
   *  the commit command, regardless of whether the merchant ever confirmed an order. This is what
   *  distinguishes "authorized, still waiting on the merchant" from a genuine policy DENY: a DENY
   *  never gets one of these. */
  authorizationId?: string;
  /** True specifically when the mandate authorized this spend (verdict ALLOW, authorizationId set)
   *  but the merchant hasn't confirmed an order — the real, current Blinkit-checkout-blocked case.
   *  Distinct from `ok: false` on its own, which also covers genuine policy DENYs and infra errors. */
  awaitingMerchantConfirmation: boolean;
  receiptId?: string;
  orderId?: string;
  commitProof?: string;
  /** True when the gate approved and drove the browser as far as it can, but a human has to place
   *  the order themselves (a merchant with no order-placing command). Currently unused by any of
   *  the three configured merchants (all three now have a real place-order path) but kept as an
   *  honest possibility, matching src/webcmd/commit-spec.ts's proof:'none' fallback. */
  handoff: boolean;
  finalAmountInr?: number;
  paymentStatus: 'captured' | 'not_charged';
  failureReason?: string;
  events: PurchaseStepEvent[];
  startedAt: string;
  completedAt: string;
}

interface CartReadResult {
  ok: boolean;
  cartTotalInr?: number;
  cartItemCount?: number;
  message?: string;
}

const TOPUP_QUERIES = ['milk', 'bread', 'eggs', 'biscuits', 'bananas'];

function nowIso(): string {
  return new Date().toISOString();
}

/** "Maggi Masala" for one item, "Maggi Masala and 2 more" for several — never fabricates a merged
 *  name across items. */
function summaryName(items: PurchaseItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].productName;
  return `${items[0].productName} and ${items.length - 1} more`;
}

/** Emits one step event and returns it — callers both push it to the result AND stream it (the CLI
 *  wrapper turns each of these into one NDJSON line). */
function makeEvent(step: PurchaseStepName, status: PurchaseStepEvent['status'], detail: string): PurchaseStepEvent {
  return { step, status, detail, timestamp: nowIso() };
}

/** Builds a failure detail from a gate-CLI result, showing BOTH streams rather than picking one.
 *  Found live: gate.ts's top-level error handler prints the real failure reason to stderr
 *  (`console.error`), while stdout may already hold unrelated success-looking lines printed before
 *  the failure (e.g. a real "ALLOW" line from a write that then failed downstream) — a plain
 *  `stdout || stderr` fallback picks the misleading stdout line and hides the actual reason. */
function describeFailure(result: { stdout: string; stderr: string }, fallback: string): string {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (stderr && stdout) return `${stderr}\n${stdout}`;
  return stderr || stdout || fallback;
}

async function readCart(merchant: PurchaseMerchant): Promise<CartReadResult> {
  return withRetry(
    async () => {
      const result = await runSearch([merchant, 'cart']);
      try {
        const parsed = JSON.parse(result.stdout.trim() || '{}') as {
          ok?: boolean;
          cartTotalInr?: number;
          cartItemCount?: number;
          message?: string;
        };
        return {
          ok: Boolean(parsed.ok),
          cartTotalInr: parsed.cartTotalInr,
          cartItemCount: parsed.cartItemCount,
          message: parsed.message,
        };
      } catch {
        return { ok: false, message: result.stderr.trim() || 'Could not parse cart read output' };
      }
    },
    `readCart(${merchant})`,
    { maxRetries: 2, initialDelayMs: 300 }
  );
}

/** Real search for a cheap staple, used only to close a real minimum-order shortfall. Never
 *  fabricates a product — if nothing real is found across every query, the caller is told plainly. */
async function findRealTopUp(
  merchant: PurchaseMerchant,
  shortfallInr: number,
): Promise<{ ref: string; name: string; priceInr: number } | null> {
  for (const query of TOPUP_QUERIES) {
    const result = await runSearch([merchant, 'search', query]);
    let rows: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(result.stdout.trim() || '{}') as { ok?: boolean; rows?: unknown };
      if (parsed.ok && Array.isArray(parsed.rows)) rows = parsed.rows as Array<Record<string, unknown>>;
    } catch {
      continue;
    }
    const candidates = rows
      .map((row) => ({
        ref: String(row.productId ?? row.product_id ?? ''),
        name: String(row.name ?? row.title ?? ''),
        priceInr: Number(row.price ?? 0),
        available: row.available !== false && row.availability !== 'Out of stock',
      }))
      .filter((r) => r.ref && r.name && r.priceInr > 0 && r.available);
    if (candidates.length === 0) continue;
    const closers = candidates.filter((c) => c.priceInr >= shortfallInr).sort((a, b) => a.priceInr - b.priceInr);
    const pick = closers[0] ?? candidates.sort((a, b) => b.priceInr - a.priceInr)[0];
    if (pick) return pick;
  }
  return null;
}

export class PurchaseAgent {
  private events: PurchaseStepEvent[] = [];

  constructor(private readonly onEvent?: (event: PurchaseStepEvent) => void) {}

  private emit(step: PurchaseStepName, status: PurchaseStepEvent['status'], detail: string): void {
    const event = makeEvent(step, status, detail);
    this.events.push(event);
    this.onEvent?.(event);
  }

  private fail(startedAt: string, merchant: PurchaseMerchant, items: PurchaseItem[], reason: string): PurchaseResult {
    return {
      ok: false,
      merchant,
      productName: summaryName(items),
      items,
      // Every fail() call site is a pre-authorization failure (precondition/clear-cart/add-to-cart/
      // verify-cart/order-value-check) — the mandate never even got asked yet, so there is nothing
      // "awaiting" about it.
      awaitingMerchantConfirmation: false,
      handoff: false,
      paymentStatus: 'not_charged',
      failureReason: reason,
      events: this.events,
      startedAt,
      completedAt: nowIso(),
    };
  }

  async run(input: PurchaseInput): Promise<PurchaseResult> {
    const startedAt = nowIso();
    const { merchant, items } = input;
    const productName = summaryName(items);
    const profile = MERCHANT_PROFILES[merchant];

    if (items.length === 0) {
      // Fail closed rather than run a whole precondition/clear-cart pass for nothing — an empty
      // items array is a caller bug, not a "nothing to buy" no-op.
      this.emit('add-to-cart', 'failed', 'No items to purchase');
      return this.fail(startedAt, merchant, items, 'No items were supplied to this purchase run');
    }

    // Step 0 — precondition (e.g. Zepto's delivery location). Checked with a real read, not assumed.
    if (profile.precondition) {
      this.emit('precondition', 'running', `Checking ${profile.precondition.check}`);
      const result = await runSearch([merchant, profile.precondition.check]);
      let satisfied = false;
      try {
        const parsed = JSON.parse(result.stdout.trim() || '{}') as { ok?: boolean; rows?: unknown[] };
        const row = (parsed.rows?.[0] as Record<string, unknown>) ?? {};
        satisfied = parsed.ok === true && profile.precondition.satisfied(row);
      } catch {
        satisfied = false;
      }
      if (!satisfied) {
        this.emit('precondition', 'failed', profile.precondition.message);
        return this.fail(startedAt, merchant, items, profile.precondition.message);
      }
      this.emit('precondition', 'done', 'Precondition satisfied');
    }

    // Step 1 — clear stale cart (session-scoped; the caller decides whether this is needed).
    if (input.clearCartFirst) {
      this.emit('clear-cart', 'running', `Clearing any existing ${merchant} cart from a previous session`);
      const result = await runGate(['run', '--', 'webcmd', merchant, 'clear-cart']);
      if (!result.ok) {
        this.emit('clear-cart', 'failed', describeFailure(result, 'clear-cart failed'));
        return this.fail(startedAt, merchant, items, 'Could not clear the existing cart before purchasing');
      }
      this.emit('clear-cart', 'done', 'Cart cleared');
    } else {
      this.emit('clear-cart', 'skipped', 'Already cleared earlier this session');
    }

    // Step 2 — add every line to the real cart, one real webcmd call per item. Fails closed on the
    // first item that doesn't add — a partially-added cart must not proceed to checkout, since the
    // human approved the WHOLE set, not whichever items happened to add successfully.
    for (const item of items) {
      this.emit('add-to-cart', 'running', `Adding ${item.productName} (×${item.quantity})`);
      const addResult = await runGate([
        'run',
        '--',
        'webcmd',
        merchant,
        'add-to-cart',
        item.productRef,
        '--quantity',
        String(Math.min(item.quantity, profile.maxQuantity)),
      ]);
      if (!addResult.ok) {
        const detail = describeFailure(addResult, 'add-to-cart failed');
        this.emit('add-to-cart', 'failed', `${item.productName}: ${detail}`);
        return this.fail(startedAt, merchant, items, `Could not add ${item.productName} to the cart: ${detail}`);
      }
      this.emit('add-to-cart', 'done', `${item.productName} added`);
    }

    // Step 3 — verify the REAL cart, not the optimistic add-to-cart responses.
    this.emit('verify-cart', 'running', 'Reading the real merchant cart');
    let cart = await readCart(merchant);
    if (!cart.ok) {
      this.emit('verify-cart', 'failed', cart.message || 'Could not read the real cart');
      return this.fail(startedAt, merchant, items, cart.message || 'Could not read the real cart after adding');
    }
    this.emit(
      'verify-cart',
      'done',
      `Real cart total ₹${cart.cartTotalInr ?? '?'} across ${cart.cartItemCount ?? 0} item(s)`,
    );

    // Step 4 — order-value check. Max is a hard rail (fail closed); min is closed automatically
    // with a REAL top-up — no human is asked again once Proceed has been clicked.
    if (input.maxCartInr !== undefined && (cart.cartTotalInr ?? 0) > input.maxCartInr) {
      const detail = `Real cart total ₹${cart.cartTotalInr} exceeds the ₹${input.maxCartInr} maximum you set`;
      this.emit('order-value-check', 'failed', detail);
      return this.fail(startedAt, merchant, items, detail);
    }
    if (input.minCartInr !== undefined && (cart.cartTotalInr ?? 0) < input.minCartInr) {
      const shortfall = input.minCartInr - (cart.cartTotalInr ?? 0);
      this.emit('order-value-check', 'running', `₹${shortfall} short of the ₹${input.minCartInr} minimum — finding a real top-up`);
      const topUp = await findRealTopUp(merchant, shortfall);
      if (!topUp) {
        const detail = `Could not find a real ${merchant} item to close the ₹${shortfall} gap to the ₹${input.minCartInr} minimum`;
        this.emit('order-value-check', 'failed', detail);
        return this.fail(startedAt, merchant, items, detail);
      }
      const addTopUp = await runGate(['run', '--', 'webcmd', merchant, 'add-to-cart', topUp.ref]);
      if (!addTopUp.ok) {
        const detail = `Found a real top-up (${topUp.name}, ₹${topUp.priceInr}) but could not add it to the cart`;
        this.emit('order-value-check', 'failed', detail);
        return this.fail(startedAt, merchant, items, detail);
      }
      cart = await readCart(merchant);
      this.emit(
        'order-value-check',
        'done',
        `Added ${topUp.name} (₹${topUp.priceInr}) — real cart total now ₹${cart.cartTotalInr ?? '?'}`,
      );
    } else {
      this.emit('order-value-check', 'skipped', 'Cart already within the order-value range');
    }

    // Step 5/6 — commit, with one automatic top-up-and-retry if the ONLY reason for the DENY is an
    // under-funded reserve (see gate-spawn.ts / gate.ts's `fund --auto`, itself hard-capped at the
    // mandate's own signed limit — this can never spend past what the human already authorized).
    let commitAttempt = 0;
    let commitResult = await this.attemptCommit(merchant);
    while (
      commitResult.verdict === 'DENY' &&
      commitResult.denyCode === 'OVER_TOTAL_CAP' &&
      commitResult.overBy !== undefined &&
      commitAttempt === 0
    ) {
      commitAttempt += 1;
      if (!input.mandateId) {
        // Can't top up a mandate we don't know the id of — fail closed rather than guess which one
        // gate run's own "most recent mandate" resolution picked.
        this.emit('fund', 'skipped', 'No mandate id supplied to this run — cannot auto-fund');
        break;
      }
      this.emit('fund', 'running', `Reserve short by ₹${commitResult.overBy} — auto-funding within the mandate cap`);
      const fundResult = await runGate(['fund', input.mandateId, '--auto', '--amount', String(commitResult.overBy)]);
      if (!fundResult.ok) {
        this.emit('fund', 'failed', describeFailure(fundResult, 'Auto-fund failed'));
        break;
      }
      this.emit('fund', 'done', 'Reserve topped up within the mandate cap');
      commitResult = await this.attemptCommit(merchant);
    }

    // CRITICAL — the exact ADR-013 lesson, applied at this layer: `verdict === 'ALLOW'` means the
    // POLICY approved the spend, not that the merchant actually confirmed an order. Verified live
    // this session: a real Blinkit place-order ran, decide() logged a real ALLOW event, and the
    // browser command itself completed with no error — yet Blinkit's own response carried no order
    // id (the merchant stopped short of actually placing it, same failure shape ADR-013 was
    // written for), so gate.ts correctly refused to draw or sign anything. An earlier version of
    // this check only looked at `verdict`, saw ALLOW, and would have reported this run as a SUCCESS
    // despite zero money moving and zero receipt existing — the single worst failure mode this
    // whole project exists to prevent. Success now requires the actual evidence gate.ts produces
    // for a genuine commit: a signed receipt, or (for a proof:'none' hand-off merchant) a real
    // checkout URL to hand the human.
    // Real, no-money-moved DENY/STEP_UP: the mandate itself refused the spend. Nothing was ever
    // authorized, so this stays the plain 'commit' step — there is no 'authorize' fact to report.
    if (commitResult.verdict !== 'ALLOW') {
      const detail = commitResult.raw || 'Purchase was not allowed';
      this.emit('commit', 'failed', detail);
      return {
        ok: false,
        merchant,
        productName,
        items,
        verdict: commitResult.verdict,
        denyCode: commitResult.denyCode,
        awaitingMerchantConfirmation: false,
        handoff: false,
        finalAmountInr: cart.cartTotalInr,
        paymentStatus: 'not_charged',
        failureReason: detail,
        events: this.events,
        startedAt,
        completedAt: nowIso(),
      };
    }

    // From here on, decide() genuinely said ALLOW — gate.ts already built and signed a real
    // TransactionAuthorization before it ever touched the browser (commitResult.authorizationId is
    // parsed straight from that real, printed line, not invented here).
    this.emit(
      'authorize',
      'done',
      `Mandate Gate authorized ₹${commitResult.amountInr ?? cart.cartTotalInr ?? '?'} — reserve verified sufficient`,
    );

    // CRITICAL — the exact ADR-013 lesson, applied at this layer: `verdict === 'ALLOW'` means the
    // POLICY approved the spend, not that the merchant actually confirmed an order. Verified live
    // this session: a real Blinkit place-order ran, decide() logged a real ALLOW event, and the
    // browser command itself completed with no error — yet Blinkit's own response carried no order
    // id (the merchant stopped short of actually placing it, same failure shape ADR-013 was
    // written for), so gate.ts correctly refused to draw or sign anything. An earlier version of
    // this check only looked at `verdict`, saw ALLOW, and would have reported this run as a SUCCESS
    // despite zero money moving and zero receipt existing — the single worst failure mode this
    // whole project exists to prevent. Success now requires the actual evidence gate.ts produces
    // for a genuine commit: a signed receipt, or (for a proof:'none' hand-off merchant) a real
    // checkout URL to hand the human.
    const genuinelyCompleted = Boolean(commitResult.receiptId) || Boolean(commitResult.handoffUrl);
    if (!genuinelyCompleted) {
      const detail = `${merchant} has not confirmed an order yet — nothing was drawn or signed. ${commitResult.raw}`;
      this.emit('merchant-confirm', 'failed', detail);
      return {
        ok: false,
        merchant,
        productName,
        items,
        verdict: 'ALLOW',
        authorizationId: commitResult.authorizationId,
        awaitingMerchantConfirmation: true,
        handoff: false,
        finalAmountInr: cart.cartTotalInr,
        paymentStatus: 'not_charged',
        failureReason: detail,
        events: this.events,
        startedAt,
        completedAt: nowIso(),
      };
    }

    this.emit('merchant-confirm', 'done', commitResult.orderId ? `Order #${commitResult.orderId} confirmed` : 'Order confirmed');
    // draw()/recordDraw() already happened inside gate.ts's single CLI call by the time we observe
    // genuinelyCompleted — this step honestly reports a fact we now know is true, not a new action.
    this.emit('draw', 'done', commitResult.receiptId ? 'Reserve drawn' : 'Nothing drawn (hand-off merchant, no order id to draw against)');
    this.emit(
      'confirm',
      'done',
      commitResult.receiptId ? `Receipt ${commitResult.receiptId}` : 'Approved — awaiting merchant confirmation',
    );

    return {
      ok: true,
      merchant,
      productName,
      items,
      verdict: 'ALLOW',
      authorizationId: commitResult.authorizationId,
      awaitingMerchantConfirmation: false,
      receiptId: commitResult.receiptId,
      orderId: commitResult.orderId,
      commitProof: commitResult.commitProof,
      handoff: commitResult.handoffUrl !== undefined && commitResult.receiptId === undefined,
      finalAmountInr: commitResult.amountInr ?? cart.cartTotalInr,
      paymentStatus: commitResult.receiptId ? 'captured' : 'not_charged',
      events: this.events,
      startedAt,
      completedAt: nowIso(),
    };
  }

  private async attemptCommit(merchant: PurchaseMerchant): Promise<{
    verdict?: 'ALLOW' | 'DENY' | 'STEP_UP';
    denyCode?: string;
    overBy?: number;
    authorizationId?: string;
    receiptId?: string;
    orderId?: string;
    commitProof?: string;
    amountInr?: number;
    handoffUrl?: string;
    raw: string;
  }> {
    this.emit('commit', 'running', `Placing the real ${merchant} order`);
    const result = await runGate(['run', '--', 'webcmd', merchant, 'place-order', '--confirm']);
    const raw = (result.stdout + '\n' + result.stderr).trim();
    return { ...parseCommitOutput(result.stdout), raw };
  }
}
