// `gate fund` end to end against the Razorpay mock, through the REAL gate CLI: the funding rules that
// decide whether a reserve is spendable. (The spend-side guarantees are in agents/e2e.test.ts.)
// Needs the compiled gate — `npm test` builds first.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createPublicKey } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { verifyFundingReceipt, type FundingReceipt } from '../receipt/funding';
import { DEMO_MANDATE, createSandbox, sandboxSupported, type Sandbox } from '../agents/sandbox/harness';

const skip = sandboxSupported() ? false : 'sandbox needs a POSIX shell shim for webcmd';

describe('gate fund with Razorpay', { skip }, () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await createSandbox(DEMO_MANDATE);
  });
  afterEach(async () => {
    await sb.cleanup();
  });

  const readMandate = (id: string) => JSON.parse(readFileSync(path.join(sb.dir, 'mandates', `${id}.json`), 'utf-8'));

  /** A second, unfunded mandate for the same issuer. */
  async function newMandate(): Promise<string> {
    const r = await sb.gate(['mandate', 'create', '--subject', 'agent:t', '--cap', '500', '--per-txn', '500', '--merchants', 'zepto', '--expires', '23:59']);
    const id = /MANDATE (mnd_[a-z0-9]+)/i.exec(r.stdout)?.[1];
    assert.ok(id, r.stdout + r.stderr);
    return id;
  }

  /** `gate fund <id> --amount 500` → the new order's id. */
  async function orderFor(mandateId: string): Promise<string> {
    const r = await sb.gate(['fund', mandateId, '--amount', '500']);
    assert.ok(r.ok, r.stdout + r.stderr);
    const ref = /reserve reference\s+razorpay-order:(order_\S+)/.exec(r.stdout)?.[1];
    assert.ok(ref, r.stdout);
    return ref;
  }

  test('the funded sandbox mandate is signed with a razorpay_test_order reserve and the REAL paid balance', () => {
    const m = readMandate(sb.mandateId);
    assert.equal(m.reserve.type, 'razorpay_test_order');
    assert.equal(m.reserve.ref, `razorpay-order:${sb.orderId}`);
    assert.equal(m.reserve.blocked_inr, 800);
    assert.equal(sb.remainingInr(), 800);
  });

  test('`gate fund --amount` creates an order and prints the reserve reference and a checkout URL', async () => {
    const id = await newMandate();
    const r = await sb.gate(['fund', id, '--amount', '500']);
    assert.match(r.stdout, /reserve reference\s+razorpay-order:order_/);
    assert.match(r.stdout, /checkout required: pay the test order at http:\/\/localhost:3000\/pay\/razorpay\/order_/);
    assert.equal(readMandate(id).reserve.blocked_inr, 500);
  });

  test('attaching an order that has not been PAID is refused: a mandate never claims money that is not there', async () => {
    const id = await newMandate();
    const orderId = await orderFor(id);
    const r = await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.equal(r.ok, false);
    assert.match(r.stdout + r.stderr, /real balance of ₹0/);
  });

  const fundingReceiptFile = (orderId: string) => path.join(sb.dir, 'funding-receipts', `fnd_${orderId.replace(/^order_/, '')}.json`);
  const readFundingReceipt = (orderId: string) => JSON.parse(readFileSync(fundingReceiptFile(orderId), 'utf-8')) as FundingReceipt;

  test('attaching a PAID order writes a signed funding receipt built from Razorpay\'s own payment records', async () => {
    const id = await newMandate();
    const orderId = await orderFor(id);
    const pay = sb.razorpay.pay(orderId);
    const r = await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.ok(r.ok, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`FUNDING RECEIPT fnd_${orderId.replace('order_', '')} signed · ₹500`));

    const receipt = readFundingReceipt(orderId);
    assert.equal(receipt.mandate_id, id);
    assert.equal(receipt.order_id, orderId);
    assert.equal(receipt.amount_inr, 500);
    assert.equal(receipt.mode, 'TEST');
    assert.deepEqual(receipt.payments.map((p) => ({ id: p.id, amount_inr: p.amount_inr, method: p.method })), [{ id: pay.id, amount_inr: 500, method: 'card' }]);
    const gateKey = createPublicKey(readFileSync(path.join(sb.dir, 'keys', 'gate.public.pem'), 'utf-8'));
    assert.equal(verifyFundingReceipt(receipt, gateKey), true, 'signed with the gate key');
    assert.equal(verifyFundingReceipt({ ...receipt, amount_inr: 5000 }, gateKey), false, 'and tamper-evident');
  });

  test('NO funding receipt exists for an order that was refused as unpaid', async () => {
    const id = await newMandate();
    const orderId = await orderFor(id);
    await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.equal(existsSync(fundingReceiptFile(orderId)), false);
  });

  test('re-attaching the same paid order keeps the FIRST funding receipt untouched', async () => {
    const id = await newMandate();
    const orderId = await orderFor(id);
    sb.razorpay.pay(orderId);
    await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    const first = readFileSync(fundingReceiptFile(orderId), 'utf-8');
    const again = await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.ok(again.ok, again.stdout + again.stderr);
    assert.match(again.stdout, /already on file/);
    assert.equal(readFileSync(fundingReceiptFile(orderId), 'utf-8'), first, 'same bytes: not re-issued');
  });

  test('a reserve can only be attached to the mandate it was created for', async () => {
    const other = await newMandate();
    const orderId = await orderFor(other);
    sb.razorpay.pay(orderId);
    const r = await sb.gate(['fund', sb.mandateId, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.equal(r.ok, false);
    assert.match(r.stdout + r.stderr, new RegExp(`created for mandate ${other}, not ${sb.mandateId}`));
    // …and attaching it to its own mandate works
    const own = await sb.gate(['fund', other, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.ok(own.ok, own.stdout + own.stderr);
    assert.equal(readMandate(other).reserve.blocked_inr, 500);
  });

  test('an order Vitta did not create cannot be attached as a reserve', async () => {
    const id = await newMandate();
    const auth = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
    const foreign = sb.razorpay.handle('POST', '/v1/orders', auth, { amount: 50000, currency: 'INR', notes: { something: 'else' } }).json as { id: string };
    sb.razorpay.pay(foreign.id);
    const r = await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${foreign.id}`]);
    assert.equal(r.ok, false);
    assert.match(r.stdout + r.stderr, /not created by Vitta/);
  });

  test('an AUTHORIZED (uncaptured) payment is captured when the human confirms funding — and only then counts', async () => {
    const id = await newMandate();
    const orderId = await orderFor(id);
    const pay = sb.razorpay.pay(orderId, { status: 'authorized' });
    assert.equal(sb.razorpay.paidPaise(orderId), 0, 'authorized money is not paid');
    const r = await sb.gate(['fund', id, '--reserve-ref', `razorpay-order:${orderId}`]);
    assert.ok(r.ok, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`captured 1 authorized payment\\(s\\): ${pay.id}`));
    assert.equal(sb.razorpay.paidPaise(orderId), 50000);
    assert.equal(readMandate(id).reserve.blocked_inr, 500);
    // the receipt records the payment as CAPTURED money, which it only became on this confirmation
    assert.deepEqual(readFundingReceipt(orderId).payments.map((p) => p.id), [pay.id]);
  });

  test('funding a mandate that still holds money is refused (it would strand the old order), unless --replace is given', async () => {
    const before = sb.razorpay.orders.size;
    const r = await sb.gate(['fund', sb.mandateId, '--amount', '300']);
    assert.equal(r.ok, false);
    assert.match(r.stdout + r.stderr, /already has a funded reserve .* with ₹800 left/);
    assert.equal(sb.razorpay.orders.size, before, 'no dangling order was created');
    assert.equal(readMandate(sb.mandateId).reserve.ref, `razorpay-order:${sb.orderId}`, 'the mandate still points at its funded reserve');

    const forced = await sb.gate(['fund', sb.mandateId, '--amount', '300', '--replace']);
    assert.ok(forced.ok, forced.stdout + forced.stderr);
    assert.notEqual(readMandate(sb.mandateId).reserve.ref, `razorpay-order:${sb.orderId}`);
  });

  test('attaching a DIFFERENT paid order to a mandate that still holds money is refused too', async () => {
    // A second, paid order stamped for THIS mandate (created directly so the mandate's reserve is untouched).
    const auth = `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`;
    const second = sb.razorpay.handle('POST', '/v1/orders', auth, { amount: 30000, currency: 'INR', notes: { vitta_mandate_id: sb.mandateId, vitta_spent_paise: '0' } }).json as { id: string };
    sb.razorpay.pay(second.id);
    const r = await sb.gate(['fund', sb.mandateId, '--reserve-ref', `razorpay-order:${second.id}`]);
    assert.equal(r.ok, false);
    assert.match(r.stdout + r.stderr, /already has a funded reserve/);
    assert.equal(readMandate(sb.mandateId).reserve.ref, `razorpay-order:${sb.orderId}`);
  });

  test('re-attaching the SAME reserve is always fine (idempotent)', async () => {
    const again = await sb.gate(['fund', sb.mandateId, '--reserve-ref', `razorpay-order:${sb.orderId}`]);
    assert.ok(again.ok, again.stdout + again.stderr);
  });

  test('a junk or legacy reserve reference is refused with a clear reason', async () => {
    const id = await newMandate();
    for (const ref of ['prava-session:s1:vitta_x', 'mdt_123', 'order_notprefixed']) {
      const r = await sb.gate(['fund', id, '--reserve-ref', ref]);
      assert.equal(r.ok, false, ref);
      assert.match(r.stdout + r.stderr, /Invalid Razorpay reserve reference/, ref);
    }
  });

  test('`gate fund --auto` (an automatic top-up) is refused twice over: by the mandate cap, and by the ledger itself', async () => {
    // 1. Past the mandate's own signed cap, the gate refuses before the ledger is even asked.
    const overCap = await sb.gate(['fund', sb.mandateId, '--auto', '--amount', '10']);
    assert.equal(overCap.ok, false);
    assert.match(overCap.stdout + overCap.stderr, /over the mandate's ₹800 cap/);

    // 2. Within the cap, the ledger still rejects it: an order cannot be topped up, and an agent
    //    must never be able to add money.
    await sb.cleanup();
    sb = await createSandbox({ ...DEMO_MANDATE, cap: 1000 });
    const withinCap = await sb.gate(['fund', sb.mandateId, '--auto', '--amount', '10']);
    assert.equal(withinCap.ok, false);
    assert.match(withinCap.stdout + withinCap.stderr, /cannot be topped up/);
    assert.equal(sb.remainingInr(), 800);
  });

  test('a LIVE Razorpay key is refused by the gate before any request is made', async () => {
    const id = await newMandate();
    const before = sb.razorpay.requests.length;
    const saved = process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abcdefghijklmn';
    try {
      const r = await sb.gate(['fund', id, '--amount', '500']);
      assert.equal(r.ok, false);
      assert.match(r.stdout + r.stderr, /not a test-mode key/);
      assert.equal(sb.razorpay.requests.length, before, 'no request reached Razorpay');
    } finally {
      process.env.RAZORPAY_KEY_ID = saved;
    }
  });
});
