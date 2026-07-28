// sign + hash-link receipts, gate verify logic. See docs/04-POLICY-ENGINE-SPEC.md § The Receipt
// schema. Uses the same sign()/verify() from src/mandate/sign.ts — the gate has its own Ed25519
// keypair here, separate from the mandate issuer's.
import crypto from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import { canonicalJSON, sign, verify } from '../mandate/sign';
import type { Receipt } from './schema';

/** sha256 of canonicalJSON(obj), formatted "sha256:<hex>" — matches the display format used
 * throughout docs/05-DEMO-SCRIPT.md (e.g. "mandate sha256:4f2a..."). Reused for both
 * Receipt.mandate_hash (Phase 1f builds these) and the chain-hash below. */
export function sha256Hex(obj: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(canonicalJSON(obj)).digest('hex')}`;
}

/** prev_receipt_hash value for the first receipt in a chain — see docs/05-DEMO-SCRIPT.md Beat 6
 * ("prev sha256:0000... (chain head)"). */
export const CHAIN_HEAD_HASH = `sha256:${'0'.repeat(64)}`;

export function buildAndSignReceipt(fields: Omit<Receipt, 'sig' | 'signed_at'>, gatePrivateKey: KeyObject): Receipt {
  const signed_at = new Date().toISOString();
  const unsigned = { ...fields, signed_at };
  const sig = sign(unsigned, gatePrivateKey);
  return { ...unsigned, sig };
}

export function verifyReceipt(receipt: Receipt, gatePublicKey: KeyObject): boolean {
  const { sig, ...rest } = receipt;
  return verify(rest, sig, gatePublicKey);
}

export interface ChainVerification {
  receipt_id: string;
  signature_valid: boolean;
  chain_link_valid: boolean; // prev_receipt_hash matches the actual hash of the preceding receipt (or CHAIN_HEAD_HASH, for the first)
}

/** Loads a folder's worth of receipts (already-parsed, one per array entry — file I/O is the
 * caller's job, this stays pure), sorts by signed_at, and confirms each one's prev_receipt_hash
 * matches sha256Hex(previous receipt) and that each receipt's own signature verifies. */
export function verifyChain(receipts: Receipt[], gatePublicKey: KeyObject): ChainVerification[] {
  const sorted = [...receipts].sort((a, b) => a.signed_at.localeCompare(b.signed_at));
  return sorted.map((receipt, i) => {
    const expectedPrevHash = i === 0 ? CHAIN_HEAD_HASH : sha256Hex(sorted[i - 1]);
    return {
      receipt_id: receipt.receipt_id,
      signature_valid: verifyReceipt(receipt, gatePublicKey),
      chain_link_valid: receipt.prev_receipt_hash === expectedPrevHash,
    };
  });
}
