import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCartLineKey,
  deduplicateCartLines,
  addOrUpdateCartItem,
  calculateCartSummary,
  type CartLineItem,
} from './cart-dedup';

test('getCartLineKey creates deterministic normalized keys', () => {
  const k1 = getCartLineKey('blinkit', 'prod_123', undefined, undefined);
  const k2 = getCartLineKey('BLINKIT', 'PROD_123', undefined, undefined);
  assert.equal(k1, 'blinkit::prod_123');
  assert.equal(k1, k2);
});

test('deduplicateCartLines aggregates duplicate items correctly', () => {
  const lines: CartLineItem[] = [
    { productId: 'p1', merchant: 'blinkit', quantity: 1, title: 'Milk', priceInr: 30 },
    { productId: 'p1', merchant: 'blinkit', quantity: 2, title: 'Milk', priceInr: 30 },
    { productId: 'p2', merchant: 'zepto', quantity: 1, title: 'Eggs', priceInr: 80 },
  ];

  const deduped = deduplicateCartLines(lines);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].quantity, 3);
  assert.equal(deduped[1].quantity, 1);
});

test('addOrUpdateCartItem prevents duplicate lines and updates quantity', () => {
  const initial: CartLineItem[] = [
    { productId: 'p1', merchant: 'blinkit', quantity: 1, title: 'Milk', priceInr: 30 },
  ];

  const added = addOrUpdateCartItem(initial, {
    productId: 'p1',
    merchant: 'blinkit',
    quantity: 1,
    title: 'Milk',
    priceInr: 30,
  });

  assert.equal(added.length, 1);
  assert.equal(added[0].quantity, 2);
});

test('calculateCartSummary computes grand total and merchant totals', () => {
  const lines: CartLineItem[] = [
    { productId: 'p1', merchant: 'blinkit', quantity: 2, title: 'Milk', priceInr: 30 },
    { productId: 'p2', merchant: 'zepto', quantity: 1, title: 'Eggs', priceInr: 80 },
  ];

  const summary = calculateCartSummary(lines);
  assert.equal(summary.grandTotalInr, 140);
  assert.equal(summary.totalItemCount, 3);
  assert.equal(summary.merchantTotals.blinkit, 60);
  assert.equal(summary.merchantTotals.zepto, 80);
});
