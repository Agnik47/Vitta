// The decision log records what happened, not just what the gate decided: a mandate created, a payment
// received, a purchase that completed or failed, anything that failed before the gate was asked.
// Everything here runs through the real gate CLI (and the real Purchase Agent) against the sandbox.
// Needs the compiled gate — `npm test` builds first.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_MANDATE, createSandbox, sandboxSupported, type Sandbox } from '../agents/sandbox/harness';
import { CATALOG } from '../agents/sandbox/fake-webcmd';
import { createPurchaseAgent } from '../agents/purchase';
import { newCorrelation } from '../agents/a2a';
import { isActivityEvent, type ActivityEvent } from '../events/ActivityEvent';
import type { Proposal, ShoppingIntent } from '../agents/protocol';

const skip = sandboxSupported() ? false : 'sandbox needs a POSIX shell shim for webcmd';

describe('the decision log', { skip }, () => {
  let sb: Sandbox;
  beforeEach(async () => {
    sb = await createSandbox(DEMO_MANDATE);
  });
  afterEach(async () => {
    await sb.cleanup();
  });

  const log = (): Array<Record<string, unknown>> => {
    const file = path.join(sb.dir, 'events.jsonl');
    return existsSync(file) ? readFileSync(file, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [];
  };
  const activity = (action?: string): ActivityEvent[] => (log() as unknown[]).filter(isActivityEvent).filter((e) => !action || e.action === action);

  async function newMandate(): Promise<string> {
    const r = await sb.gate(['mandate', 'create', '--subject', 'agent:t', '--cap', '500', '--per-txn', '500', '--merchants', 'zepto', '--expires', '23:59']);
    const id = /MANDATE (mnd_[a-z0-9]+)/i.exec(r.stdout)?.[1];
    assert.ok(id, r.stdout + r.stderr);
    return id;
  }

  test('creating a mandate is on record, with its id and cap', async () => {
    const id = await newMandate();
    const created = activity('mandate.create').find((e) => e.mandate_id === id);
    assert.ok(created);
    assert.equal(created.outcome, 'SUCCESS');
    assert.equal(created.amount_inr, 500);
    assert.match(created.summary, /agent:t/);
  });

  test('a mandate request that fails is on record as a FAILURE with the reason', async () => {
    const r = await sb.gate(['mandate', 'create', '--subject', 'agent:t']); // no --cap
    assert.equal(r.ok, false);
    const failed = activity('mandate.create').find((e) => e.outcome === 'FAILURE');
    assert.ok(failed);
    assert.match(failed.error ?? '', /cap/i);
  });

  test('funding: the order, the refused attach while unpaid, and the verified payment are each recorded', async () => {
    const id = await newMandate();
    const fund = await sb.gate(['fund', id, '--amount', '500']);
    const ref = /reserve reference\s+(razorpay-order:\S+)/.exec(fund.stdout)?.[1];
    assert.ok(ref, fund.stdout);
    const orderId = ref.replace('razorpay-order:', '');

    const ordered = activity('payment.order_created').find((e) => e.mandate_id === id);
    assert.ok(ordered);
    assert.equal(ordered.outcome, 'SUCCESS');
    assert.equal(ordered.reserve_ref, ref);
    assert.equal(ordered.amount_inr, 500);

    // not paid yet → refused, and the refusal is on record
    const early = await sb.gate(['fund', id, '--reserve-ref', ref]);
    assert.equal(early.ok, false);
    const refused = activity('payment.received').find((e) => e.mandate_id === id && e.outcome === 'FAILURE');
    assert.ok(refused);
    assert.match(refused.error ?? '', /real balance of ₹0/);

    // paid → verified, and the funding receipt is referenced
    sb.razorpay.pay(orderId);
    const ok = await sb.gate(['fund', id, '--reserve-ref', ref]);
    assert.ok(ok.ok, ok.stdout + ok.stderr);
    const received = activity('payment.received').find((e) => e.mandate_id === id && e.outcome === 'SUCCESS');
    assert.ok(received);
    assert.equal(received.amount_inr, 500);
    assert.equal(received.reserve_ref, ref);
    assert.equal(received.receipt_id, `fnd_${orderId.replace('order_', '')}`);
  });

  test('a gate run that fails before it can decide is on record (it has no verdict, so no gate event)', async () => {
    const r = await sb.gate(['run', '--mode', 'bogus', '--', 'webcmd', 'blinkit', 'set-cart-quantity', 'x']);
    assert.equal(r.ok, false);
    const failed = activity('gate.run');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].outcome, 'FAILURE');
    assert.match(failed[0].summary, /webcmd blinkit set-cart-quantity/);
  });

  // ---- purchases -----------------------------------------------------------------------------------

  const intent: ShoppingIntent = { raw_request: 'buy atta', product_query: 'atta', category: 'groceries', quantity: 1, purchase_required: true, preferred_merchants: [], source: 'user' };
  const buy = (productIndex: number, requestId: string) => {
    const p = CATALOG.blinkit[productIndex];
    const proposal: Proposal = {
      proposed_action: 'purchase',
      selected: { merchant: 'blinkit', product_name: p.name, price_inr: p.price, availability: true, product_url: p.url, product_id: p.id, source: 'sandbox' },
      quantity: 1,
      expected_total_inr: p.price,
      reason: 'decision-log test',
      considered: 1,
      rejected: [],
    };
    return createPurchaseAgent()({ vitta: 1, correlation: newCorrelation({ requestId, mandateId: sb.mandateId }), input: { intent, proposal, mode: 'TEST', mandate_id: sb.mandateId } });
  };

  test('a completed purchase is on record with its receipt, run id and amount — and so is the cart being emptied', async () => {
    const result = await buy(0, 'req_log_ok');
    assert.equal(result.ok, true, JSON.stringify(result));
    const done = activity('purchase.completed');
    assert.equal(done.length, 1);
    assert.equal(done[0].outcome, 'SUCCESS');
    assert.equal(done[0].amount_inr, 245);
    assert.equal(done[0].mandate_id, sb.mandateId);
    assert.match(done[0].receipt_id ?? '', /^rcp_/);
    assert.ok(done[0].run_id);
    assert.equal(done[0].details?.mode, 'TEST');
    assert.equal(activity('cart.emptied')[0]?.outcome, 'SUCCESS');
  });

  test('a purchase the mandate REFUSES is on record as a failure with the deny code — next to the gate\'s own DENY event', async () => {
    const result = await buy(1, 'req_log_deny'); // ₹540 > the ₹500 per-transaction cap
    assert.equal(result.ok, false);
    const failed = activity('purchase.failed');
    assert.equal(failed.length, 1);
    assert.equal(failed[0].outcome, 'FAILURE');
    assert.match(failed[0].summary, /refused by the mandate \(OVER_PER_TXN_CAP\)/);
    assert.equal(activity('purchase.completed').length, 0);
    assert.ok(log().some((e) => e.verdict === 'DENY' && e.code === 'OVER_PER_TXN_CAP'), 'the gate\'s own decision is still recorded');
  });

  test('activity entries never carry a verdict, and the gate\'s events keep their exact shape', async () => {
    await buy(0, 'req_log_shape');
    for (const e of log()) {
      if (isActivityEvent(e)) {
        assert.equal('verdict' in e, false, 'an activity entry does not claim a gate decision');
        assert.ok(e.event_id && e.ts && e.summary);
      } else {
        assert.ok(['ALLOW', 'DENY', 'STEP_UP'].includes(e.verdict as string), 'a gate event is untouched');
        assert.equal('kind' in e, false);
      }
    }
    assert.ok(log().some((e) => !isActivityEvent(e)), 'gate events are still written');
  });
});
