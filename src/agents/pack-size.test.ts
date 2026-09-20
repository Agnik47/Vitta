// The merchant's stated pack size must reach the Evaluator — found live: the size was on every milk
// listing (Blinkit `variant`), the mapping dropped it, and 27 of 30 real listings were rejected as
// "pack size not stated on the listing".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPackSize } from './pack-size';
import { normalizeWebcmdRow } from './discovery';
import { evaluate } from './evaluator';
import type { Candidate, ShoppingIntent } from './protocol';

test('a size the merchant states in its own field is added to the name', () => {
  assert.equal(withPackSize('Amul Taaza Toned Milk', '500 ml'), 'Amul Taaza Toned Milk 500 ml');
  assert.equal(withPackSize('Amul Gold Milk', '1 L'), 'Amul Gold Milk 1 L');
  assert.equal(withPackSize('Aashirvaad Select Atta', '2 kg'), 'Aashirvaad Select Atta 2 kg');
});

test('Zepto\'s "1 pack (1 kg)" contributes the parenthesised size', () => {
  assert.equal(withPackSize('Superior MP Wheat Atta', '1 pack (1 kg)'), 'Superior MP Wheat Atta 1 kg');
  assert.equal(withPackSize('Amul Butter', '1 pack (100 g)'), 'Amul Butter 100 g');
});

test('a size the name already states is not repeated, however it is spaced or cased', () => {
  assert.equal(withPackSize('Aashirvaad Atta - 5 kg', '5 kg'), 'Aashirvaad Atta - 5 kg');
  assert.equal(withPackSize('Aashirvaad Atta 5kg', '5 KG'), 'Aashirvaad Atta 5kg');
  assert.equal(withPackSize('Amul Milk (1 L)', '1 l'), 'Amul Milk (1 L)');
});

test('nothing is invented: no unit, no size, or a non-string leaves the name untouched', () => {
  assert.equal(withPackSize('Amul Milk', '1 pack'), 'Amul Milk');
  assert.equal(withPackSize('Amul Milk', 'Pack of 2'), 'Amul Milk');
  assert.equal(withPackSize('Amul Milk', ''), 'Amul Milk');
  assert.equal(withPackSize('Amul Milk', undefined), 'Amul Milk');
  assert.equal(withPackSize('Amul Milk', 500), 'Amul Milk');
});

test('real row shapes: a Blinkit row uses `variant`, a Zepto row uses `pack_size`', () => {
  const blinkit = normalizeWebcmdRow('blinkit', { productId: '1', name: 'Amul Taaza Toned Milk', variant: '1 L', price: 59, available: true });
  assert.equal(blinkit?.product_name, 'Amul Taaza Toned Milk 1 L');
  const zepto = normalizeWebcmdRow('zepto', { product_id: 'z1', title: 'Superior MP Wheat Atta, 0% Maida | Aashirvaad', pack_size: '1 pack (2 kg)', price: 110 });
  assert.equal(zepto?.product_name, 'Superior MP Wheat Atta, 0% Maida | Aashirvaad 2 kg');
});

test('the case that failed live: "1L milk" now finds the 1 L listing and skips the 500 ml one', () => {
  const row = (name: string, variant: string, price: number): Candidate =>
    normalizeWebcmdRow('blinkit', { productId: name, name, variant, price, available: true })!;
  const intent: ShoppingIntent = {
    raw_request: 'Help me in buying 1L milk under 70.',
    product_query: '1L milk',
    category: 'groceries',
    quantity: 1,
    max_price_inr: 70,
    purchase_required: true,
    preferred_merchants: [],
    source: 'user',
  };
  const proposal = evaluate(intent, [
    row('Amul Taaza Toned Milk', '500 ml', 30), // cheaper, but not 1 L
    row('Mother Dairy Cow Milk', '1 L', 62),
    row('Amul Taaza Toned Milk', '1 L', 59),
    row('Amul Gold Full Cream Milk', '1 L', 72), // over the ceiling
  ]);
  assert.equal(proposal.proposed_action, 'purchase');
  assert.equal(proposal.selected?.product_name, 'Amul Taaza Toned Milk 1 L');
  assert.equal(proposal.selected?.price_inr, 59);
  assert.ok(proposal.rejected.some((r) => /different pack size/.test(r.reason)), 'the 500 ml listing is rejected for its size, not for lacking one');
  assert.ok(!proposal.rejected.some((r) => /not stated/.test(r.reason)));
});
