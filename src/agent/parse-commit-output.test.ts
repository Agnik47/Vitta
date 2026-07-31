// Tests for parseCommitOutput() — every stdout string here is either a real string this session
// produced from a live `gate run` (the DENY OVER_PER_TXN_CAP case, verified live earlier this
// session against a real ₹60 Blinkit cart and a ₹50 cap) or a direct transcription of a literal
// console.log line in src/cli/gate.ts, not invented prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommitOutput } from './parse-commit-output';

test('real ALLOW-but-awaiting-merchant-confirmation output has an authorizationId but no receiptId', () => {
  // Shape gate.ts produces since the two-stage authorization/confirmation split: decide() genuinely
  // ALLOWed the spend and a real TransactionAuthorization was signed BEFORE the browser touched
  // anything, but Blinkit's own response carried no order id, so gate.ts refused to draw or sign a
  // Receipt (ADR-013). PurchaseAgent.run() must NOT treat this as success just because
  // verdict === 'ALLOW' — see its own "genuinelyCompleted" check, which this test's shape exists to
  // guard against regressing.
  const stdout = [
    '› blinkit place-order --confirm',
    'ALLOW  blinkit/place-order · ₹30',
    '✓ TRANSACTION AUTHORIZED auth_ms92abc123',
    '  blinkit · ₹30 · reserve verified ₹1,000',
    '  no money moved yet — awaiting merchant confirmation',
    '⏳ blinkit/place-order — WAITING FOR MERCHANT CONFIRMATION',
    '  authorized auth_ms92abc123 · blinkit has not confirmed an order yet',
    '  merchant status: submitted',
    '',
    '  reserve untouched — nothing drawn',
    '  NO RECEIPT WRITTEN — refusing to attest to an order the merchant never confirmed',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'ALLOW');
  assert.equal(result.authorizationId, 'auth_ms92abc123');
  assert.equal(result.receiptId, undefined);
  assert.equal(result.orderId, undefined);
  assert.equal(result.handoffUrl, undefined);
});

test('real ALLOW output (Blinkit shape) parses verdict, authorizationId, receipt, amount, and order id', () => {
  const stdout = [
    '› blinkit place-order --confirm',
    'ALLOW  blinkit/place-order · ₹60',
    '✓ TRANSACTION AUTHORIZED auth_ms8def456',
    '  blinkit · ₹60 · reserve verified ₹1,000',
    '  no money moved yet — awaiting merchant confirmation',
    '✓ MERCHANT ORDER CONFIRMED · blinkit · order #ORD456789',
    '✓ blinkit/place-order executed · runId run_abc123',
    '  receipt rcp_ms8xyz789',
    '  amount ₹60',
    '  order id ORD456789',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'ALLOW');
  assert.equal(result.authorizationId, 'auth_ms8def456');
  assert.equal(result.receiptId, 'rcp_ms8xyz789');
  assert.equal(result.orderId, 'ORD456789');
  assert.equal(result.amountInr, 60);
  assert.equal(result.denyCode, undefined);
});

test('real ALLOW output with a commit-proof (Zepto-shaped, no order id) parses commitProof instead', () => {
  const stdout = [
    'ALLOW  zepto/place-order · ₹200',
    '✓ zepto/place-order executed · runId run_def456',
    '  receipt rcp_ms8zzz111',
    '  amount ₹200',
    '  commit proof confirmed:success',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'ALLOW');
  assert.equal(result.orderId, undefined);
  assert.equal(result.commitProof, 'confirmed:success');
});

test('real DENY OVER_PER_TXN_CAP output (verified live this session) parses verdict and denyCode', () => {
  // Exact transcript from a live run this session: a real ₹60 Blinkit cart against a ₹50 cap.
  const stdout = [
    '› blinkit place-order --confirm',
    'DENY  blinkit/place-order · OVER_PER_TXN_CAP · ₹60',
    '  transaction ₹60 · limit ₹50',
    '  over by ₹10',
    '',
    '  reserve untouched',
    '  NO BROWSER ACTION TAKEN',
    '  → step-up required',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'DENY');
  assert.equal(result.denyCode, 'OVER_PER_TXN_CAP');
  assert.equal(result.overBy, 10);
});

test('DENY OVER_TOTAL_CAP with a large comma-formatted overBy parses the numeric value correctly', () => {
  const stdout = ['DENY  blinkit/place-order · OVER_TOTAL_CAP · ₹5,400', '  over by ₹1,250.50'].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.denyCode, 'OVER_TOTAL_CAP');
  assert.equal(result.overBy, 1250.5);
});

test('STEP_UP verdict parses with no receipt/order fields', () => {
  const stdout = ['STEP_UP  blinkit/place-order', '  reserve unchanged', '  NO BROWSER ACTION TAKEN'].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'STEP_UP');
  assert.equal(result.receiptId, undefined);
  assert.equal(result.orderId, undefined);
});

test('the "✗" prefix on a failed commit-proof line does not break verdict parsing', () => {
  // gate.ts prints "✗ blinkit/place-order did NOT complete — ..." on a proof failure — that line
  // itself carries no ALLOW/DENY/STEP_UP token, so this exercises verdict being genuinely absent.
  const stdout = '✗ blinkit/place-order did NOT complete — no order id returned by blinkit';
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, undefined);
});

test('a BigBasket-style hand-off line is parsed, for a merchant with no order-placing command', () => {
  // Not currently reachable by any of the three configured merchants (commit-spec.ts gives all
  // three proof:'orderId'/'confirmed' now) — kept parseable for a future site in that state.
  const stdout = [
    '✓ district/checkout completed — ₹450 approved, awaiting your final click',
    '  district exposes no order-placing command, so the gate cannot complete the purchase',
    '  finish here: https://district.in/checkout/abc123',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.handoffUrl, 'https://district.in/checkout/abc123');
  assert.equal(result.receiptId, undefined);
});

test('ANSI-colored real output (verified live 2026-07-31) still parses verdict — the exact bug that collapsed every awaiting-confirmation run into a generic denial', () => {
  // Captured verbatim from a real `gate run -- webcmd blinkit place-order --confirm` spawned as a
  // child process this session: gate.ts's formatGateEventLine() always emits raw ANSI codes with no
  // TTY detection, so the real ALLOW line looks like this, not plain text. VERDICT_RE anchored to
  // the literal start of the line, which is the escape sequence — the match silently failed and
  // every downstream branch treated a genuine ALLOW as if decide() had denied it.
  const stdout = [
    '› blinkit place-order --confirm',
    '\x1b[32m\x1b[1mALLOW\x1b[0m\x1b[32m  blinkit/place-order · ₹20\x1b[0m',
    '✓ TRANSACTION AUTHORIZED auth_ms97descb6fe48e48405',
    '  blinkit · ₹20 · reserve verified ₹1,170',
    '  no money moved yet — awaiting merchant confirmation',
  ].join('\n');
  const result = parseCommitOutput(stdout);
  assert.equal(result.verdict, 'ALLOW');
  assert.equal(result.authorizationId, 'auth_ms97descb6fe48e48405');
});

test('empty or unrelated stdout parses to all-undefined rather than throwing', () => {
  const result = parseCommitOutput('');
  assert.deepEqual(result, {
    verdict: undefined,
    denyCode: undefined,
    overBy: undefined,
    authorizationId: undefined,
    receiptId: undefined,
    orderId: undefined,
    commitProof: undefined,
    amountInr: undefined,
    handoffUrl: undefined,
  });
});
