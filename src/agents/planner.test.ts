import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlannerAgent, parseIntent } from './planner';
import { isShoppingIntent } from './protocol';
import { newCorrelation } from './a2a';

test('the spec example: cheapest 2kg atta under ₹300, and buy it', () => {
  const intent = parseIntent('Find me the cheapest 2kg atta under ₹300 and buy it.');
  assert.equal(intent.product_query, '2kg atta');
  assert.equal(intent.max_price_inr, 300);
  assert.equal(intent.quantity, 1); // "2kg" is a size, not a quantity
  assert.equal(intent.purchase_required, true);
  assert.deepEqual(intent.preferred_merchants, []);
  assert.equal(intent.category, 'groceries');
  assert.equal(intent.source, 'user');
  assert.ok(isShoppingIntent(intent));
});

test('"buy me 2kg atta at the cheapest available price" — no price ceiling', () => {
  const intent = parseIntent('Buy me 2kg atta at the cheapest available price');
  assert.equal(intent.product_query, '2kg atta');
  assert.equal(intent.max_price_inr, undefined);
  assert.equal(intent.purchase_required, true);
});

test('quantity is read from "3 packs" / "x3" / "qty 3" and stripped from the product', () => {
  assert.equal(parseIntent('buy 3 packs of maggi noodles').quantity, 3);
  assert.equal(parseIntent('buy 3 packs of maggi noodles').product_query, 'of maggi noodles'.replace(/^of /, ''));
  assert.equal(parseIntent('order amul butter x4').quantity, 4);
  assert.equal(parseIntent('order amul butter qty 2').quantity, 2);
});

test('merchants named in the request restrict the search to them', () => {
  const intent = parseIntent('find atta from blinkit or zepto under Rs 500');
  assert.deepEqual([...intent.preferred_merchants].sort(), ['blinkit', 'zepto']);
  assert.equal(intent.product_query, 'atta');
  assert.equal(intent.max_price_inr, 500);
  assert.equal(intent.purchase_required, false); // "find" alone is not a purchase
});

test('"big basket" as two words is recognised', () => {
  assert.deepEqual(parseIntent('buy milk only on big basket').preferred_merchants, ['bigbasket']);
});

test('a search-only request does not purchase; an explicit negation overrides "buy"', () => {
  assert.equal(parseIntent('compare prices for 1L milk').purchase_required, false);
  assert.equal(parseIntent("find milk, don't buy it yet").purchase_required, false);
});

test('an empty or over-long request is a structured PLANNER_ERROR, not a crash', async () => {
  const planner = createPlannerAgent();
  const empty = await planner({ vitta: 1, correlation: newCorrelation(), input: { request: '   ' } });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error.code, 'PLANNER_ERROR');

  const long = await planner({ vitta: 1, correlation: newCorrelation(), input: { request: 'atta '.repeat(1000) } });
  assert.equal(long.ok, false);
});

test('a request with no product in it is refused rather than guessed', async () => {
  const planner = createPlannerAgent();
  const r = await planner({ vitta: 1, correlation: newCorrelation(), input: { request: 'please buy it under ₹100' } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'PLANNER_ERROR');
});

test('the agent rejects a malformed input shape as INVALID_REQUEST', async () => {
  const r = await createPlannerAgent()({ vitta: 1, correlation: newCorrelation(), input: { nope: true } });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, 'INVALID_REQUEST');
});

test('the planner returns a valid ShoppingIntent plus a timed step', async () => {
  const r = await createPlannerAgent()({ vitta: 1, correlation: newCorrelation(), input: { request: 'buy 2kg atta under 300' } });
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(isShoppingIntent(r.data));
    assert.equal(r.steps[0].name, 'parse-shopping-request');
    assert.equal(r.agent, 'vitta-shopping-planner');
  }
});
