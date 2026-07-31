// Unit tests for resolveCartTotalInr() — the fix for ADR-013 follow-up 1 / ADR-014.
//
// Every test case is a real payload shape from webcmd (or a plausible variant covered by the
// column schemas in manifest.json). Includes the exact ADR-013 failure ("₹20 reported / ₹55
// actually charged") plus the ₹300 cart the user asked for in this session, so the guarantee
// this file adds is anchored to the specific bug it exists to prevent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCartTotalInr, type CheckoutRow, type CartLineRow } from './cart-total';

// ---------------------------------------------------------------------------------------------
// The exact ADR-013 bug — the check on this build's most serious real failure.
// ---------------------------------------------------------------------------------------------

test('ADR-013 case: checkout.payable=20 with fees=0 while itemsTotal+fees=55 → resolver picks 55', () => {
  // What webcmd actually returned that night: `payable: 20, deliveryCharge: 0, handlingCharge: 0`
  // — the direct cause of a signed receipt for an order that would have been ₹55 at the counter.
  // A well-behaved future run where fees ARE reported must NOT let `payable` win alone.
  const checkout: CheckoutRow = {
    itemsTotal: 20,
    deliveryCharge: 30,
    handlingCharge: 5,
    payable: 20, // under-reports the real merchant charge
    checkoutBlocked: false,
    validations: [],
    itemCount: 1,
  };
  const cartLines: CartLineRow[] = [{ price: 20, quantity: 1, total: 20, payable: 20 }];

  const result = resolveCartTotalInr(checkout, cartLines);

  assert.equal(result.amountInr, 55, 'must pick the itemsTotal+fees sum, not the under-reporting payable');
  assert.ok(result.sources.includes('checkout.itemsTotal+fees'));
  assert.equal(result.merchantBlocked, false);
});

test('ADR-013 REGRESSION: with a ₹50 per-txn cap, resolver returns a total that would DENY (55 > 50)', () => {
  // This is the concrete claim the bug fix has to hold: on the same JSON that used to clear a
  // ₹50 cap silently, decide()'s cap check now trips. This test doesn't run decide() itself
  // (that's exercised in decide.test.ts) — it verifies the resolver hands decide() a number
  // strictly greater than 50, which is the property that makes the cap trip.
  const checkout: CheckoutRow = { itemsTotal: 20, deliveryCharge: 30, handlingCharge: 5, payable: 20 };
  const cartLines: CartLineRow[] = [{ payable: 20 }];
  const result = resolveCartTotalInr(checkout, cartLines);
  assert.ok(result.amountInr > 50, `resolver must return > 50 to trip the cap (got ${result.amountInr})`);
});

// ---------------------------------------------------------------------------------------------
// The ₹300 cart the user specifically asked for this session — "make cart value to 300".
// Covers the free-delivery threshold path (fees genuinely 0, checkout.payable is authoritative)
// and each of the three mandate-cap paths against it.
// ---------------------------------------------------------------------------------------------

test('₹300 cart above the free-delivery threshold: all sources agree at 300 → resolver returns 300', () => {
  // Blinkit's free-delivery threshold is typically around ₹200 — a ₹300 cart should genuinely
  // have zero delivery/handling fees, so all three candidate numbers agree. Verifies the
  // "everything agrees" happy path doesn't invent extra spend from thin air.
  const checkout: CheckoutRow = {
    itemsTotal: 300,
    deliveryCharge: 0,
    handlingCharge: 0,
    payable: 300,
    itemCount: 3,
    checkoutBlocked: false,
    validations: [],
  };
  const cartLines: CartLineRow[] = [
    { price: 100, quantity: 1, total: 100, payable: 100 },
    { price: 100, quantity: 2, total: 200, payable: 200 },
  ];
  const result = resolveCartTotalInr(checkout, cartLines);
  assert.equal(result.amountInr, 300);
  assert.equal(result.itemCount, 3);
  assert.equal(result.merchantBlocked, false);
});

test('₹300 cart with a ₹250 per-txn cap would DENY (resolver > 250)', () => {
  // The cap-fires path — resolver's job is just to hand decide() a number > 250.
  const checkout: CheckoutRow = { payable: 300, itemsTotal: 300 };
  const cartLines: CartLineRow[] = [{ payable: 300 }];
  assert.ok(resolveCartTotalInr(checkout, cartLines).amountInr > 250);
});

test('₹300 cart with a ₹500 per-txn cap would ALLOW (resolver == 300)', () => {
  const checkout: CheckoutRow = { payable: 300, itemsTotal: 300 };
  const cartLines: CartLineRow[] = [{ payable: 300 }];
  assert.equal(resolveCartTotalInr(checkout, cartLines).amountInr, 300);
});

test('₹300 cart plus small delivery/handling: resolver returns the fee-inclusive number', () => {
  // If Blinkit ever charges fees on a mid-sized cart (or a promo lapses), the same MAX logic
  // still catches it. Same principle as the ADR-013 case, one order of magnitude larger.
  const checkout: CheckoutRow = {
    itemsTotal: 300,
    deliveryCharge: 25,
    handlingCharge: 5,
    payable: 300, // under-reporting variant, same as ADR-013
  };
  const result = resolveCartTotalInr(checkout, undefined);
  assert.equal(result.amountInr, 330, 'MAX of payable=300 and components=330 must be 330');
});

// ---------------------------------------------------------------------------------------------
// Merchant-blocked / step-up paths — signals the resolver surfaces but doesn't itself act on.
// ---------------------------------------------------------------------------------------------

test('checkout.checkoutBlocked=true surfaces merchantBlocked with a real reason', () => {
  const checkout: CheckoutRow = { payable: 300, checkoutBlocked: true };
  const result = resolveCartTotalInr(checkout, undefined);
  assert.equal(result.merchantBlocked, true);
  assert.match(result.blockedReason, /checkoutBlocked/);
});

test('non-empty checkout.validations surfaces merchantBlocked with a count', () => {
  const checkout: CheckoutRow = { payable: 300, validations: [{ code: 'ADDRESS_MISSING' }, { code: 'SLOT_UNAVAILABLE' }] };
  const result = resolveCartTotalInr(checkout, undefined);
  assert.equal(result.merchantBlocked, true);
  assert.match(result.blockedReason, /2/);
});

test('empty validations array is not blocked (empty ≠ blocking)', () => {
  const checkout: CheckoutRow = { payable: 300, validations: [] };
  const result = resolveCartTotalInr(checkout, undefined);
  assert.equal(result.merchantBlocked, false);
  assert.equal(result.blockedReason, '');
});

// ---------------------------------------------------------------------------------------------
// Source-precedence tests — MAX-of-all with real disagreements.
// ---------------------------------------------------------------------------------------------

test('when only cart lines are present, resolver returns the cart sum', () => {
  const cartLines: CartLineRow[] = [{ total: 120 }, { total: 80 }];
  const result = resolveCartTotalInr(undefined, cartLines);
  assert.equal(result.amountInr, 200);
  assert.deepEqual(result.sources, ['cart.line-sum']);
});

test('when only checkout is present, resolver uses whichever of payable/components is larger', () => {
  const checkout: CheckoutRow = { itemsTotal: 100, deliveryCharge: 30, handlingCharge: 5, payable: 100 };
  const result = resolveCartTotalInr(checkout, undefined);
  assert.equal(result.amountInr, 135);
});

test('cart-sum and checkout.payable disagree: resolver picks the larger', () => {
  const checkout: CheckoutRow = { payable: 500 };
  const cartLines: CartLineRow[] = [{ total: 200 }, { total: 200 }];
  const result = resolveCartTotalInr(checkout, cartLines);
  assert.equal(result.amountInr, 500);
});

test('cart-sum LARGER than checkout.payable (stale checkout): resolver picks the cart sum', () => {
  // Defensive: if a stale checkout read gave a smaller number than a fresher cart sum, taking
  // the larger fails closed — the cart shows more items now.
  const checkout: CheckoutRow = { payable: 100 };
  const cartLines: CartLineRow[] = [{ total: 250 }, { total: 250 }];
  const result = resolveCartTotalInr(checkout, cartLines);
  assert.equal(result.amountInr, 500);
});

test('cart lines with only `total` are summed', () => {
  const cartLines: CartLineRow[] = [{ total: 150 }, { total: 50 }];
  const result = resolveCartTotalInr(undefined, cartLines);
  assert.equal(result.amountInr, 200);
});

// ---------------------------------------------------------------------------------------------
// Regression: the real `blinkit/cart` row shape (clis/blinkit/cart.js) repeats the CART-level
// `payable` and `itemCount` on EVERY line. Summing `payable` multiplied the cart by its line
// count. Observed live 2026-07-31: a genuine ₹179 two-line cart resolved to ₹358 and was DENYed
// OVER_TOTAL_CAP against a ₹500 mandate.
// ---------------------------------------------------------------------------------------------

test('real blinkit/cart shape: cart-level `payable` on every row is NOT summed', () => {
  const cartLines: CartLineRow[] = [
    { price: 116, quantity: 1, total: 116, itemCount: 2, payable: 179 },
    { price: 63, quantity: 1, total: 63, itemCount: 2, payable: 179 },
  ];
  const result = resolveCartTotalInr(undefined, cartLines);
  assert.equal(result.amountInr, 179, 'must be the real cart total, not 179 × 2 lines');
  assert.ok(!result.sources.includes('cart.line-sum') || result.amountInr === 179);
});

test('real blinkit/cart shape with checkout agreeing: still resolves to the true total', () => {
  const checkout: CheckoutRow = { itemCount: 2, itemsTotal: 179, payable: 179 };
  const cartLines: CartLineRow[] = [
    { price: 116, quantity: 1, total: 116, itemCount: 2, payable: 179 },
    { price: 63, quantity: 1, total: 63, itemCount: 2, payable: 179 },
  ];
  const result = resolveCartTotalInr(checkout, cartLines);
  assert.equal(result.amountInr, 179);
});

test('a three-line cart does not triple the total', () => {
  const cartLines: CartLineRow[] = [
    { total: 50, payable: 300 }, { total: 100, payable: 300 }, { total: 150, payable: 300 },
  ];
  const result = resolveCartTotalInr(undefined, cartLines);
  assert.equal(result.amountInr, 300, 'cart.payable taken once, line-sum agrees at 300');
});

test('cart.payable still guards the cap when per-line totals under-report', () => {
  // Fail-closed property must survive the fix: if `total` fields are missing/small but the
  // cart-level payable is larger, the larger number still wins.
  const cartLines: CartLineRow[] = [{ total: 10, payable: 250 }, { total: 10, payable: 250 }];
  const result = resolveCartTotalInr(undefined, cartLines);
  assert.equal(result.amountInr, 250);
  assert.deepEqual(result.sources, ['cart.payable']);
});

// ---------------------------------------------------------------------------------------------
// Failure paths — every unresolvable input MUST throw, so decide() sees no number to clear.
// ---------------------------------------------------------------------------------------------

test('completely empty inputs throw (nothing to hand decide())', () => {
  assert.throws(() => resolveCartTotalInr(undefined, undefined), /unparseable|missing|₹0/i);
});

test('empty cart array plus empty checkout throws', () => {
  assert.throws(() => resolveCartTotalInr({}, []), /unparseable|missing|₹0/i);
});

test('all-zero fields throw (a ₹0 total is not a valid commit action)', () => {
  const checkout: CheckoutRow = { itemsTotal: 0, deliveryCharge: 0, handlingCharge: 0, payable: 0 };
  const cartLines: CartLineRow[] = [{ payable: 0 }];
  assert.throws(() => resolveCartTotalInr(checkout, cartLines), /unparseable|missing|₹0/i);
});

// ---------------------------------------------------------------------------------------------
// itemCount resolution — cosmetic (only lands on the receipt), but tested for confidence.
// ---------------------------------------------------------------------------------------------

test('itemCount: prefers checkout.itemCount when present', () => {
  const checkout: CheckoutRow = { payable: 300, itemCount: 5 };
  const cartLines: CartLineRow[] = [{ payable: 300, quantity: 2 }];
  assert.equal(resolveCartTotalInr(checkout, cartLines).itemCount, 5);
});

test('itemCount: sums cart quantities when checkout is silent', () => {
  const cartLines: CartLineRow[] = [{ payable: 100, quantity: 2 }, { payable: 200, quantity: 3 }];
  assert.equal(resolveCartTotalInr(undefined, cartLines).itemCount, 5);
});

test('itemCount: defaults quantity to 1 per line if unspecified', () => {
  const cartLines: CartLineRow[] = [{ payable: 100 }, { payable: 200 }];
  assert.equal(resolveCartTotalInr(undefined, cartLines).itemCount, 2);
});
