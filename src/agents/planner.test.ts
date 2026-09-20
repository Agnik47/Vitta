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

// ---- conversational lead-ins ----------------------------------------------------------------------
// Found live: "Help me in buying 1L milk under 70." became the product name "Help me in buying 1L milk",
// so the Evaluator rejected all 15 real candidates ("does not look like …") and nothing was bought. It
// was also read as a search-only request, because the buy-word check knew "buy" but not "buying".

const product = (request: string) => parseIntent(request).product_query;

test('the exact phrasings that failed live reduce to the product', () => {
  assert.equal(product('Help me in buying 1L milk under 70.'), '1L milk');
  assert.equal(product('Help me in buying the cheapest aata.'), 'aata');
  assert.equal(product('Find cheapest paneer'), 'paneer');
  assert.equal(product('find cheapest biscuit'), 'biscuit');
});

test('"buying" / "ordering" / "purchasing" are buy requests, "help me in buying 1L milk under 70" included', () => {
  const i = parseIntent('Help me in buying 1L milk under 70.');
  assert.equal(i.purchase_required, true);
  assert.equal(i.max_price_inr, 70);
  assert.equal(i.quantity, 1);
  assert.equal(parseIntent('I am ordering some paneer').purchase_required, true);
  assert.equal(parseIntent('thinking about purchasing curd').purchase_required, true);
});

test('any stack of lead-ins peels down to the product', () => {
  for (const [request, want] of [
    ['can you please help me find the cheapest atta', 'atta'],
    ['Hey, could you help me to buy some paneer', 'paneer'],
    ['I want to buy 2kg atta', '2kg atta'],
    ["I'm looking to buy eggs", 'eggs'],
    ['looking for the best basmati rice', 'basmati rice'],
    ['please help me order 1L milk', '1L milk'],
    ['I need 1L milk', '1L milk'],
    ['show me cheapest curd', 'curd'],
    ['buy amul butter please', 'amul butter'],
    ['add amul butter to my cart', 'amul butter'],
    ['get me the cheapest bread for me', 'bread'],
  ]) {
    assert.equal(product(request), want, request);
  }
});

test('a product name that merely contains a lead-in word is left alone', () => {
  assert.equal(product('order Amul Gold milk 500ml'), 'Amul Gold milk 500ml');
  assert.equal(product('find Good Day biscuits'), 'Good Day biscuits');
  assert.equal(product('buy Kellogg\'s Corn Flakes'), 'Kellogg\'s Corn Flakes');
});

test('a request that is only lead-ins names no product and is refused, not guessed', () => {
  assert.throws(() => parseIntent('help me in buying'), /Could not find a product/);
  assert.throws(() => parseIntent('please help me'), /Could not find a product/);
  assert.throws(() => parseIntent('can you buy it'), /Could not find a product/);
});
