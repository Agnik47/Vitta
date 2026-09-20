import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PurchaseInput, PurchaseResult } from '../agent/PurchaseAgent';
import { memoryIdempotencyStore } from './idempotency';
import { CAN_CLEAR_CART, createPurchaseAgent, outcomeError, toOutcome, type MandateSummary, type PurchaseDeps } from './purchase';
import { newCorrelation } from './a2a';
import type { Candidate, PurchaseOutcome, Proposal, ShoppingIntent } from './protocol';

const mandate: MandateSummary = { mandate_id: 'mnd_test', per_txn_inr: 500, cap_inr: 800 };

const intent: ShoppingIntent = {
  raw_request: 'x',
  product_query: 'atta 2kg',
  category: 'groceries',
  quantity: 1,
  purchase_required: true,
  preferred_merchants: [],
  source: 'user',
};

const zeptoCandidate: Candidate = {
  merchant: 'zepto',
  product_name: 'Aashirvaad Atta 2kg',
  price_inr: 229,
  availability: true,
  product_url: 'https://www.zeptonow.com/pn/aashirvaad-atta-2kg/pvid/abc',
  product_id: 'zp-1',
  source: 'test',
};

const proposal: Proposal = { proposed_action: 'purchase', selected: zeptoCandidate, quantity: 1, expected_total_inr: 229, reason: 'cheapest', considered: 3, rejected: [] };

function result(over: Partial<PurchaseResult>): PurchaseResult {
  return {
    ok: false,
    merchant: 'zepto',
    mode: 'TEST',
    productName: 'Aashirvaad Atta 2kg',
    items: [],
    awaitingMerchantConfirmation: false,
    handoff: false,
    paymentStatus: 'not_charged',
    events: [],
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:01.000Z',
    ...over,
  };
}

function deps(over: Partial<PurchaseDeps> & { purchase?: PurchaseResult } = {}): { deps: PurchaseDeps; calls: PurchaseInput[] } {
  const calls: PurchaseInput[] = [];
  return {
    calls,
    deps: {
      runPurchase: async (input) => {
        calls.push(input);
        return over.purchase ?? result({ ok: true, verdict: 'ALLOW', receiptId: 'rcp_1', authorizationId: 'auth_1', finalAmountInr: 229, paymentStatus: 'captured' });
      },
      readCartItemCount: async () => ({ ok: true, itemCount: 0 }),
      currentMandate: () => mandate,
      runIdFor: () => 'run-uuid',
      idempotency: memoryIdempotencyStore(),
      ...over,
    },
  };
}

function ask(agent: ReturnType<typeof createPurchaseAgent>, input: unknown, requestId = 'req_1') {
  return agent({ vitta: 1, correlation: newCorrelation({ requestId }), input });
}

const validInput = { intent, proposal, mode: 'TEST' };

// --- outcome mapping ---------------------------------------------------------------------------

test('an ALLOWed, receipted purchase maps to PURCHASED with the gate’s ids', () => {
  const o = toOutcome(result({ ok: true, verdict: 'ALLOW', receiptId: 'rcp_1', authorizationId: 'auth_1', finalAmountInr: 229 }), mandate, 'run-1');
  assert.equal(o.status, 'PURCHASED');
  assert.equal(o.receipt_id, 'rcp_1');
  assert.equal(o.run_id, 'run-1');
  assert.equal(o.requested_amount_inr, 229);
  assert.equal(outcomeError(o), undefined);
});

test('OVER_PER_TXN_CAP: reason, both amounts and the mandate id all survive', () => {
  const o = toOutcome(result({ verdict: 'DENY', denyCode: 'OVER_PER_TXN_CAP', finalAmountInr: 1299, failureReason: 'DENY zepto/place-order' }), mandate, undefined);
  assert.equal(o.status, 'DENIED');
  assert.equal(o.deny_code, 'OVER_PER_TXN_CAP');
  assert.equal(o.reason, 'OVER_PER_TXN_CAP');
  assert.equal(o.requested_amount_inr, 1299);
  assert.equal(o.allowed_amount_inr, 500);
  assert.equal(o.mandate_id, 'mnd_test');
  const err = outcomeError(o);
  assert.equal(err?.code, 'VITTA_DENIED');
  assert.match(err?.message ?? '', /OVER_PER_TXN_CAP/);
  assert.match(err?.message ?? '', /₹1,299/);
  assert.match(err?.message ?? '', /limit ₹500/);
  assert.match(err?.message ?? '', /not executed/);
  assert.deepEqual(err?.details, o);
});

test('a DENY at an EARLIER gated write is still a DENY — recovered from the gate’s own line', () => {
  // PurchaseAgent reports an add-to-cart denial as a pre-authorization failure with no verdict.
  const gateText =
    'Could not add Aashirvaad Atta 2kg to the cart: › zepto add-to-cart https://x --quantity 1\nDENY  zepto/add-to-cart · EXPIRED · ₹0\n  reserve untouched\n  NO BROWSER ACTION TAKEN';
  const o = toOutcome(result({ failureReason: gateText }), mandate, undefined);
  assert.equal(o.status, 'DENIED');
  assert.equal(o.deny_code, 'EXPIRED');
  assert.equal(o.verdict, 'DENY');
  assert.equal(outcomeError(o)?.code, 'VITTA_DENIED');
});

test('STEP_UP maps to VITTA_STEP_UP_REQUIRED', () => {
  const o = toOutcome(result({ verdict: 'STEP_UP', failureReason: 'merchant blocked checkout' }), mandate, undefined);
  assert.equal(o.status, 'STEP_UP_REQUIRED');
  assert.equal(outcomeError(o)?.code, 'VITTA_STEP_UP_REQUIRED');
});

test('authorized but not merchant-confirmed is its own state, never PURCHASED', () => {
  const o = toOutcome(result({ verdict: 'ALLOW', authorizationId: 'auth_9', awaitingMerchantConfirmation: true, failureReason: 'not confirmed' }), mandate, 'run-9');
  assert.equal(o.status, 'AWAITING_MERCHANT');
  assert.equal(o.authorization_id, 'auth_9');
  assert.equal(outcomeError(o)?.code, 'PURCHASE_ERROR');
  assert.equal(o.receipt_id, undefined);
});

test('an unreachable ledger is called out as LEDGER_ERROR, not a mystery cap denial', () => {
  const o = toOutcome(result({ failureReason: '(reserve balance read failed — treating as ₹0, which will DENY: fetch failed)' }), mandate, undefined);
  assert.equal(o.ledger_unreachable, true);
  assert.equal(outcomeError(o)?.code, 'LEDGER_ERROR');
});

test('any other failure is PURCHASE_ERROR with the original text preserved', () => {
  const o = toOutcome(result({ failureReason: 'Could not read the real cart after adding' }), mandate, undefined);
  assert.equal(o.status, 'FAILED');
  assert.match(o.reason ?? '', /Could not read the real cart/);
  assert.equal(outcomeError(o)?.code, 'PURCHASE_ERROR');
});

// --- the agent ---------------------------------------------------------------------------------

test('a valid proposal is handed to PurchaseAgent with a resolved ref, the given mode, and NO mandate id (no auto-funding)', async () => {
  const { deps: d, calls } = deps();
  const r = await ask(createPurchaseAgent(d), validInput);
  assert.ok(r.ok);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].merchant, 'zepto');
  assert.equal(calls[0].mode, 'TEST');
  assert.equal(calls[0].items[0].productRef, zeptoCandidate.product_url);
  assert.equal(calls[0].mandateId, undefined);
  assert.equal(calls[0].clearCartFirst, false); // zepto has no clear-cart command
});

test('blinkit is cleared first (it has a clear-cart command); no separate cart read is needed', async () => {
  const { deps: d, calls } = deps({ readCartItemCount: async () => { throw new Error('should not be called for blinkit'); } });
  const r = await ask(createPurchaseAgent(d), {
    intent,
    proposal: { ...proposal, selected: { ...zeptoCandidate, merchant: 'blinkit', product_id: 'bk-1', product_url: undefined } },
    mode: 'TEST',
  });
  assert.ok(r.ok);
  assert.equal(calls[0].clearCartFirst, true);
});

test('a Vitta denial comes back as VITTA_DENIED carrying the full outcome', async () => {
  const { deps: d } = deps({ purchase: result({ verdict: 'DENY', denyCode: 'OVER_PER_TXN_CAP', finalAmountInr: 1299, failureReason: 'x' }) });
  const r = await ask(createPurchaseAgent(d), validInput);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, 'VITTA_DENIED');
    const details = r.error.details as PurchaseOutcome;
    assert.equal(details.deny_code, 'OVER_PER_TXN_CAP');
    assert.equal(details.requested_amount_inr, 1299);
    assert.equal(details.allowed_amount_inr, 500);
  }
});

test('mode must be stated: a missing or invalid mode is refused, not defaulted', async () => {
  const { deps: d, calls } = deps();
  for (const mode of [undefined, 'live', 'PROD', 1]) {
    const r = await ask(createPurchaseAgent(d), { intent, proposal, mode }, `req_${String(mode)}`);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, 'INVALID_REQUEST');
  }
  assert.equal(calls.length, 0);
});

test('a proposal that is not a purchase is never sent to the gate', async () => {
  const { deps: d, calls } = deps();
  const r = await ask(createPurchaseAgent(d), { intent, proposal: { ...proposal, proposed_action: 'none' }, mode: 'TEST' });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('a non-empty cart at a merchant with no clear-cart is refused, not bought on top of', async () => {
  const { deps: d, calls } = deps({ readCartItemCount: async () => ({ ok: true, itemCount: 2 }) });
  const r = await ask(createPurchaseAgent(d), validInput);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.code, 'PURCHASE_ERROR');
    assert.match(r.error.message, /already holds 2 item/);
  }
  assert.equal(calls.length, 0);
});

test('an unreadable cart fails closed', async () => {
  const { deps: d, calls } = deps({ readCartItemCount: async () => ({ ok: false, message: 'not logged in' }) });
  const r = await ask(createPurchaseAgent(d), validInput);
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('a URL for the wrong merchant is refused before any browser work', async () => {
  const { deps: d, calls } = deps();
  const evil = { ...proposal, selected: { ...zeptoCandidate, product_url: 'https://evil.example.com/x' } };
  const r = await ask(createPurchaseAgent(d), { intent, proposal: evil, mode: 'TEST' });
  assert.equal(r.ok, false);
  assert.equal(calls.length, 0);
});

test('mandate mismatch: the caller’s expected mandate is not the one the gate will use → refused', async () => {
  const { deps: d, calls } = deps();
  const r = await ask(createPurchaseAgent(d), { ...validInput, mandate_id: 'mnd_other' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error.message, /Mandate mismatch/);
  assert.equal(calls.length, 0);
});

test('REPLAY: the same request id never runs the purchase twice — it returns the first result', async () => {
  const { deps: d, calls } = deps();
  const agent = createPurchaseAgent(d);
  const first = await ask(agent, validInput, 'req_replay');
  const second = await ask(agent, validInput, 'req_replay');
  const third = await ask(agent, validInput, 'req_replay');
  assert.equal(calls.length, 1);
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});

test('REPLAY of a DENIED request returns the same denial (it is not retried)', async () => {
  const { deps: d, calls } = deps({ purchase: result({ verdict: 'DENY', denyCode: 'OVER_TOTAL_CAP', finalAmountInr: 229 }) });
  const agent = createPurchaseAgent(d);
  const a = await ask(agent, validInput, 'req_denied');
  const b = await ask(agent, validInput, 'req_denied');
  assert.equal(calls.length, 1);
  assert.deepEqual(b, a);
});

test('an interrupted purchase (claimed, gate started, never completed) is NOT retried', async () => {
  const idempotency = memoryIdempotencyStore();
  const { deps: d, calls } = deps({
    idempotency,
    runPurchase: async () => {
      throw new Error('process crashed mid-order');
    },
  });
  const agent = createPurchaseAgent(d);
  const first = await ask(agent, validInput, 'req_crash');
  assert.equal(first.ok, false);
  const retry = await ask(agent, validInput, 'req_crash');
  assert.equal(retry.ok, false);
  if (!retry.ok) assert.equal(retry.error.code, 'DUPLICATE_REQUEST');
  assert.equal(calls.length, 0);
});

test('CAN_CLEAR_CART matches what manifest.json really offers (cannot drift silently)', () => {
  const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '..', '..', 'manifest.json'), 'utf-8')) as Array<{ site: string; name: string }>;
  for (const merchant of ['blinkit', 'zepto', 'bigbasket'] as const) {
    const has = manifest.some((c) => c.site === merchant && c.name === 'clear-cart');
    assert.equal(CAN_CLEAR_CART[merchant], has, `${merchant}: CAN_CLEAR_CART says ${CAN_CLEAR_CART[merchant]}, manifest.json says ${has}`);
  }
});
