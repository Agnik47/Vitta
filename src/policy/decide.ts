// decide() — the core policy decision function, pure, zero I/O.
// See docs/04-POLICY-ENGINE-SPEC.md § The decide() function. Rule order (0-8) is load-bearing —
// it determines which DENY reason a judge sees during the live demo. Do not reorder without
// updating that spec file to match, per CLAUDE.md rule 3 (fail closed).
import type { KeyObject } from 'node:crypto';
import type { Mandate } from '../mandate/schema';
import { verify } from '../mandate/sign';
import type { DenyCode } from '../events/GateEvent';

export type Decision =
  | { verdict: 'ALLOW'; runBinding?: string }
  | { verdict: 'DENY'; code: DenyCode; reason: string; overBy?: number }
  | { verdict: 'STEP_UP'; reason: string };

export interface SpendRequest {
  command: string; // "blinkit/place-order"
  site: string; // "blinkit"
  // undefined = command not found in the webcmd manifest (docs/03-WEBCMD-INTEGRATION.md's
  // Map<string, 'read'|'write'> returns undefined for an unknown key) — Rule 3 fails closed on
  // this. The original spec sketch typed this as 'read' | 'write' only, which would have made
  // that check unreachable dead code; widened to match what the manifest lookup actually
  // returns. See docs/OUTCOME.md Phase 1b.
  access: 'read' | 'write' | undefined;
  amountInr?: number; // authoritative cart total, if applicable
}

export function decide(
  req: SpendRequest,
  mandate: Mandate,
  publicKey: KeyObject,
  ledgerBalanceInr: number,
  txnCountSoFar: number,
  now: Date,
): Decision {
  // Rule 0 — reads are free, short-circuit before any mandate check at all. Moved ahead of
  // signature/expiry (originally Rule 3, after them) — docs/03-WEBCMD-INTEGRATION.md § Step 3
  // is explicit that reads get "no mandate check, no ledger touch, no signature verification,"
  // and docs/PROMPTS.md Phase 1b's own required test is literally titled "read access always
  // allows, regardless of mandate state." The original spec sketch's ordering (signature/expiry
  // before the read check) would have denied a read against an expired or badly-signed mandate,
  // contradicting both of those. See docs/OUTCOME.md Phase 1b for the full note.
  if (req.access === 'read') {
    return { verdict: 'ALLOW' };
  }
  // Rule 1 — signature valid?
  if (!verify(stripSig(mandate), mandate.sig, publicKey)) {
    return { verdict: 'DENY', code: 'BAD_SIGNATURE', reason: 'Mandate signature does not verify.' };
  }
  // Rule 2 — not expired?
  if (now >= new Date(mandate.scope.expires_at)) {
    return { verdict: 'DENY', code: 'EXPIRED', reason: 'Mandate has expired.' };
  }
  // Rule 3 — command known? (fail closed on anything not in the manifest)
  if (req.access === undefined) {
    return { verdict: 'DENY', code: 'UNKNOWN_COMMAND', reason: 'Command not found in webcmd manifest.' };
  }
  // Rule 4 — merchant in scope?
  if (!mandate.scope.merchants.includes(req.site)) {
    return { verdict: 'DENY', code: 'MERCHANT_NOT_ALLOWED', reason: `${req.site} is not in this mandate's scope.` };
  }
  // Rule 5 — amount parseable?
  if (req.amountInr === undefined || Number.isNaN(req.amountInr)) {
    return { verdict: 'DENY', code: 'AMOUNT_UNPARSEABLE', reason: 'Could not determine a numeric amount for this action.' };
  }
  // Rule 6 — per-transaction cap
  if (req.amountInr > mandate.scope.per_txn_inr) {
    return {
      verdict: 'DENY',
      code: 'OVER_PER_TXN_CAP',
      reason: 'Amount exceeds per-transaction cap.',
      overBy: req.amountInr - mandate.scope.per_txn_inr,
    };
  }
  // Rule 7 — total cap across the mandate's lifetime (ledgerBalanceInr already reflects cap minus spent)
  if (ledgerBalanceInr < req.amountInr) {
    return {
      verdict: 'DENY',
      code: 'OVER_TOTAL_CAP',
      reason: 'Amount exceeds remaining mandate cap.',
      overBy: req.amountInr - ledgerBalanceInr,
    };
  }
  // Rule 8 — transaction count limit
  if (txnCountSoFar >= mandate.scope.max_txns) {
    return { verdict: 'DENY', code: 'TXN_LIMIT_REACHED', reason: 'Maximum transaction count for this mandate reached.' };
  }
  // Rule 9 (cart drift) and Rule 10 (reserve balance) are noted in the spec as
  // implementation-specific / "usually implied by rule 7" — not separate checks here.

  return { verdict: 'ALLOW' };
}

function stripSig(mandate: Mandate): Omit<Mandate, 'sig'> {
  const { sig, ...rest } = mandate;
  return rest;
}
