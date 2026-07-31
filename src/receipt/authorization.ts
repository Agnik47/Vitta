// TransactionAuthorization — the pre-merchant-confirmation half of a purchase, kept deliberately
// separate from Receipt. See docs/OUTCOME.md's "two-stage tracking" entry for the full reasoning;
// summary: Receipt means "signed, chain-linked, money moved" and must keep meaning exactly that.
// This object exists to honestly record an EARLIER, equally real fact — the mandate authorized this
// spend and the reserve was verified sufficient — without ever implying money moved or that the
// merchant accepted anything. It is signed (same gate keypair as Receipt) so it's just as tamper-
// evident, but deliberately NOT chain-linked — chaining is a Receipt-specific concept tied to the
// sequence of actual completed spends, and an authorization isn't one of those yet.
//
// Created only on a real decide() ALLOW for a commit command, before execute() ever touches the
// browser (src/cli/gate.ts). Never created for a DENY/STEP_UP — there is nothing to honestly
// authorize in that case.
import type { KeyObject } from 'node:crypto';
import { sign, verify } from '../mandate/sign';

export interface TransactionAuthorization {
  authorization_id: string;
  run_id: string;
  mandate_id: string;
  mandate_hash: string;
  merchant: string;
  /** What was authorized — the same real, resolved cart total decide() was actually handed, not a
   *  locally-recomputed figure. */
  cart: { items: number; total_inr: number };
  /** Always 'ALLOW' — this object's own existence already says so; kept explicit rather than
   *  implied, since a reader loading just this file shouldn't have to infer it. */
  verdict: 'ALLOW';
  /** The real reserve balance (INR) read from Dodo at authorization time, confirming it covered
   *  the cart total. */
  reserve_verified_inr: number;
  authorized_at: string; // ISO 8601
  sig: string; // Ed25519, signed with the gate's own key — same key Receipt uses, not the mandate issuer's
}

export function buildAndSignAuthorization(
  fields: Omit<TransactionAuthorization, 'sig' | 'authorized_at'>,
  gatePrivateKey: KeyObject,
): TransactionAuthorization {
  const authorized_at = new Date().toISOString();
  const unsigned = { ...fields, authorized_at };
  const sig = sign(unsigned, gatePrivateKey);
  return { ...unsigned, sig };
}

export function verifyAuthorization(authorization: TransactionAuthorization, gatePublicKey: KeyObject): boolean {
  const { sig, ...rest } = authorization;
  return verify(rest, sig, gatePublicKey);
}
