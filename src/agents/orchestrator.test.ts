import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInProcessCaller, traceIdOf } from './a2a';
import { runShoppingFlow } from './orchestrator';
import { createDiscoveryAgent } from './discovery';
import { createEvaluatorAgent } from './evaluator';
import { createPlannerAgent } from './planner';
import { createPurchaseAgent, type PurchaseDeps } from './purchase';
import { memoryIdempotencyStore } from './idempotency';
import type { FlowRecord } from './runs-store';
import { agentFail, type AgentHandler, type AgentName, type AgentRequest, type Candidate, type MerchantId, type PurchaseOutcome, type ShoppingIntent } from './protocol';
import type { PurchaseResult } from '../agent/PurchaseAgent';

const ATTA = 'Aashirvaad Select Atta 2kg';
const cand = (merchant: MerchantId, price: number): Candidate => ({
  merchant,
  product_name: ATTA,
  price_inr: price,
  availability: true,
  source: 'fake',
  product_id: `${merchant}-1`,
  product_url: merchant === 'zepto' ? 'https://www.zeptonow.com/pn/atta/pvid/1' : merchant === 'bigbasket' ? 'https://www.bigbasket.com/pd/77/atta/' : undefined,
});

function purchaseDeps(result: Partial<PurchaseResult>, seen: string[] = []): PurchaseDeps {
  return {
    runPurchase: async (input) => {
      seen.push(input.merchant);
      return {
        ok: false,
        merchant: input.merchant,
        mode: input.mode ?? 'TEST',
        productName: '',
        items: input.items,
        awaitingMerchantConfirmation: false,
        handoff: false,
        paymentStatus: 'not_charged',
        events: [],
        startedAt: '',
        completedAt: '',
        ...result,
      } as PurchaseResult;
    },
    readCartItemCount: async () => ({ ok: true, itemCount: 0 }),
    currentMandate: () => ({ mandate_id: 'mnd_t', per_txn_inr: 500, cap_inr: 800 }),
    runIdFor: () => 'run-1',
    idempotency: memoryIdempotencyStore(),
  };
}

function handlers(over: Partial<Record<AgentName, AgentHandler>> = {}, purchase: Partial<PurchaseResult> = { ok: true, verdict: 'ALLOW', receiptId: 'rcp_1', authorizationId: 'auth_1', finalAmountInr: 229 }) {
  return {
    'vitta-shopping-planner': createPlannerAgent(),
    'vitta-deal-discovery': createDiscoveryAgent({
      search: async (m) => ({ ok: true, source: 'fake', candidates: [cand(m, m === 'zepto' ? 229 : m === 'blinkit' ? 245 : 267)] }),
      product: async () => ({ ok: false, source: 'fake', candidates: [], error: 'n/a' }),
    }),
    'vitta-deal-evaluator': createEvaluatorAgent(),
    'vitta-purchase-agent': createPurchaseAgent(purchaseDeps(purchase)),
    ...over,
  } as Record<AgentName, AgentHandler>;
}

async function run(h: Record<AgentName, AgentHandler>, input: Parameters<typeof runShoppingFlow>[0]): Promise<{ record: FlowRecord; saves: FlowRecord[] }> {
  const saves: FlowRecord[] = [];
  const record = await runShoppingFlow(input, { caller: createInProcessCaller(h), save: (r) => saves.push(structuredClone(r)) });
  return { record, saves };
}

test('the spec flow: Planner → Discovery → Evaluator → Purchase, ending PURCHASED at Zepto ₹229', async () => {
  const { record } = await run(handlers(), { request: 'Find me the cheapest 2kg atta and buy it', mode: 'TEST' });
  assert.equal(record.status, 'PURCHASED');
  assert.deepEqual(record.stages.map((s) => [s.agent, s.status]), [
    ['vitta-shopping-planner', 'done'],
    ['vitta-deal-discovery', 'done'],
    ['vitta-deal-evaluator', 'done'],
    ['vitta-purchase-agent', 'done'],
  ]);
  assert.equal(record.proposal?.selected?.merchant, 'zepto');
  assert.equal(record.outcome?.status, 'PURCHASED');
  assert.equal(record.outcome?.receipt_id, 'rcp_1');
  assert.equal(record.outcome?.mandate_id, 'mnd_t');
  assert.ok(record.completed_at);
});

test('ids are stable across every hop: one session, one request id, one trace id, a distinct span per agent', async () => {
  const seen: AgentRequest[] = [];
  const spy = (inner: AgentHandler): AgentHandler => async (req) => {
    seen.push(req);
    return inner(req);
  };
  const base = handlers();
  const h = Object.fromEntries((Object.keys(base) as AgentName[]).map((n) => [n, spy(base[n])])) as Record<AgentName, AgentHandler>;
  const { record } = await run(h, { request: 'buy 2kg atta', mode: 'TEST', sessionId: 'ses_fixed', mandateId: 'mnd_t' });

  assert.equal(seen.length, 4);
  assert.ok(seen.every((r) => r.correlation.sessionId === 'ses_fixed'));
  assert.ok(seen.every((r) => r.correlation.requestId === record.request_id));
  assert.ok(seen.every((r) => traceIdOf(r.correlation.traceparent) === record.trace_id));
  assert.equal(new Set(seen.map((r) => r.correlation.traceparent)).size, 4); // a span per hop
  assert.ok(seen.every((r) => r.correlation.mandateId === 'mnd_t'));
  assert.equal(record.run_id, record.request_id);
  // the recorded span ids are the ones the agents actually received
  for (const stage of record.stages) {
    assert.ok(seen.some((r) => r.correlation.traceparent.split('-')[2] === stage.span_id));
  }
});

test('progress is persisted after every stage change, so a dashboard polling mid-run sees it advance', async () => {
  const { saves } = await run(handlers(), { request: 'buy 2kg atta', mode: 'TEST' });
  assert.ok(saves.length >= 9);
  assert.equal(saves[0].status, 'RUNNING');
  assert.ok(saves.some((s) => s.stages[3].status === 'running'));
  assert.equal(saves[saves.length - 1].status, 'PURCHASED');
});

test('a Vitta denial is carried through verbatim: DENIED, the deny code, both amounts, the mandate', async () => {
  const denied = { verdict: 'DENY' as const, denyCode: 'OVER_PER_TXN_CAP', finalAmountInr: 1299, failureReason: 'DENY' };
  const { record } = await run(handlers({}, denied), { request: 'buy 2kg atta', mode: 'TEST' });
  assert.equal(record.status, 'DENIED');
  assert.equal(record.error?.code, 'VITTA_DENIED');
  const o = record.outcome as PurchaseOutcome;
  assert.equal(o.deny_code, 'OVER_PER_TXN_CAP');
  assert.equal(o.requested_amount_inr, 1299);
  assert.equal(o.allowed_amount_inr, 500);
  assert.equal(o.mandate_id, 'mnd_t');
  assert.equal(record.stages[3].status, 'failed');
  assert.match(record.stages[3].summary ?? '', /VITTA_DENIED/);
});

test('the Price Sniper path skips the Planner and still goes Discovery → Evaluator → Purchase', async () => {
  const intent: ShoppingIntent = {
    raw_request: 'price sniper: Atta @ ≤ ₹250',
    product_query: 'Aashirvaad Select Atta 2kg',
    category: 'groceries',
    quantity: 1,
    max_price_inr: 250,
    purchase_required: true,
    preferred_merchants: ['blinkit'],
    source: 'price-sniper',
    pinned: { merchant: 'blinkit', product_id: 'blinkit-1' },
  };
  const h = handlers({
    'vitta-deal-discovery': createDiscoveryAgent({
      search: async () => ({ ok: false, source: 'fake', candidates: [], error: 'should not search' }),
      product: async (m, id) => ({ ok: true, source: 'webcmd', candidates: [{ ...cand(m, 240), product_id: id }] }),
    }),
  });
  const { record } = await run(h, { intent, mode: 'TEST', sessionId: 'ses_watch' });
  assert.equal(record.source, 'price-sniper');
  assert.equal(record.stages[0].status, 'skipped');
  assert.equal(record.status, 'PURCHASED');
  assert.equal(record.session_id, 'ses_watch');
});

test('the Price Sniper never bypasses the gate: an over-target price stops at the Evaluator, before any purchase', async () => {
  const intent: ShoppingIntent = {
    raw_request: 'sniper',
    product_query: 'x',
    category: 'groceries',
    quantity: 1,
    max_price_inr: 200,
    purchase_required: true,
    preferred_merchants: ['blinkit'],
    source: 'price-sniper',
    pinned: { merchant: 'blinkit', product_id: 'blinkit-1' },
  };
  const seen: string[] = [];
  const h = handlers(
    {
      'vitta-deal-discovery': createDiscoveryAgent({
        search: async () => ({ ok: false, source: 'fake', candidates: [], error: 'n/a' }),
        product: async (m, id) => ({ ok: true, source: 'webcmd', candidates: [{ ...cand(m, 240), product_id: id }] }),
      }),
    },
  );
  h['vitta-purchase-agent'] = createPurchaseAgent(purchaseDeps({ ok: true, verdict: 'ALLOW' }, seen));
  const { record } = await run(h, { intent, mode: 'TEST' });
  assert.equal(record.status, 'NO_PURCHASE');
  assert.equal(record.stages[3].status, 'skipped');
  assert.deepEqual(seen, []); // the purchase pipeline was never entered
});

test('a search-only request ends NO_PURCHASE without touching the Purchase Agent', async () => {
  const { record } = await run(handlers(), { request: 'compare prices for 2kg atta', mode: 'TEST' });
  assert.equal(record.status, 'NO_PURCHASE');
  assert.equal(record.stages[3].status, 'skipped');
  assert.equal(record.proposal?.proposed_action, 'none');
});

test('nothing eligible under the ceiling → NO_PURCHASE with the reason, no purchase attempt', async () => {
  const { record } = await run(handlers(), { request: 'buy 2kg atta under 100', mode: 'TEST' });
  assert.equal(record.status, 'NO_PURCHASE');
  assert.match(record.proposal?.reason ?? '', /No eligible product/);
});

test('discovery finding nothing ends NO_PRODUCTS; a failing agent ends FAILED with its own error', async () => {
  const empty = handlers({ 'vitta-deal-discovery': createDiscoveryAgent({ search: async () => ({ ok: true, source: 'f', candidates: [] }), product: async () => ({ ok: false, source: 'f', candidates: [] }) }) });
  assert.equal((await run(empty, { request: 'buy unicorn', mode: 'TEST' })).record.status, 'NO_PRODUCTS');

  const broken = handlers({ 'vitta-deal-evaluator': async () => agentFail('vitta-deal-evaluator', { code: 'EVALUATION_ERROR', message: 'boom' }, []) });
  const { record } = await run(broken, { request: 'buy 2kg atta', mode: 'TEST' });
  assert.equal(record.status, 'FAILED');
  assert.equal(record.error?.code, 'EVALUATION_ERROR');
  assert.equal(record.stages[3].status, 'pending'); // never reached
});

test('a planner failure ends FAILED and nothing downstream runs', async () => {
  const { record } = await run(handlers(), { request: '   ', mode: 'TEST' });
  assert.equal(record.status, 'FAILED');
  assert.equal(record.error?.code, 'PLANNER_ERROR');
  assert.deepEqual(record.stages.slice(1).map((s) => s.status), ['pending', 'pending', 'pending']);
});

test('an unreachable agent is reported as such, keeping the transport reason', async () => {
  const h = handlers({ 'vitta-deal-discovery': async () => agentFail('vitta-deal-discovery', { code: 'AGENT_UNREACHABLE', message: 'ECONNREFUSED 127.0.0.1:9102' }, []) });
  const { record } = await run(h, { request: 'buy 2kg atta', mode: 'TEST' });
  assert.equal(record.status, 'FAILED');
  assert.match(record.error?.message ?? '', /ECONNREFUSED/);
});

test('requires a request or an intent', async () => {
  await assert.rejects(run(handlers(), { mode: 'TEST' }), /needs a request or an intent/);
});

test('mode is passed to the Purchase Agent exactly as given', async () => {
  let modeSeen: unknown;
  const h = handlers();
  const inner = h['vitta-purchase-agent'];
  h['vitta-purchase-agent'] = async (req) => {
    modeSeen = (req.input as { mode: unknown }).mode;
    return inner(req);
  };
  await run(h, { request: 'buy 2kg atta', mode: 'LIVE' });
  assert.equal(modeSeen, 'LIVE');
});
