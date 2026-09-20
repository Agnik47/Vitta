import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAgentRequest, newCorrelation } from './a2a';
import { createDiscoveryAgent } from './discovery';
import { createEvaluatorAgent } from './evaluator';
import { createPurchaseAgent, type PurchaseDeps } from './purchase';
import { isCandidate, isShoppingIntent, type AgentFailure, type AgentHandler, type AgentRequest } from './protocol';
import { EXAMPLE_CANDIDATES, EXAMPLE_INTENT } from './usage-hint';

const chat = (text: string): AgentRequest => ({ vitta: 1, correlation: newCorrelation(), input: { request: text } });

async function failure(agent: AgentHandler, request: AgentRequest): Promise<AgentFailure> {
  const r = await agent(request);
  assert.equal(r.ok, false);
  return r as AgentFailure;
}

const discovery = () => createDiscoveryAgent({ search: async () => ({ ok: true, source: 'test', candidates: [] }), product: async () => ({ ok: true, source: 'test', candidates: [] }) });

const purchaseSpy = () => {
  let ran = false;
  const deps: PurchaseDeps = {
    runPurchase: async () => {
      ran = true;
      throw new Error('must not run');
    },
    readCartItemCount: async () => ({ ok: true, itemCount: 0 }),
    currentMandate: () => undefined,
    runIdFor: () => undefined,
    idempotency: { claim: () => ({ state: 'claimed' }), complete: () => undefined },
  };
  return { agent: createPurchaseAgent(deps), ran: () => ran };
};

test('the examples are valid inputs, so the hint cannot drift from what the agents accept', () => {
  assert.ok(isShoppingIntent(EXAMPLE_INTENT));
  assert.ok(EXAMPLE_CANDIDATES.every(isCandidate));
});

test('Evaluator: a chat message is refused with an explanation and a message that actually works', async () => {
  const agent = createEvaluatorAgent();
  const f = await failure(agent, chat('Pick the cheapest paneer under 100'));
  assert.equal(f.error.code, 'INVALID_REQUEST');
  assert.match(f.error.message, /does not take free text/);
  assert.match(f.error.message, /vitta-shopping-planner/);

  // Send the suggested message back the way Nasiko's chat would (as text), and it must be accepted.
  const pasted = (f.error.details as { paste_this_message: unknown }).paste_this_message;
  const req = extractAgentRequest({ parts: [{ text: JSON.stringify(pasted) }] });
  assert.ok(!('error' in req), 'the suggested message parses as a Vitta envelope');
  const r = await agent(req as AgentRequest);
  assert.ok(r.ok);
  if (r.ok) assert.equal((r.data as { selected?: { merchant: string } }).selected?.merchant, 'blinkit');
});

test('Discovery: a chat message gets the same explanation and a valid example', async () => {
  const f = await failure(discovery(), chat('search paneer'));
  assert.equal(f.error.code, 'INVALID_REQUEST');
  assert.match(f.error.message, /does not take free text/);
  const pasted = (f.error.details as { paste_this_message: { input: { intent: unknown } } }).paste_this_message;
  assert.ok(isShoppingIntent(pasted.input.intent));
});

test('each pasted example carries a fresh correlation, so two hints never share a request id', async () => {
  const a = await failure(createEvaluatorAgent(), chat('x'));
  const b = await failure(createEvaluatorAgent(), chat('y'));
  const id = (f: AgentFailure) => (f.error.details as { paste_this_message: { correlation: { requestId: string } } }).paste_this_message.correlation.requestId;
  assert.notEqual(id(a), id(b));
});

test('Purchase: a chat message is explained but gets NO paste-ready example, and nothing is run', async () => {
  const { agent, ran } = purchaseSpy();
  const f = await failure(agent, chat('buy paneer'));
  assert.equal(f.error.code, 'INVALID_REQUEST');
  assert.match(f.error.message, /does not take free text/);
  assert.equal(f.error.details, undefined);
  assert.equal(ran(), false);
});

test('structured-but-wrong input keeps the plain message: no chat explanation, no example', async () => {
  const f = await failure(createEvaluatorAgent(), { vitta: 1, correlation: newCorrelation(), input: { intent: {}, candidates: [] } });
  assert.equal(f.error.code, 'INVALID_REQUEST');
  assert.doesNotMatch(f.error.message, /free text/);
  assert.equal(f.error.details, undefined);
});
