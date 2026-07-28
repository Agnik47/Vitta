// Tests for publicKeyToDidKey(). The "z6Mk" prefix is a well-known, deterministic property of
// real Ed25519 did:keys (fixed multicodec prefix bytes [0xed, 0x01] dominate the leading base58
// digits) — confirmed against several real generated keys before writing this test, not assumed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair } from './sign';
import { publicKeyToDidKey } from './did';

test('produces a real did:key with the expected Ed25519 prefix', () => {
  const { publicKey } = generateKeyPair();
  const did = publicKeyToDidKey(publicKey);
  assert.match(did, /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]+$/);
});

test('is deterministic for the same public key', () => {
  const { publicKey } = generateKeyPair();
  assert.equal(publicKeyToDidKey(publicKey), publicKeyToDidKey(publicKey));
});

test('different keys produce different did:key identifiers', () => {
  const a = generateKeyPair();
  const b = generateKeyPair();
  assert.notEqual(publicKeyToDidKey(a.publicKey), publicKeyToDidKey(b.publicKey));
});
