// Offline verification of the user-local blinkit/place-order override.
// Runs the real buildStepEvaluate() source against a stub DOM built from the labels actually
// observed in the failing trace screenshot. No browser, no network, no money.
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

// Verifies the DEPLOYED adapter (the copy webcmd actually loads), not the vendored one in this
// repo — the repo copy has no @agentrhq/webcmd import shim or sibling utils.js to resolve against.
// Run `node webcmd-adapters/install.mjs` first if ~/.webcmd/clis/blinkit is empty.
const installed = path.join(os.homedir(), '.webcmd', 'clis', 'blinkit', 'place-order.js');
const mod = await import(pathToFileURL(installed).href);
const { buildStepEvaluate, buildOrderProbeEvaluate, buildFrameEvaluate } = mod.__test__;

// --- minimal DOM stub -------------------------------------------------------------------------
class Node {
  constructor(text, children = [], opts = {}) {
    this.ownText = text;
    this.children = children;
    this.hidden = opts.hidden === true;
    this.isDisabled = opts.disabled === true;
    this.clicked = 0;
    this.parent = null;
    for (const c of children) c.parent = this;
  }
  get parentElement() { return this.parent; }
  getAttribute(name) { return name === 'aria-disabled' && this.isDisabled ? 'true' : null; }
  hasAttribute(name) { return name === 'disabled' && this.isDisabled; }
  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join(' ') : this.ownText;
  }
  get innerText() { return this.textContent; }
  contains(other) {
    if (other === this) return true;
    return this.children.some((c) => c.contains(other));
  }
  getBoundingClientRect() {
    return this.hidden ? { width: 0, height: 0 } : { width: 200, height: 48 };
  }
  click() { this.clicked += 1; }
  descendants() { return [this, ...this.children.flatMap((c) => c.descendants())]; }
}

function runStep(rootNodes, mode, pathname = '/checkout') {
  const all = rootNodes.flatMap((n) => n.descendants());
  const sandbox = {
    document: { querySelectorAll: () => all, body: { innerText: '' } },
    window: {
      getComputedStyle: (node) => (node && node.isDisabled)
        ? { visibility: 'visible', display: 'block', opacity: '0.4', pointerEvents: 'none' }
        : { visibility: 'visible', display: 'block', opacity: '1', pointerEvents: 'auto' },
    },
    location: { href: `https://blinkit.com${pathname}`, pathname },
  };
  // Parens are load-bearing: `return` + newline would trip ASI and yield undefined.
  const fn = new Function('document', 'window', 'location', `return (${buildStepEvaluate(mode)});`);
  return fn(sandbox.document, sandbox.window, sandbox.location);
}

// --- fixtures ---------------------------------------------------------------------------------
// The exact compound label from the failing trace screenshot (traces/20260731093422-429c7a5f).
const cartPanel = () => {
  const label = new Node('Proceed To Pay ›');
  const bar = new Node('', [new Node('₹184'), new Node('TOTAL'), label]);
  return { roots: [new Node('', [new Node('My Cart'), new Node('Grand total ₹184'), bar])], label, bar };
};

// A plausible payment screen: COD selectable, plus a genuinely-final button.
const paymentScreenWithCod = () => {
  const cod = new Node('Cash on Delivery');
  const place = new Node('Place Order');
  return { roots: [new Node('', [new Node('Select a payment method'), cod, place])], cod, place };
};

const paymentScreenUpiOnly = () => {
  const roots = [new Node('', [new Node('Enter UPI PIN'), new Node('Scan the QR with any UPI app')])];
  return { roots };
};

const payAmountButton = () => {
  const pay = new Node('Pay ₹184');
  return { roots: [new Node('', [pay])], pay };
};

// --- assertions -------------------------------------------------------------------------------
let failures = 0;
const check = (name, cond, detail) => {
  if (cond) { console.log(`  PASS  ${name}`); return; }
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n[1] The exact bug: compound "₹184 TOTAL Proceed To Pay ›" bar');
{
  const { roots, label, bar } = cartPanel();
  const r = runStep(roots, 'full', '/');
  check('classified as ADVANCE (not commit)', r.clicked === 'advance', `got clicked=${r.clicked}`);
  check('matched the "proceed to pay" phrase', r.phrase === 'proceed to pay', `got phrase=${r.phrase}`);
  check('clicked the deepest label node, not the wrapper', label.clicked === 1 && bar.clicked === 0,
    `label=${label.clicked} bar=${bar.clicked}`);
  check('reported no commit control on this screen', r.commitCandidates.length === 0,
    JSON.stringify(r.commitCandidates));
}

console.log('\n[2] Upstream regression: packaged adapter found nothing here');
{
  const upstream = [/^place order$/i, /^pay( now)?$/i, /^cash on delivery$/i];
  const observed = '₹184 TOTAL Proceed To Pay ›';
  check('packaged anchored regexes still miss it (root cause confirmed)',
    !upstream.some((re) => re.test(observed)));
}

console.log('\n[3] Payment screen with COD available');
{
  const { roots, cod, place } = paymentScreenWithCod();
  const r = runStep(roots, 'full');
  check('prefers the COMMIT control over the COD row', r.clicked === 'commit', `got ${r.clicked}`);
  check('clicked "Place Order"', place.clicked === 1 && cod.clicked === 0,
    `place=${place.clicked} cod=${cod.clicked}`);
}

console.log('\n[4] advance-only mode must never click a paying control');
{
  const { roots, cod, place } = paymentScreenWithCod();
  const r = runStep(roots, 'advance-only');
  check('did not click commit', place.clicked === 0, `place=${place.clicked}`);
  check('selected COD as an advance step instead', r.clicked === 'advance' && cod.clicked === 1,
    `clicked=${r.clicked} cod=${cod.clicked}`);
  check('still reports the commit control it refused to press',
    r.commitCandidates.includes('Place Order'), JSON.stringify(r.commitCandidates));
}

console.log('\n[5] advance-only on the cart panel (the live run we are about to do)');
{
  const { roots, label } = cartPanel();
  const r = runStep(roots, 'advance-only', '/');
  check('advances past Proceed To Pay', r.clicked === 'advance' && label.clicked === 1);
}

console.log('\n[6] Human-only rail is detected, not clicked');
{
  const { roots } = paymentScreenUpiOnly();
  const r = runStep(roots, 'full');
  check('clicked nothing', r.clicked === null, `got ${r.clicked}`);
  check('surfaced the blocking hint', r.blockedHints.some((h) => /UPI PIN/i.test(h)),
    JSON.stringify(r.blockedHints));
}

console.log('\n[7] "Pay ₹184" final button is a COMMIT');
{
  const { roots, pay } = payAmountButton();
  const r = runStep(roots, 'full');
  check('classified as commit', r.clicked === 'commit' && pay.clicked === 1, `got ${r.clicked}`);
  const advanceRun = payAmountButton();
  const r2 = runStep(advanceRun.roots, 'advance-only');
  check('advance-only refuses to click it', advanceRun.pay.clicked === 0 && r2.clicked === null);
}

// The real screen observed live at traces/20260731095519-37ee697a: "Pay Now" rendered but greyed
// out until a payment method is picked. Clicking it is a silent no-op.
const livePaymentScreen = (opts = {}) => {
  const payNow = new Node('Pay Now', [], { disabled: true });
  const kids = [new Node('Select Payment Method'), new Node('Delivery Address'), payNow];
  const cod = opts.withCod ? new Node('Cash on Delivery') : null;
  if (cod) kids.push(cod);
  if (opts.withUpi) kids.push(new Node('UPI'), new Node('Credit Card / Debit Card'));
  return { roots: [new Node('', kids)], payNow, cod };
};

console.log('\n[9] LIVE-OBSERVED screen: "Pay Now" present but disabled');
{
  const { roots, payNow } = livePaymentScreen({ withUpi: true });
  const r = runStep(roots, 'full');
  check('never clicks the disabled Pay Now', payNow.clicked === 0, `clicked=${payNow.clicked}`);
  check('does not report it as a ready commit control', r.commitCandidates.length === 0,
    JSON.stringify(r.commitCandidates));
  check('reports it as disabled instead', r.disabledCommits.includes('Pay Now'),
    JSON.stringify(r.disabledCommits));
  check('enumerates the payment methods on offer',
    r.paymentOptions.some((o) => /UPI/i.test(o)), JSON.stringify(r.paymentOptions));
}

console.log('\n[10] Same screen WITH Cash on Delivery available');
{
  const { roots, cod, payNow } = livePaymentScreen({ withCod: true, withUpi: true });
  const r = runStep(roots, 'full');
  check('selects COD as an advance step', r.clicked === 'advance' && cod.clicked === 1,
    `clicked=${r.clicked} cod=${cod.clicked}`);
  check('still refuses the disabled Pay Now', payNow.clicked === 0);
  check('lists COD among payment methods',
    r.paymentOptions.some((o) => /cash on delivery/i.test(o)), JSON.stringify(r.paymentOptions));
}

console.log('\n[11] observe mode is strictly read-only');
{
  const { roots, cod, payNow } = livePaymentScreen({ withCod: true, withUpi: true });
  const r = runStep(roots, 'observe');
  check('clicks absolutely nothing', cod.clicked === 0 && payNow.clicked === 0 && r.clicked === null);
  check('still reports what it saw', r.paymentOptions.length > 0 && r.disabledCommits.length > 0);
  const cart = cartPanel();
  const r2 = runStep(cart.roots, 'observe', '/');
  check('does not click Proceed To Pay either', cart.label.clicked === 0 && r2.clicked === null);
}

// Regression for the live false positive at traces/20260731100319-fbb814f8: the home-page footer
// link "E-Gift Cards" was reported as a rendered payment method, ending the settle wait early
// while the browser was still on "/" and the real payment list had not loaded.
console.log('\n[13] Home-page footer must not read as a payment method');
{
  const footer = () => [new Node('', [
    new Node('E-Gift Cards'), new Node('Blinkit Wallet'), new Node('Proceed To Pay'),
  ])];
  const onHome = runStep(footer(), 'observe', '/');
  check('no payment methods detected off the checkout route', onHome.paymentOptions.length === 0,
    JSON.stringify(onHome.paymentOptions));
  const onCheckout = runStep(footer(), 'observe', '/checkout');
  check('same markup DOES report them on the checkout route', onCheckout.paymentOptions.length === 2,
    JSON.stringify(onCheckout.paymentOptions));
}

console.log('\n[12] Enabled Pay Now (after a method is chosen) IS committable');
{
  const payNow = new Node('Pay Now');
  const roots = [new Node('', [new Node('Select Payment Method'), payNow])];
  const r = runStep(roots, 'full');
  check('clicked once a method enables it', r.clicked === 'commit' && payNow.clicked === 1,
    `clicked=${r.clicked}`);
}

// zpaykit's real category list, verbatim from the live getPaymentMethods response at
// traces/20260731100704-8f6c1a45: Wallets / Add credit or debit cards / Netbanking / UPI /
// Cash / Pay Later, each a collapsed accordion.
function runFrame(rootNodes, phrases, mode) {
  const all = rootNodes.flatMap((n) => n.descendants());
  const doc = { querySelectorAll: () => all };
  const win = {
    getComputedStyle: (node) => (node && node.isDisabled)
      ? { visibility: 'hidden', display: 'block', opacity: '0' }
      : { visibility: 'visible', display: 'block', opacity: '1' },
  };
  const loc = { href: 'https://www.zomato.com/zpaykit/init' };
  const fn = new Function('document', 'window', 'location',
    `return (${buildFrameEvaluate(phrases, mode)});`);
  return fn(doc, win, loc);
}

const zpaykitCollapsed = () => {
  const cash = new Node('Cash');
  return {
    roots: [new Node('', [
      new Node('Wallets'), new Node('Add credit or debit cards'), new Node('Netbanking'),
      new Node('UPI'), cash, new Node('Pay Later'),
    ])],
    cash,
  };
};

const zpaykitCashExpanded = () => {
  const cod = new Node('Cash on Delivery');
  return {
    roots: [new Node('', [
      new Node('Wallets'), new Node('UPI'), new Node('Cash', [cod]), new Node('Pay Later'),
    ])],
    cod,
  };
};

// The live phrase list — 'cash' is what the DOM actually renders.
const COD = ['cash on delivery', 'pay on delivery', 'cash'];

console.log('\n[14] zpaykit frame: collapsed accordions (live shape)');
{
  const { roots, cash } = zpaykitCollapsed();
  const probe = runFrame(roots, COD, 'observe');
  check('finds the bare "Cash" section', probe.found.includes('Cash'), JSON.stringify(probe.found));
  check('reports the real category list', probe.labels.includes('UPI') && probe.labels.includes('Cash'),
    JSON.stringify(probe.labels));
  check('observing clicks nothing', cash.clicked === 0);
  const chosen = runFrame(roots, COD, 'click');
  check('clicking it selects cash', chosen.clicked === 'Cash' && cash.clicked === 1,
    `clicked=${chosen.clicked}`);
}

console.log('\n[15] zpaykit frame: expanded Cash with the exact-change note');
{
  // Verbatim from traces/20260731101521-1d1e501a.
  const note = new Node('Please keep exact change handy to help us serve you better');
  const header = new Node('Cash');
  const roots = [new Node('', [new Node('UPI'), new Node('', [header, note])])];
  const chosen = runFrame(roots, COD, 'click');
  check('targets the "Cash" header, not the note', chosen.clicked === 'Cash' && header.clicked === 1,
    `clicked=${chosen.clicked}`);
  check('the note is never mistaken for an option', note.clicked === 0);
}

console.log('\n[16] A real "Cash on Delivery" row still wins if a site renders one');
{
  const { roots, cod } = zpaykitCashExpanded();
  const chosen = runFrame(roots, COD, 'click');
  check('clicks the deepest COD row', chosen.clicked === 'Cash on Delivery' && cod.clicked === 1,
    `clicked=${chosen.clicked}`);
}

console.log('\n[17] zpaykit frame with no cash option at all');
{
  const roots = [new Node('', [new Node('Wallets'), new Node('UPI'), new Node('Netbanking')])];
  const chosen = runFrame(roots, COD, 'click');
  check('reports none rather than clicking something else', chosen.clicked === '',
    `clicked=${chosen.clicked}`);
}

console.log('\n[8] Generated scripts are syntactically valid JS');
for (const [name, src] of [['step/full', buildStepEvaluate('full')],
                           ['step/advance-only', buildStepEvaluate('advance-only')],
                           ['orderProbe', buildOrderProbeEvaluate()]]) {
  try { new Function(`return (${src});`); check(`${name} parses`, true); }
  catch (e) { check(`${name} parses`, false, e.message); }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED\n' : `\n${failures} CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
