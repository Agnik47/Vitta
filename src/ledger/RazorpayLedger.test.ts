import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RazorpayLedger, checkoutUrlFor, parseReserveRef, reserveRefFor } from './RazorpayLedger';
import { MOCK_KEY_ID, MOCK_KEY_SECRET, createMockRazorpay, mockFetch } from './mock-razorpay';
import { paymentSignature, verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature';

function setup(over: NodeJS.ProcessEnv = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vitta-rzp-'));
  const logPath = path.join(dir, 'razorpay-ledger.jsonl');
  const mock = createMockRazorpay();
  const env: NodeJS.ProcessEnv = { RAZORPAY_KEY_ID: MOCK_KEY_ID, RAZORPAY_KEY_SECRET: MOCK_KEY_SECRET, RAZORPAY_LEDGER_PATH: logPath, ...over };
  const ledger = new RazorpayLedger(mockFetch(mock), env);
  return { ledger, mock, env, logPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Fund an ₹800 order for mnd_1 and have the customer pay it in full. */
async function fundedAndPaid(t: ReturnType<typeof setup>, paise = 80000) {
  const { reserveRef } = await t.ledger.fund('mnd_1', paise);
  const orderId = parseReserveRef(reserveRef);
  t.mock.pay(orderId);
  return { reserveRef, orderId };
}

// ---- fund -----------------------------------------------------------------------------------

test('fund creates a Razorpay order stamped with the mandate, and returns a reserve ref and checkout URL', async () => {
  const t = setup({ RAZORPAY_CHECKOUT_BASE_URL: 'https://dash.example.com/' });
  try {
    const { reserveRef, checkoutUrl } = await t.ledger.fund('mnd_abc123', 80000);
    const orderId = parseReserveRef(reserveRef);
    assert.match(reserveRef, /^razorpay-order:order_/);
    assert.equal(checkoutUrl, `https://dash.example.com/pay/razorpay/${orderId}`);

    const order = t.mock.orders.get(orderId)!;
    assert.equal(order.amount, 80000);
    assert.equal(order.currency, 'INR');
    assert.equal(order.notes.vitta_mandate_id, 'mnd_abc123');
    assert.equal(order.notes.vitta_spent_paise, '0');
    assert.ok((order.receipt ?? '').length <= 40, 'Razorpay caps receipt at 40 characters');
    assert.match(order.receipt ?? '', /^mnd_abc123-/);
  } finally {
    t.cleanup();
  }
});

test('fund refuses amounts below ₹1 and non-integer paise before any request is made', async () => {
  const t = setup();
  try {
    await assert.rejects(() => t.ledger.fund('mnd_1', 50), /minimum 100/);
    await assert.rejects(() => t.ledger.fund('mnd_1', 100.5), /integer paise/);
    assert.equal(t.mock.requests.length, 0);
  } finally {
    t.cleanup();
  }
});

test('LIVE keys are refused outright — test mode only — and no request is ever sent', async () => {
  const t = setup({ RAZORPAY_KEY_ID: 'rzp_live_abcdefghijklmn' });
  try {
    await assert.rejects(() => t.ledger.fund('mnd_1', 80000), /not a test-mode key/);
    await assert.rejects(() => t.ledger.balance(reserveRefFor('order_ABCDEFGH')), /not a test-mode key/);
    assert.equal(t.mock.requests.length, 0);
  } finally {
    t.cleanup();
  }
});

test('missing credentials fail with a clear message', async () => {
  const t = setup({ RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' });
  try {
    await assert.rejects(() => t.ledger.fund('mnd_1', 80000), /RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not set/);
  } finally {
    t.cleanup();
  }
});

test('a wrong secret is rejected by Razorpay and the error never echoes the secret', async () => {
  const t = setup({ RAZORPAY_KEY_SECRET: 'not-the-secret-xyz' });
  try {
    await assert.rejects(
      () => t.ledger.fund('mnd_1', 80000),
      (e: Error) => /Authentication failed/.test(e.message) && !e.message.includes('not-the-secret-xyz'),
    );
  } finally {
    t.cleanup();
  }
});

// ---- balance --------------------------------------------------------------------------------

test('an unpaid order is worth ₹0; once captured, the full amount', async () => {
  const t = setup();
  try {
    const unpaid = await t.ledger.fund('mnd_2', 50000);
    assert.equal(await t.ledger.balance(unpaid.reserveRef), 0);
    const { reserveRef } = await fundedAndPaid(t);
    assert.equal(await t.ledger.balance(reserveRef), 80000);
  } finally {
    t.cleanup();
  }
});

test('authorized-but-uncaptured and failed payments are worth ₹0', async () => {
  const t = setup();
  try {
    const { reserveRef } = await t.ledger.fund('mnd_1', 80000);
    const orderId = parseReserveRef(reserveRef);
    t.mock.pay(orderId, { status: 'failed' });
    t.mock.pay(orderId, { status: 'authorized' });
    assert.equal(await t.ledger.balance(reserveRef), 0);
  } finally {
    t.cleanup();
  }
});

test('a payment refunded after funding no longer counts (the order still reads "paid", the ledger does not)', async () => {
  const t = setup();
  try {
    const { reserveRef, orderId } = await fundedAndPaid(t);
    const pay = [...t.mock.payments.values()].find((p) => p.order_id === orderId)!;
    t.mock.handle('POST', `/v1/payments/${pay.id}/refund`, `Basic ${Buffer.from(`${MOCK_KEY_ID}:${MOCK_KEY_SECRET}`).toString('base64')}`, { amount: 30000 });
    assert.equal(await t.ledger.balance(reserveRef), 50000);
  } finally {
    t.cleanup();
  }
});

test('an order Vitta did not create is refused as a reserve', async () => {
  const t = setup();
  try {
    const foreign = t.mock.handle('POST', '/v1/orders', `Basic ${Buffer.from(`${MOCK_KEY_ID}:${MOCK_KEY_SECRET}`).toString('base64')}`, { amount: 10000, currency: 'INR', notes: { something: 'else' } });
    const id = (foreign.json as { id: string }).id;
    t.mock.pay(id);
    await assert.rejects(() => t.ledger.balance(reserveRefFor(id)), /not created by Vitta/);
  } finally {
    t.cleanup();
  }
});

test('reserve refs are validated: legacy Prava refs, junk and traversal are refused with a clear reason', () => {
  for (const bad of ['prava-session:s:vitta_mnd_1', 'mdt_123', 'razorpay-order:', 'razorpay-order:../x', 'razorpay-order:order_', 'order_ABCDEFGH', '']) {
    assert.throws(() => parseReserveRef(bad), /Invalid Razorpay reserve reference/, bad);
  }
  assert.equal(parseReserveRef('razorpay-order:order_ABCDEFGH12'), 'order_ABCDEFGH12');
  assert.match(checkoutUrlFor('order_X1', {}), /^http:\/\/localhost:3000\/pay\/razorpay\/order_X1$/);
});

// ---- draw -----------------------------------------------------------------------------------

test('draw debits the reserve and records the spend on Razorpay too', async () => {
  const t = setup();
  try {
    const { reserveRef, orderId } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    assert.equal(await t.ledger.balance(reserveRef), 80000 - 22900);
    assert.equal(t.mock.spentPaise(orderId), 22900, 'the spend is recorded server-side, on the order’s notes');
    assert.equal(t.mock.orders.get(orderId)!.notes.vitta_last_ref, 'run-1');
    assert.equal(t.mock.orders.get(orderId)!.notes.vitta_mandate_id, 'mnd_1', 'existing notes are preserved');
  } finally {
    t.cleanup();
  }
});

test('draw is idempotent on runId: a replay never debits twice and makes no further write', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    const writesBefore = t.mock.requests.filter((r) => r.method === 'PATCH').length;
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    assert.equal(await t.ledger.balance(reserveRef), 80000 - 22900);
    assert.equal(t.mock.requests.filter((r) => r.method === 'PATCH').length, writesBefore);
  } finally {
    t.cleanup();
  }
});

test('draw refuses more than the reserve holds, and leaves nothing behind', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t, 50000);
    await t.ledger.draw(reserveRef, 40000, 'run-1');
    await assert.rejects(() => t.ledger.draw(reserveRef, 20000, 'run-2'), /Insufficient Razorpay reserve.*₹200\.00 requested, ₹100\.00 available/);
    assert.equal(await t.ledger.balance(reserveRef), 10000);
    await assert.rejects(() => t.ledger.draw(reserveRef, 0, 'run-3'), /positive integer paise/);
    await assert.rejects(() => t.ledger.draw(reserveRef, 100, ''), /needs a runId/);
  } finally {
    t.cleanup();
  }
});

test('an unpaid or merely authorized reserve cannot be drawn against', async () => {
  const t = setup();
  try {
    const { reserveRef } = await t.ledger.fund('mnd_1', 80000);
    await assert.rejects(() => t.ledger.draw(reserveRef, 100, 'run-1'), /Insufficient Razorpay reserve/);
    t.mock.pay(parseReserveRef(reserveRef), { status: 'authorized' });
    await assert.rejects(() => t.ledger.draw(reserveRef, 100, 'run-2'), /Insufficient Razorpay reserve/);
  } finally {
    t.cleanup();
  }
});

test('deleting the local ledger file does NOT give spent money back — Razorpay’s own record still counts', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 60000, 'run-1');
    rmSync(t.logPath); // someone wipes the local log to "restore" the balance
    assert.equal(await t.ledger.balance(reserveRef), 20000);
    await assert.rejects(() => t.ledger.draw(reserveRef, 30000, 'run-2'), /Insufficient/);
  } finally {
    t.cleanup();
  }
});

test('and tampering the other way (editing the order note down) does not help either — the local log still counts', async () => {
  const t = setup();
  try {
    const { reserveRef, orderId } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 60000, 'run-1');
    t.mock.orders.get(orderId)!.notes.vitta_spent_paise = '0';
    assert.equal(await t.ledger.balance(reserveRef), 20000);
  } finally {
    t.cleanup();
  }
});

test('if recording the draw on Razorpay fails, nothing is drawn: the debit is voided and the error says so', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    t.mock.failWhen = (r) => r.method === 'PATCH';
    await assert.rejects(() => t.ledger.draw(reserveRef, 22900, 'run-1'), /nothing was drawn/);
    t.mock.failWhen = undefined;
    assert.equal(await t.ledger.balance(reserveRef), 80000, 'the voided debit does not count');
    // …and the same runId can be retried afterwards
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    assert.equal(await t.ledger.balance(reserveRef), 80000 - 22900);
  } finally {
    t.cleanup();
  }
});

test('concurrent draws cannot together overspend the reserve', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t, 50000);
    const results = await Promise.allSettled([
      t.ledger.draw(reserveRef, 30000, 'run-a'),
      t.ledger.draw(reserveRef, 30000, 'run-b'),
      t.ledger.draw(reserveRef, 30000, 'run-c'),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one of three ₹300 draws fits in ₹500');
    assert.equal(await t.ledger.balance(reserveRef), 20000);
  } finally {
    t.cleanup();
  }
});

test('a torn trailing line in the local log is ignored, not fatal', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 10000, 'run-1');
    writeFileSync(t.logPath, '{"kind":"debit","reserveRef":"x"', { flag: 'a' });
    assert.equal(await t.ledger.balance(reserveRef), 70000);
  } finally {
    t.cleanup();
  }
});

// ---- credit / release / settle / owner ------------------------------------------------------

test('credit is rejected: an agent can never add money to a reserve', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    await assert.rejects(() => t.ledger.credit(reserveRef, 10000, 'topup'), /cannot be topped up/);
    assert.equal(t.mock.requests.filter((r) => r.method === 'POST').length, 1, 'only the original order creation');
  } finally {
    t.cleanup();
  }
});

test('release zeroes the reserve, then refunds only the unspent amount', async () => {
  const t = setup();
  try {
    const { reserveRef, orderId } = await fundedAndPaid(t);
    await t.ledger.draw(reserveRef, 22900, 'run-1');
    await t.ledger.release(reserveRef);
    assert.equal(await t.ledger.balance(reserveRef), 0);
    const pay = [...t.mock.payments.values()].find((p) => p.order_id === orderId)!;
    assert.equal(pay.amount_refunded, 80000 - 22900, 'spent money is not refunded');
    await t.ledger.release(reserveRef); // idempotent
    assert.equal(pay.amount_refunded, 80000 - 22900);
    await assert.rejects(() => t.ledger.draw(reserveRef, 100, 'run-2'), /released|Insufficient/);
  } finally {
    t.cleanup();
  }
});

test('if the refund fails, the reserve is already zero: money is stuck (safe), never refunded AND spendable', async () => {
  const t = setup();
  try {
    const { reserveRef } = await fundedAndPaid(t);
    t.mock.failWhen = (r) => r.path.endsWith('/refund');
    await assert.rejects(() => t.ledger.release(reserveRef));
    t.mock.failWhen = undefined;
    assert.equal(await t.ledger.balance(reserveRef), 0);
  } finally {
    t.cleanup();
  }
});

test('settle captures authorized payments with the exact authorized amount, once', async () => {
  const t = setup();
  try {
    const { reserveRef } = await t.ledger.fund('mnd_1', 80000);
    const orderId = parseReserveRef(reserveRef);
    const auth = t.mock.pay(orderId, { status: 'authorized' });
    assert.equal(await t.ledger.balance(reserveRef), 0);
    assert.deepEqual(await t.ledger.settle(reserveRef), { captured: [auth.id] });
    assert.equal(await t.ledger.balance(reserveRef), 80000);
    assert.deepEqual(await t.ledger.settle(reserveRef), { captured: [] }, 'idempotent');
    const capture = t.mock.requests.find((r) => r.path.endsWith('/capture'))!;
    assert.deepEqual(capture.body, { amount: 80000, currency: 'INR' });
  } finally {
    t.cleanup();
  }
});

test('reserveOwner returns the mandate the order was created for', async () => {
  const t = setup();
  try {
    const { reserveRef } = await t.ledger.fund('mnd_owner1', 80000);
    assert.equal(await t.ledger.reserveOwner(reserveRef), 'mnd_owner1');
  } finally {
    t.cleanup();
  }
});

// ---- signatures -----------------------------------------------------------------------------

test('checkout signature is HMAC-SHA256(order_id|payment_id, key_secret) and verifies only that', () => {
  const expected = createHmac('sha256', 'secret').update('order_A1|pay_B2').digest('hex');
  assert.equal(paymentSignature('order_A1', 'pay_B2', 'secret'), expected);
  assert.equal(verifyPaymentSignature('order_A1', 'pay_B2', expected, 'secret'), true);
  assert.equal(verifyPaymentSignature('order_A1', 'pay_B2', expected.toUpperCase(), 'secret'), true, 'hex is case-insensitive');
  assert.equal(verifyPaymentSignature('order_A1', 'pay_OTHER', expected, 'secret'), false, 'bound to the payment id');
  assert.equal(verifyPaymentSignature('order_OTHER', 'pay_B2', expected, 'secret'), false, 'bound to the order id');
  assert.equal(verifyPaymentSignature('order_A1', 'pay_B2', expected, 'wrong-secret'), false);
  for (const bad of ['', 'zz', expected.slice(0, -2), expected + '00', 'not hex at all!']) {
    assert.equal(verifyPaymentSignature('order_A1', 'pay_B2', bad, 'secret'), false, bad);
  }
  assert.equal(verifyPaymentSignature('order_A1', 'pay_B2', expected, ''), false, 'an empty secret never verifies');
});

test('webhook signature is HMAC-SHA256 over the RAW body with the webhook secret', () => {
  const raw = '{"event":"order.paid","payload":{}}';
  const sig = createHmac('sha256', 'whsec').update(raw).digest('hex');
  assert.equal(verifyWebhookSignature(raw, sig, 'whsec'), true);
  assert.equal(verifyWebhookSignature(Buffer.from(raw), sig, 'whsec'), true);
  assert.equal(verifyWebhookSignature(raw + ' ', sig, 'whsec'), false, 'one extra byte breaks it');
  assert.equal(verifyWebhookSignature(JSON.stringify(JSON.parse(raw)), sig, 'whsec'), true, 'compact JSON round-trips identically here');
  assert.equal(verifyWebhookSignature(JSON.stringify(JSON.parse(raw), null, 2), sig, 'whsec'), false, 'a re-serialized body is not the raw body');
  assert.equal(verifyWebhookSignature(raw, sig, ''), false);
  assert.equal(verifyWebhookSignature(raw, 'short', 'whsec'), false);
});
