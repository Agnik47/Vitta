// Tests for the receipt hash-chain. See docs/PROMPTS.md Phase 1e — the two required behaviors
// are the tamper test the live demo depends on (docs/05-DEMO-SCRIPT.md Beat 7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair } from '../mandate/sign';
import { buildAndSignReceipt, verifyReceipt, verifyChain, sha256Hex, CHAIN_HEAD_HASH } from './chain';
import type { Receipt } from './schema';

const gateKeys = generateKeyPair();

function baseFields(overrides: Partial<Omit<Receipt, 'sig' | 'signed_at'>> = {}): Omit<Receipt, 'sig' | 'signed_at'> {
  return {
    receipt_id: 'rcp_1',
    authorization_id: 'auth_1',
    mandate_hash: 'sha256:deadbeef',
    cart: { merchant: 'blinkit', items: 7, total_inr: 1412 },
    payment: { rail: 'dodo_test', reserve_ref: 'cks_test', status: 'captured' },
    execution: { command: 'blinkit/place-order', run_id: 'run_1', profile: 'hack' },
    evidence: { trace_digest: 'sha256:abc123' },
    prev_receipt_hash: CHAIN_HEAD_HASH,
    ...overrides,
  };
}

test('buildAndSignReceipt() + verifyReceipt() round-trip: an unmodified receipt verifies', () => {
  const receipt = buildAndSignReceipt(baseFields(), gateKeys.privateKey);
  assert.equal(verifyReceipt(receipt, gateKeys.publicKey), true);
});

test('a single-receipt chain (chain head only) verifies cleanly', () => {
  const receipt = buildAndSignReceipt(baseFields(), gateKeys.privateKey);
  const [result] = verifyChain([receipt], gateKeys.publicKey);
  assert.equal(result.signature_valid, true);
  assert.equal(result.chain_link_valid, true);
});

test('a valid two-receipt chain verifies cleanly end to end', () => {
  const first = buildAndSignReceipt(baseFields({ receipt_id: 'rcp_1' }), gateKeys.privateKey);
  const second = buildAndSignReceipt(
    baseFields({ receipt_id: 'rcp_2', prev_receipt_hash: sha256Hex(first) }),
    gateKeys.privateKey,
  );

  const results = verifyChain([first, second], gateKeys.publicKey);
  assert.equal(results.length, 2);
  for (const result of results) {
    assert.equal(result.signature_valid, true, `${result.receipt_id} signature should be valid`);
    assert.equal(result.chain_link_valid, true, `${result.receipt_id} chain link should be valid`);
  }
});

test('editing any field in the first receipt breaks the SECOND receipt\'s chain link, not just the first receipt\'s own signature', () => {
  const first = buildAndSignReceipt(baseFields({ receipt_id: 'rcp_1' }), gateKeys.privateKey);
  const second = buildAndSignReceipt(
    baseFields({ receipt_id: 'rcp_2', prev_receipt_hash: sha256Hex(first) }),
    gateKeys.privateKey,
  );

  // Simulate the Beat 7 tamper test: a direct file edit changes a field after signing, without
  // re-signing (that's the whole point — a tamperer doesn't have the gate's private key).
  const tamperedFirst: Receipt = { ...first, cart: { ...first.cart, total_inr: 9999 } };

  const results = verifyChain([tamperedFirst, second], gateKeys.publicKey);
  const [firstResult, secondResult] = results;

  assert.equal(firstResult.signature_valid, false, 'the tampered receipt\'s own signature must fail');
  assert.equal(secondResult.signature_valid, true, 'the second receipt was never touched — its own signature must still pass');
  assert.equal(secondResult.chain_link_valid, false, 'the second receipt\'s chain link must fail — it points to a hash the tampered first receipt no longer produces');
});
