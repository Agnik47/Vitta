// Unit tests for decide() — the single most important test suite in the project. See
// docs/PROMPTS.md Phase 1b. Rule order is part of the contract: several tests here exist
// specifically to prove which rule wins when two would otherwise both fire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, sign } from '../mandate/sign';
import type { Mandate } from '../mandate/schema';
import { decide, type SpendRequest } from './decide';

const { privateKey, publicKey } = generateKeyPair();
const otherKeyPair = generateKeyPair(); // a different keypair, for a genuinely bad signature

const NOW = new Date('2026-07-28T12:00:00.000Z');
const FUTURE_EXPIRY = '2026-07-28T18:00:00.000Z'; // after NOW
const PAST_EXPIRY = '2000-01-01T00:00:00.000Z'; // before NOW

function makeMandate(scopeOverrides: Partial<Mandate['scope']> = {}, signWithBadKey = false): Mandate {
  const unsigned: Omit<Mandate, 'sig'> = {
    mandate_id: 'mnd_test',
    issuer: 'did:key:z6Mktest',
    subject: 'agent:grocery-runner',
    scope: {
      categories: ['groceries'],
      merchants: ['blinkit', 'zepto', 'bigbasket'],
      cap_inr: 800,
      per_txn_inr: 800,
      max_txns: 1,
      expires_at: FUTURE_EXPIRY,
      ...scopeOverrides,
    },
    reserve: { type: 'prava_mandate_sandbox', blocked_inr: 800, ref: 'mdt_test' },
  };
  const sig = sign(unsigned, signWithBadKey ? otherKeyPair.privateKey : privateKey);
  return { ...unsigned, sig };
}

const readReq: SpendRequest = { command: 'blinkit/search', site: 'blinkit', access: 'read' };
const unknownReq: SpendRequest = { command: 'blinkit/no-such-command', site: 'blinkit', access: undefined };
const writeReq = (overrides: Partial<SpendRequest> = {}): SpendRequest => ({
  command: 'blinkit/place-order',
  site: 'blinkit',
  access: 'write',
  amountInr: 500,
  ...overrides,
});

test('read access always allows, regardless of mandate state', () => {
  const expired = makeMandate({ expires_at: PAST_EXPIRY });
  assert.deepEqual(decide(readReq, expired, publicKey, 0, 0, NOW), { verdict: 'ALLOW' });
});

test('read access allows even against a badly signed mandate — proves Rule 0 (read) fires before Rule 1 (signature)', () => {
  const badlySigned = makeMandate({}, true);
  assert.deepEqual(decide(readReq, badlySigned, publicKey, 0, 0, NOW), { verdict: 'ALLOW' });
});

test('unknown command (access undefined) denies with UNKNOWN_COMMAND', () => {
  const mandate = makeMandate();
  const result = decide(unknownReq, mandate, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'UNKNOWN_COMMAND');
});

test('expired mandate denies with EXPIRED even if amount is fine', () => {
  const mandate = makeMandate({ expires_at: PAST_EXPIRY });
  const result = decide(writeReq(), mandate, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'EXPIRED');
});

test('bad signature denies with BAD_SIGNATURE before any other rule can fire (beats EXPIRED)', () => {
  const badlySignedAndExpired = makeMandate({ expires_at: PAST_EXPIRY }, true);
  const result = decide(writeReq(), badlySignedAndExpired, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'BAD_SIGNATURE');
});

test('amount over per_txn_inr denies with OVER_PER_TXN_CAP and correct overBy', () => {
  const mandate = makeMandate({ per_txn_inr: 400, cap_inr: 1000 });
  const result = decide(writeReq({ amountInr: 500 }), mandate, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'OVER_PER_TXN_CAP');
  assert.equal((result as { overBy: number }).overBy, 100);
});

test('amount over remaining ledgerBalanceInr denies with OVER_TOTAL_CAP and correct overBy', () => {
  const mandate = makeMandate({ per_txn_inr: 800, cap_inr: 800 });
  const result = decide(writeReq({ amountInr: 500 }), mandate, publicKey, /* ledgerBalanceInr */ 300, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'OVER_TOTAL_CAP');
  assert.equal((result as { overBy: number }).overBy, 200);
});

test('merchant not in mandate.scope.merchants denies with MERCHANT_NOT_ALLOWED', () => {
  const mandate = makeMandate({ merchants: ['zepto', 'bigbasket'] });
  const result = decide(writeReq({ site: 'blinkit' }), mandate, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'MERCHANT_NOT_ALLOWED');
});

test('txnCountSoFar >= max_txns denies with TXN_LIMIT_REACHED', () => {
  const mandate = makeMandate({ max_txns: 1 });
  const result = decide(writeReq(), mandate, publicKey, 1000, /* txnCountSoFar */ 1, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'TXN_LIMIT_REACHED');
});

test('amount unparseable (undefined) denies with AMOUNT_UNPARSEABLE', () => {
  const mandate = makeMandate();
  const result = decide(writeReq({ amountInr: undefined }), mandate, publicKey, 1000, 0, NOW);
  assert.equal(result.verdict, 'DENY');
  assert.equal((result as { code: string }).code, 'AMOUNT_UNPARSEABLE');
});

test('a request satisfying every rule allows', () => {
  const mandate = makeMandate({ per_txn_inr: 800, cap_inr: 800, max_txns: 1 });
  const result = decide(writeReq({ amountInr: 500 }), mandate, publicKey, 800, 0, NOW);
  assert.deepEqual(result, { verdict: 'ALLOW' });
});
