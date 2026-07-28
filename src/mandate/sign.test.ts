// Unit tests for canonicalJSON()/sign()/verify(). See docs/PROMPTS.md Phase 1a.
// Zero dependency on webcmd, Dodo, or the filesystem beyond reading its own inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJSON, generateKeyPair, sign, verify } from './sign';

test('signing an object and verifying it unmodified passes', () => {
  const { privateKey, publicKey } = generateKeyPair();
  const obj = { a: 1, b: 'two', c: [1, 2, 3] };
  const sig = sign(obj, privateKey);
  assert.equal(verify(obj, sig, publicKey), true);
});

test('mutating any single field after signing causes verification to fail', () => {
  const { privateKey, publicKey } = generateKeyPair();
  const obj = { a: 1, b: 'two', c: [1, 2, 3] };
  const sig = sign(obj, privateKey);

  assert.equal(verify({ ...obj, a: 2 }, sig, publicKey), false);
  assert.equal(verify({ ...obj, b: 'three' }, sig, publicKey), false);
  assert.equal(verify({ ...obj, c: [1, 2, 4] }, sig, publicKey), false);
});

test('canonicalJSON() produces identical output regardless of top-level key order', () => {
  const objA = { a: 1, b: 2 };
  const objB = { b: 2, a: 1 };
  assert.equal(canonicalJSON(objA), canonicalJSON(objB));
});

test('canonicalJSON() is deterministic through nested objects and arrays of objects', () => {
  const objA = { z: { y: 1, x: 2 }, a: [{ q: 1, p: 2 }] };
  const objB = { a: [{ p: 2, q: 1 }], z: { x: 2, y: 1 } };
  assert.equal(canonicalJSON(objA), canonicalJSON(objB));
});

test('a signature from one keypair does not verify against a different keypair', () => {
  const pair1 = generateKeyPair();
  const pair2 = generateKeyPair();
  const obj = { a: 1 };
  const sig = sign(obj, pair1.privateKey);
  assert.equal(verify(obj, sig, pair2.publicKey), false);
});
