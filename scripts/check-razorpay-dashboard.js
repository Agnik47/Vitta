// Integration check for the dashboard's Razorpay routes: the real Next server against the local
// Razorpay mock and the REAL gate CLI (sandbox — no keys, no network, no browser).
//
//   npm run build && (cd dashboard && npx next build) && npm run check:razorpay-dashboard
//
// Walks the whole funding flow (order → simulated payment → signed verify → balance) and attacks it:
// forged and mismatched signatures, a webhook signed with the wrong secret, a re-serialized body,
// replayed event ids, and orders that are not Vitta's. Not part of `npm test` because it needs a built
// dashboard; run it after changing anything under dashboard/app/api/**/razorpay or dashboard/lib/razorpay.ts.
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const { existsSync } = require('fs');
const R = path.resolve(__dirname, '..');
const { createSandbox } = require(R + '/dist/agents/sandbox/harness');
const { MOCK_KEY_ID, MOCK_KEY_SECRET } = require(R + '/dist/ledger/mock-razorpay');

const results = [];
const check = (name, ok, extra) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !extra ? '' : '  → ' + JSON.stringify(extra))); };
const hmac = (secret, msg) => crypto.createHmac('sha256', secret).update(msg).digest('hex');

(async () => {
  for (const f of ['dist/agents/sandbox/harness.js', 'dashboard/.next/BUILD_ID']) {
    if (!existsSync(path.join(R, f))) { console.error(`${f} is missing — build first (see the header of this file).`); process.exit(2); }
  }
  const sb = await createSandbox();
  const PORT = 3111, B = `http://127.0.0.1:${PORT}`, WH = 'whsec_test_123';
  const auth = 'Basic ' + Buffer.from(`${MOCK_KEY_ID}:${MOCK_KEY_SECRET}`).toString('base64');
  const win = process.platform === 'win32'; // npx is npx.cmd there, which only runs through a shell (fixed arguments)
  const dash = spawn(win ? 'npx.cmd' : 'npx', ['next', 'start', '-p', String(PORT)], {
    shell: win,
    cwd: path.join(R, 'dashboard'),
    env: { ...process.env, MANDATE_GATE_DATA_DIR: sb.dir, RAZORPAY_WEBHOOK_SECRET: WH, PATH: process.env.PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = ''; dash.stdout.on('data', d => log += d); dash.stderr.on('data', d => log += d);
  try {
    for (let i = 0; i < 60; i++) { try { const r = await fetch(B + '/api/shop/razorpay/config'); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
    const j = async (p, init) => { const r = await fetch(B + p, init); let b = null; try { b = await r.json(); } catch {} return { status: r.status, body: b }; };
    const post = (p, body, headers = {}) => j(p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

    // config never leaks the secret
    const cfg = await j('/api/shop/razorpay/config');
    check('config: configured, public key id only', cfg.body.configured === true && cfg.body.keyId === MOCK_KEY_ID && !JSON.stringify(cfg.body).includes(MOCK_KEY_SECRET), cfg.body);

    // existing sandbox mandate is funded ₹800; dashboard reads the same balance the gate does
    const m0 = await j('/api/mandate');
    check('balance: dashboard reads ₹800 from Razorpay (captured − spent)', m0.body.balance && m0.body.balance.balanceInr === 800, m0.body.balance);

    // a NEW unfunded mandate becomes "current"; fund it through the dashboard route
    const created = await sb.gate(['mandate','create','--subject','agent:t','--cap','500','--per-txn','500','--merchants','zepto','--expires','23:59']);
    const mid = /MANDATE (mnd_[a-z0-9]+)/i.exec(created.stdout)[1];
    const fund = await post('/api/shop/mandate/fund', { mandateId: mid, amountInr: 500 });
    check('fund: creates an order, returns reserveRef + orderId + pay URL', fund.body.ok && /^razorpay-order:order_/.test(fund.body.reserveRef) && fund.body.orderId && /\/pay\/razorpay\/order_/.test(fund.body.checkoutUrl), fund.body);
    const orderId = fund.body.orderId;

    const co = await j('/api/shop/razorpay/checkout?orderId=' + orderId);
    check('checkout: returns key id, amount, mandate (from Razorpay, not the client)', co.body.ok && co.body.amountPaise === 50000 && co.body.mandateId === mid && co.body.keyId === MOCK_KEY_ID, co.body);
    check('checkout: rejects a malformed order id', (await j('/api/shop/razorpay/checkout?orderId=../etc')).status === 404);

    // customer pays with a manual-capture account → payment is only AUTHORIZED
    const pay = sb.razorpay.pay(orderId, { status: 'authorized' });
    const before = await j('/api/mandate');
    check('before verify: authorized money is not a balance', !before.body.balance || before.body.balance.balanceInr === 0 || before.body.balance.available === false, before.body.balance);

    // forged / malformed verify requests are refused and fund nothing
    const forged = await post('/api/shop/razorpay/verify', { razorpay_order_id: orderId, razorpay_payment_id: pay.id, razorpay_signature: 'a'.repeat(64) });
    check('verify: forged signature → 400', forged.status === 400, forged);
    const missing = await post('/api/shop/razorpay/verify', { razorpay_order_id: orderId });
    check('verify: missing fields → 400', missing.status === 400, missing);
    const wrongPay = await post('/api/shop/razorpay/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_OTHER123456', razorpay_signature: hmac(MOCK_KEY_SECRET, `${orderId}|${pay.id}`) });
    check('verify: signature for a different payment id → 400', wrongPay.status === 400, wrongPay);
    check('after forgeries: still nothing funded', sb.razorpay.paidPaise(orderId) === 0);

    // the genuine signature: verifies, the gate captures the authorized payment and attaches the reserve
    const good = await post('/api/shop/razorpay/verify', { razorpay_order_id: orderId, razorpay_payment_id: pay.id, razorpay_signature: hmac(MOCK_KEY_SECRET, `${orderId}|${pay.id}`) });
    check('verify: genuine payment → funded via the gate', good.status === 200 && good.body.ok && good.body.mandateId === mid, good);
    check('verify: the authorized payment was captured', sb.razorpay.paidPaise(orderId) === 50000);
    const after = await j('/api/mandate');
    check('balance: new mandate shows ₹500', after.body.mandate.mandate_id === mid && after.body.balance.balanceInr === 500, after.body);
    check('checkout: an already-paid order is refused (409)', (await j('/api/shop/razorpay/checkout?orderId=' + orderId)).status === 409);

    // ---- webhook ---------------------------------------------------------------------------
    // funding a mandate that still holds money is refused (it would strand its reserve)
    const refused = await post('/api/shop/mandate/fund', { mandateId: mid, amountInr: 300 });
    check('fund: a mandate that still holds money cannot be re-funded by accident (422)', refused.status === 422 && /already has a funded reserve/.test(refused.body.message), refused);
    // a separate, unfunded mandate whose order gets paid and announced by webhook
    const created2 = await sb.gate(['mandate','create','--subject','agent:t2','--cap','500','--per-txn','500','--merchants','zepto','--expires','23:59']);
    const mid2 = /MANDATE (mnd_[a-z0-9]+)/i.exec(created2.stdout)[1];
    const fund2 = await post('/api/shop/mandate/fund', { mandateId: mid2, amountInr: 300 });
    const order2 = fund2.body.orderId;
    sb.razorpay.pay(order2);
    const body = JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: order2 } } } });
    const sig = hmac(WH, body);
    check('webhook: bad signature → 401', (await post('/api/razorpay/webhook', body, { 'x-razorpay-signature': 'f'.repeat(64), 'x-razorpay-event-id': 'evt_1' })).status === 401);
    check('webhook: signed with the API secret instead of the webhook secret → 401', (await post('/api/razorpay/webhook', body, { 'x-razorpay-signature': hmac(MOCK_KEY_SECRET, body), 'x-razorpay-event-id': 'evt_1' })).status === 401);
    check('webhook: re-serialized body does not match its signature → 401', (await post('/api/razorpay/webhook', JSON.stringify(JSON.parse(body), null, 2), { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_1' })).status === 401);
    check('webhook: missing event id → 400', (await post('/api/razorpay/webhook', body, { 'x-razorpay-signature': sig })).status === 400);
    const w = await post('/api/razorpay/webhook', body, { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_paid_1' });
    check('webhook: signed order.paid → handled, mandate funded from the REAL order', w.status === 200 && w.body.handled === true && w.body.mandateId === mid2, w);
    const dup = await post('/api/razorpay/webhook', body, { 'x-razorpay-signature': sig, 'x-razorpay-event-id': 'evt_paid_1' });
    check('webhook: replayed event id → acknowledged as duplicate, not re-run', dup.status === 200 && dup.body.duplicate === true, dup);
    const other = JSON.stringify({ event: 'refund.created', payload: {} });
    const o = await post('/api/razorpay/webhook', other, { 'x-razorpay-signature': hmac(WH, other), 'x-razorpay-event-id': 'evt_other' });
    check('webhook: an event Vitta does not act on is acknowledged, handled:false', o.status === 200 && o.body.handled === false, o);
    const bal2 = await j('/api/mandate');
    check('webhook: the announced mandate now shows ₹300', bal2.body.mandate.mandate_id === mid2 && bal2.body.balance.balanceInr === 300, bal2.body);
    const foreignBody = JSON.stringify({ event: 'order.paid', payload: { order: { entity: { id: 'order_NOTOURS12345' } } } });
    const f = await post('/api/razorpay/webhook', foreignBody, { 'x-razorpay-signature': hmac(WH, foreignBody), 'x-razorpay-event-id': 'evt_foreign' });
    check('webhook: an order that does not exist is not funded', f.status !== 200 || f.body.handled !== true, f);
  } finally {
    dash.kill('SIGTERM');
    await sb.cleanup();
  }
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed) console.log('--- dashboard log tail:\n' + log.split('\n').slice(-25).join('\n'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', e); process.exit(2); });
