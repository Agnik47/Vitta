// canonicalJSON() + Ed25519 sign/verify. See docs/04-POLICY-ENGINE-SPEC.md § Canonical JSON + Ed25519 signing.
import crypto from 'node:crypto';

/** Deterministic serialization: sorted keys, no whitespace. Sign/verify MUST use this, never JSON.stringify directly. */
export function canonicalJSON(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj));
}

function sortKeysDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeysDeep(obj[k]);
        return acc;
      }, {} as any);
  }
  return obj;
}

export function generateKeyPair() {
  return crypto.generateKeyPairSync('ed25519');
}

export function sign(obj: unknown, privateKey: crypto.KeyObject): string {
  const sig = crypto.sign(null, Buffer.from(canonicalJSON(obj)), privateKey);
  return sig.toString('base64');
}

export function verify(obj: unknown, signatureB64: string, publicKey: crypto.KeyObject): boolean {
  const sig = Buffer.from(signatureB64, 'base64');
  return crypto.verify(null, Buffer.from(canonicalJSON(obj)), publicKey, sig);
}
