// getOrCreateKeyPair(): persistent Ed25519 keypairs for the CLI's two identities — the mandate
// issuer (the human) and the gate itself (signs receipts, per src/receipt/chain.ts's
// buildAndSignReceipt(fields, gatePrivateKey)). Neither Phase 1a nor 1e needed disk persistence
// since their functions just take KeyObjects as arguments; a real CLI spans separate process
// invocations, so these need a stable home — a gap Agent B found while building the dashboard's
// /receipts route (needs the gate's PUBLIC key independently). See docs/agent-b/WORKSPACE.md §
// Notes for Agent A and docs/OUTCOME.md Phase 1f.
//
// keys/ is gitignored entirely, including the public keys — consistent with mandates/, receipts/,
// etc. all being per-machine runtime state. The dashboard can read keys/gate.public.pem via the
// same MANDATE_GATE_DATA_DIR env var it already uses for mandates/receipts/events.jsonl
// (docs/06-DASHBOARD-SPEC.md) — no new configuration surface needed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { generateKeyPair } from '../mandate/sign';

export interface KeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export type KeyName = 'issuer' | 'gate';

const DEFAULT_KEYS_DIR = './keys';

export function getOrCreateKeyPair(name: KeyName, keysDir = DEFAULT_KEYS_DIR): KeyPair {
  const privatePath = path.join(keysDir, `${name}.private.pem`);
  const publicPath = path.join(keysDir, `${name}.public.pem`);
  const privateExists = existsSync(privatePath);
  const publicExists = existsSync(publicPath);

  if (privateExists !== publicExists) {
    throw new Error(
      `Inconsistent key state for "${name}": ${privateExists ? privatePath : publicPath} exists but ` +
        `${privateExists ? publicPath : privatePath} does not. Refusing to regenerate — that would ` +
        `silently orphan anything already signed with the existing key. Fix or remove both files manually.`,
    );
  }

  if (privateExists && publicExists) {
    return {
      privateKey: createPrivateKey(readFileSync(privatePath, 'utf-8')),
      publicKey: createPublicKey(readFileSync(publicPath, 'utf-8')),
    };
  }

  const { privateKey, publicKey } = generateKeyPair();
  mkdirSync(keysDir, { recursive: true });
  writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
  return { privateKey, publicKey };
}
