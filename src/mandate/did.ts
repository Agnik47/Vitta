// publicKeyToDidKey(): real did:key (https://w3c-ccg.github.io/did-method-key/) encoding for an
// Ed25519 public key. Not cryptographically load-bearing anywhere in this codebase — decide()
// verifies mandates against a publicKey passed in directly, never by parsing mandate.issuer — but
// implementing this correctly (rather than a cosmetic "did:key:" + random string) costs little,
// needs zero new dependencies (node:crypto's JWK export + a hand-written base58btc encoder), and
// means mandate.issuer is a real, independently-verifiable identifier any did:key-aware tool could
// decode back to the same public key.
import type { KeyObject } from 'node:crypto';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// multicodec varint prefix for "ed25519-pub" (code 0xed), per https://github.com/multiformats/multicodec
const ED25519_PUB_MULTICODEC_PREFIX = Buffer.from([0xed, 0x01]);

function base58btcEncode(bytes: Buffer): string {
  let leadingZeros = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeros++;
  }

  let value = bytes.length > 0 ? BigInt(`0x${bytes.toString('hex')}`) : 0n;
  const digits: string[] = [];
  while (value > 0n) {
    const remainder = value % 58n;
    value /= 58n;
    digits.push(BASE58_ALPHABET[Number(remainder)]);
  }

  return '1'.repeat(leadingZeros) + digits.reverse().join('');
}

export function publicKeyToDidKey(publicKey: KeyObject): string {
  const jwk = publicKey.export({ format: 'jwk' }) as { x?: string };
  if (!jwk.x) {
    throw new Error('publicKeyToDidKey: expected an Ed25519 public key with a JWK x coordinate');
  }
  const rawKey = Buffer.from(jwk.x, 'base64url');
  const prefixed = Buffer.concat([ED25519_PUB_MULTICODEC_PREFIX, rawKey]);
  return `did:key:z${base58btcEncode(prefixed)}`;
}
