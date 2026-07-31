// Unit tests for the per-merchant commit spec — the generalisation of ADR-013's "never sign a
// receipt for an order the merchant never confirmed" past its Blinkit-only assumptions.
//
// Every payload here is shaped from a real manifest.json column schema, not invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMIT_SPEC,
  commitProofKind,
  evaluateCommitProof,
  isCommitCommand,
  type CommitResultRow,
} from './commit-spec';

// ---------------------------------------------------------------------------------------------
// Which command counts as a commit — the bug that mis-priced Zepto and BigBasket.
// ---------------------------------------------------------------------------------------------

test('blinkit: place-order is the commit, checkout is not', () => {
  assert.equal(isCommitCommand('blinkit', 'place-order'), true);
  assert.equal(isCommitCommand('blinkit', 'checkout'), false);
  assert.equal(isCommitCommand('blinkit', 'add-to-cart'), false);
});

test('zepto: place-order is the commit; its WRITE checkout is NOT (it places no order)', () => {
  // The old `command === 'place-order' || command === 'checkout'` check treated zepto/checkout as a
  // commit, which both mis-priced it and, worse, made gate.ts probe a write command for pricing.
  assert.equal(isCommitCommand('zepto', 'place-order'), true);
  assert.equal(isCommitCommand('zepto', 'checkout'), false);
});

test('bigbasket: place-order is the commit (custom adapter added 2026-07-31), checkout is not', () => {
  assert.equal(isCommitCommand('bigbasket', 'place-order'), true);
  assert.equal(isCommitCommand('bigbasket', 'checkout'), false);
  assert.equal(isCommitCommand('bigbasket', 'add-to-cart'), false);
});

test('unknown site falls back to the conservative name heuristic (priced, not waved through)', () => {
  assert.equal(isCommitCommand('district', 'place-order'), true);
  assert.equal(isCommitCommand('district', 'checkout'), true);
  assert.equal(isCommitCommand('district', 'search'), false);
});

test('unknown site gets the strictest proof rule', () => {
  assert.equal(commitProofKind('district'), 'orderId');
  assert.equal(commitProofKind('blinkit'), 'orderId');
  assert.equal(commitProofKind('zepto'), 'confirmed');
  assert.equal(commitProofKind('bigbasket'), 'orderId');
});

// ---------------------------------------------------------------------------------------------
// Blinkit — the original ADR-013 rule must be preserved exactly.
// ---------------------------------------------------------------------------------------------

test('blinkit: a real orderId is proof', () => {
  const row: CommitResultRow = { status: 'success', confirmed: true, orderId: 'ORD123456', url: 'https://…' };
  const result = evaluateCommitProof(row, 'orderId');
  assert.equal(result.ok, true);
  assert.equal(result.orderId, 'ORD123456');
});

test('ADR-013 REGRESSION: exit 0 + status success + confirmed true but EMPTY orderId is NOT proof', () => {
  // The exact live payload from the night ADR-013 was written: webcmd exited 0 and reported
  // success while the browser had merely stopped at "Proceed To Pay". Nothing was ordered.
  const row: CommitResultRow = { status: 'success', confirmed: true, orderId: '' };
  assert.equal(evaluateCommitProof(row, 'orderId').ok, false);
});

test('blinkit: whitespace-only orderId is not proof', () => {
  assert.equal(evaluateCommitProof({ orderId: '   ' }, 'orderId').ok, false);
});

test('blinkit: a missing result row entirely is not proof', () => {
  assert.equal(evaluateCommitProof(undefined, 'orderId').ok, false);
});

// ---------------------------------------------------------------------------------------------
// Zepto — no orderId column exists, so `confirmed` + a success status is the proof.
// ---------------------------------------------------------------------------------------------

test('zepto: confirmed=true with a success status is proof, and records what was accepted', () => {
  const row: CommitResultRow = { status: 'success', confirmed: true, message: 'Order placed' };
  const result = evaluateCommitProof(row, 'confirmed');
  assert.equal(result.ok, true);
  assert.equal(result.orderId, undefined, 'zepto issues no order id — must not invent one');
  assert.equal(result.commitProof, 'confirmed:success');
});

test('zepto: confirmed=true but NO status is not proof', () => {
  // The dangerous case. If `confirmed` merely echoes back the --confirm flag we passed, it proves
  // nothing on its own — so a merchant-issued success status is required alongside it.
  assert.equal(evaluateCommitProof({ confirmed: true }, 'confirmed').ok, false);
});

test('zepto: confirmed=true with a non-success status is not proof', () => {
  assert.equal(evaluateCommitProof({ confirmed: true, status: 'pending' }, 'confirmed').ok, false);
  assert.equal(evaluateCommitProof({ confirmed: true, status: 'payment_required' }, 'confirmed').ok, false);
  assert.equal(evaluateCommitProof({ confirmed: true, status: 'failed' }, 'confirmed').ok, false);
  assert.equal(evaluateCommitProof({ confirmed: true, status: '' }, 'confirmed').ok, false);
});

test('zepto: a success status WITHOUT confirmed=true is not proof', () => {
  assert.equal(evaluateCommitProof({ status: 'success' }, 'confirmed').ok, false);
  assert.equal(evaluateCommitProof({ status: 'success', confirmed: false }, 'confirmed').ok, false);
});

test('zepto: if an orderId ever does appear, it is carried through as well', () => {
  const result = evaluateCommitProof({ confirmed: true, status: 'placed', orderId: 'Z-99' }, 'confirmed');
  assert.equal(result.ok, true);
  assert.equal(result.orderId, 'Z-99');
});

// ---------------------------------------------------------------------------------------------
// proof:'none' — the fail-closed hand-off rule for any merchant with no order-placing command at
// all. Not currently used by blinkit/zepto/bigbasket (all three now have a real place-order path),
// but kept as gate.ts's fallback for an unconfigured site added later without a commit command.
// ---------------------------------------------------------------------------------------------

test("proof 'none' is never satisfied, even by a success-looking row", () => {
  // A receipt must never be signed when the merchant has no way to confirm an order to us, no
  // matter what a read-only review command reports. Adding real order confirmation for a site must
  // be a deliberate COMMIT_SPEC change, verified live — never inferred automatically.
  assert.equal(evaluateCommitProof({ status: 'success', confirmed: true, orderId: 'X1' }, 'none').ok, false);
  assert.equal(evaluateCommitProof(undefined, 'none').ok, false);
});

test('COMMIT_SPEC covers exactly the three merchants this build can execute against', () => {
  assert.deepEqual(Object.keys(COMMIT_SPEC).sort(), ['bigbasket', 'blinkit', 'zepto']);
});
