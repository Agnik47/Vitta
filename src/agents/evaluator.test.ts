import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, extractSizes, relevance, createEvaluatorAgent } from './evaluator';
import type { Candidate, ShoppingIntent } from './protocol';
import { newCorrelation } from './a2a';

function intent(over: Partial<ShoppingIntent> = {}): ShoppingIntent {
  return {
    raw_request: 'x',
    product_query: '2kg atta',
    category: 'groceries',
    quantity: 1,
    purchase_required: true,
    preferred_merchants: [],
    source: 'user',
    ...over,
  };
}

function cand(merchant: Candidate['merchant'], name: string, price: number, over: Partial<Candidate> = {}): Candidate {
  return { merchant, product_name: name, price_inr: price, availability: true, source: 'test', ...over };
}

const ATTA = 'Aashirvaad Select Atta 2kg';

test('spec scenario: Blinkit ₹245, Zepto ₹229, BigBasket ₹267 → Zepto ₹229', () => {
  const p = evaluate(intent(), [cand('blinkit', ATTA, 245), cand('zepto', ATTA, 229), cand('bigbasket', ATTA, 267)]);
  assert.equal(p.proposed_action, 'purchase');
  assert.equal(p.selected?.merchant, 'zepto');
  assert.equal(p.expected_total_inr, 229);
  assert.match(p.reason, /₹229 at zepto/);
  assert.match(p.reason, /next best ₹245 at blinkit/);
  assert.equal(p.considered, 3);
});

test('out-of-stock, wrong-size and over-ceiling candidates are rejected WITH reasons', () => {
  const p = evaluate(intent({ max_price_inr: 300 }), [
    cand('zepto', ATTA, 199, { availability: false }),
    cand('zepto', 'Premium Organic Atta 10kg', 250),
    cand('blinkit', 'Aashirvaad Atta 2kg', 350),
    cand('bigbasket', ATTA, 267),
  ]);
  assert.equal(p.selected?.merchant, 'bigbasket');
  const reasons = p.rejected.map((r) => r.reason);
  assert.ok(reasons.includes('out of stock'));
  assert.ok(reasons.includes('different pack size than requested'));
  assert.ok(reasons.some((r) => /above the ₹300 ceiling/.test(r)));
});

test('a listing that states no size is rejected when the user named one — no guessing', () => {
  const p = evaluate(intent(), [cand('zepto', 'Aashirvaad Atta', 200)]);
  assert.equal(p.proposed_action, 'none');
  assert.equal(p.rejected[0].reason, 'pack size not stated on the listing');
});

test('an unrelated product is not proposed just because it is cheap', () => {
  const p = evaluate(intent(), [cand('zepto', 'Lays Chips 2kg family pack', 10)]);
  assert.equal(p.proposed_action, 'none');
  assert.match(p.rejected[0].reason, /does not look like/);
});

test('nothing eligible → proposed_action none, with the summary of why', () => {
  const p = evaluate(intent({ max_price_inr: 100 }), [cand('zepto', ATTA, 229), cand('blinkit', ATTA, 245)]);
  assert.equal(p.proposed_action, 'none');
  assert.equal(p.selected, undefined);
  assert.match(p.reason, /2× ₹\d+ is above the ₹100 ceiling|above the ₹100 ceiling/);
});

test('the ceiling applies to unit price × quantity', () => {
  const p = evaluate(intent({ quantity: 2, max_price_inr: 450 }), [cand('zepto', ATTA, 229), cand('bigbasket', ATTA, 200)]);
  assert.equal(p.selected?.merchant, 'bigbasket'); // 2 × 229 = 458 > 450
  assert.equal(p.expected_total_inr, 400);
});

test('requested merchants are respected', () => {
  const p = evaluate(intent({ preferred_merchants: ['blinkit'] }), [cand('zepto', ATTA, 229), cand('blinkit', ATTA, 245)]);
  assert.equal(p.selected?.merchant, 'blinkit');
});

test('ties are broken deterministically: same input → same proposal, regardless of order', () => {
  const a = cand('zepto', ATTA, 229);
  const b = cand('blinkit', ATTA, 229);
  assert.equal(evaluate(intent(), [a, b]).selected?.merchant, 'blinkit');
  assert.equal(evaluate(intent(), [b, a]).selected?.merchant, 'blinkit');
});

test('a search-only intent selects a best candidate but proposes no purchase', () => {
  const p = evaluate(intent({ purchase_required: false }), [cand('zepto', ATTA, 229)]);
  assert.equal(p.proposed_action, 'none');
  assert.equal(p.selected?.merchant, 'zepto');
  assert.match(p.reason, /search-only/);
});

test('a pinned (Price Sniper) intent accepts only the pinned product, and still honours the ceiling', () => {
  const pinned = intent({ pinned: { merchant: 'blinkit', product_id: 'bk-1' }, max_price_inr: 250, product_query: 'atta' });
  const hit = cand('blinkit', 'Anything', 240, { product_id: 'bk-1' });
  assert.equal(evaluate(pinned, [hit, cand('zepto', ATTA, 100)]).selected?.merchant, 'blinkit');
  const tooDear = cand('blinkit', 'Anything', 260, { product_id: 'bk-1' });
  assert.equal(evaluate(pinned, [tooDear]).proposed_action, 'none');
});

test('size parsing normalises units', () => {
  assert.deepEqual(extractSizes('Atta 2kg'), [{ dim: 'mass', amount: 2000 }]);
  assert.deepEqual(extractSizes('Atta 2000 g'), [{ dim: 'mass', amount: 2000 }]);
  assert.deepEqual(extractSizes('Milk 1L'), [{ dim: 'volume', amount: 1000 }]);
  assert.deepEqual(extractSizes('Oil 500ml'), [{ dim: 'volume', amount: 500 }]);
});

test('"2kg" in the query matches a "2000g" listing', () => {
  const p = evaluate(intent(), [cand('zepto', 'Aashirvaad Atta 2000g', 220)]);
  assert.equal(p.selected?.merchant, 'zepto');
});

test('relevance is the fraction of query words present, with plural stemming', () => {
  assert.equal(relevance('atta', 'Aashirvaad Atta 2kg'), 1);
  assert.equal(relevance('eggs', 'Farm Egg 6 pack'), 1);
  assert.equal(relevance('wheat flour', 'Wheat Atta'), 0.5);
});

test('the agent validates its input and returns a Proposal', async () => {
  const agent = createEvaluatorAgent();
  const bad = await agent({ vitta: 1, correlation: newCorrelation(), input: { intent: {}, candidates: [] } });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.code, 'INVALID_REQUEST');

  const good = await agent({ vitta: 1, correlation: newCorrelation(), input: { intent: intent(), candidates: [cand('zepto', ATTA, 229)] } });
  assert.ok(good.ok);
});
