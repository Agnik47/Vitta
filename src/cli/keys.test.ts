import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sign, verify } from '../mandate/sign';
import { getOrCreateKeyPair } from './keys';

function withTempKeysDir(fn: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), 'gate-keys-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('generates a keypair on first use and persists it to disk', () => {
  withTempKeysDir((dir) => {
    const { privateKey, publicKey } = getOrCreateKeyPair('gate', dir);
    const sig = sign({ hello: 'world' }, privateKey);
    assert.equal(verify({ hello: 'world' }, sig, publicKey), true);
  });
});

test('a second call reloads the same keypair from disk, not a fresh one', () => {
  withTempKeysDir((dir) => {
    const first = getOrCreateKeyPair('issuer', dir);
    const sig = sign({ x: 1 }, first.privateKey);

    const second = getOrCreateKeyPair('issuer', dir);
    // If this were a freshly-generated key instead of the same one reloaded, verification
    // against a signature made with the first call's private key would fail.
    assert.equal(verify({ x: 1 }, sig, second.publicKey), true);
  });
});

test('issuer and gate keys are independent', () => {
  withTempKeysDir((dir) => {
    const issuer = getOrCreateKeyPair('issuer', dir);
    const gate = getOrCreateKeyPair('gate', dir);
    const sig = sign({ x: 1 }, issuer.privateKey);
    assert.equal(verify({ x: 1 }, sig, gate.publicKey), false);
  });
});

test('refuses to silently regenerate over an inconsistent key state (private missing, public present)', () => {
  withTempKeysDir((dir) => {
    writeFileSync(path.join(dir, 'gate.public.pem'), '-----BEGIN PUBLIC KEY-----\nnot-a-real-key\n-----END PUBLIC KEY-----\n');
    assert.throws(() => getOrCreateKeyPair('gate', dir), /Inconsistent key state/);
  });
});
