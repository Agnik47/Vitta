# 04 — Policy Engine Spec

Read `00-PRODUCT-BRIEF.md`, `01-ARCHITECTURE.md` first. This is the spec for the single most important file in the codebase: `src/policy/decide.ts`. Build and unit-test this before touching webcmd or Dodo — it is a pure function and needs zero infrastructure to test.

## The Mandate schema

```ts
// src/mandate/schema.ts

export interface Mandate {
  mandate_id: string;        // e.g. "mnd_01J8..." (ULID recommended)
  issuer: string;            // "did:key:z6Mk..." — the human, DID-shaped
  subject: string;           // "agent:grocery-runner" — the agent this mandate applies to
  scope: {
    categories: string[];    // e.g. ["groceries"]
    merchants: string[];     // e.g. ["blinkit", "zepto", "bigbasket"] — matches webcmd's site keys
    cap_inr: number;         // total spend cap across the mandate's lifetime
    per_txn_inr: number;     // max spend in a single transaction
    max_txns: number;        // max number of allowed write transactions
    expires_at: string;      // ISO 8601
  };
  reserve: {
    type: 'dodo_credit_test'; // labelled honestly — see 00-PRODUCT-BRIEF.md § Hard scope boundary
    blocked_inr: number;
    ref: string;              // Dodo reserveRef from Ledger.fund()
  };
  sig: string;                 // Ed25519 signature, base64 or hex
}
```

## Canonical JSON + Ed25519 signing

Build and test this before anything else in this spec. Signature verification bugs discovered late in the schedule are unrecoverable.

```ts
// src/mandate/sign.ts
import crypto from 'node:crypto';

/** Deterministic serialization: sorted keys, no whitespace. Sign/verify MUST use this, never JSON.stringify directly. */
export function canonicalJSON(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj));
}

function sortKeysDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => {
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
```

Test the round-trip before writing anything else: sign an object, mutate one field, confirm verification fails; sign an object, verify it unmodified, confirm it passes.

### `renderConsent()` — the human-readable mandate sentence

```ts
// src/mandate/render.ts
export function renderConsent(m: Mandate): string {
  const merchants = m.scope.merchants.map(capitalize).join(', ');
  const time = new Date(m.scope.expires_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${m.subject} may spend up to ₹${m.scope.cap_inr} at ${merchants}, in one transaction, before ${time} today.`;
}
```

## The `decide()` function

```ts
// src/policy/decide.ts

export type Decision =
  | { verdict: 'ALLOW'; runBinding?: string }
  | { verdict: 'DENY'; code: DenyCode; reason: string; overBy?: number }
  | { verdict: 'STEP_UP'; reason: string };

export interface SpendRequest {
  command: string;      // "blinkit/place-order"
  site: string;          // "blinkit"
  access: 'read' | 'write' | undefined; // undefined = command not found in the webcmd manifest — see § Rule order note below
  amountInr?: number;    // authoritative cart total, if applicable
}

export function decide(
  req: SpendRequest,
  mandate: Mandate,
  publicKey: crypto.KeyObject,
  ledgerBalanceInr: number,
  txnCountSoFar: number,
  now: Date
): Decision {
  // Rule 0 — reads are free, short-circuit before any mandate check at all — no signature
  // check, no expiry check. See § Rule order note below for why this moved ahead of
  // signature/expiry.
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
    return { verdict: 'DENY', code: 'OVER_PER_TXN_CAP', reason: 'Amount exceeds per-transaction cap.', overBy: req.amountInr - mandate.scope.per_txn_inr };
  }
  // Rule 7 — total cap across mandate lifetime
  if (ledgerBalanceInr < req.amountInr) { // ledgerBalanceInr already reflects cap minus spent
    return { verdict: 'DENY', code: 'OVER_TOTAL_CAP', reason: 'Amount exceeds remaining mandate cap.', overBy: req.amountInr - ledgerBalanceInr };
  }
  // Rule 8 — transaction count limit
  if (txnCountSoFar >= mandate.scope.max_txns) {
    return { verdict: 'DENY', code: 'TXN_LIMIT_REACHED', reason: 'Maximum transaction count for this mandate reached.' };
  }
  // Rule 9 — cart drift: compare to a previously-approved total if one exists (implementation-specific)
  // Rule 10 — reserve has sufficient blocked balance (usually implied by rule 7 if ledgerBalanceInr is sourced live from Dodo)

  return { verdict: 'ALLOW' };
}
```

**Rule order is the spec.** The first failing rule is the DENY reason shown on screen during the demo. Do not reorder rules 0–8 without a reason, and if you do, update this document to match — `05-DEMO-SCRIPT.md` depends on `OVER_TOTAL_CAP` being the deny reason for the scripted over-cap scenario.

**Rule order note (corrected during Phase 1b, 2026-07-29):** the read-access short-circuit was originally Rule 3, after signature (Rule 0) and expiry (Rule 1). That was a real bug: `03-WEBCMD-INTEGRATION.md` § Step 3 is explicit that reads get "no mandate check, no ledger touch, no signature verification," and `docs/PROMPTS.md` Phase 1b's own required test is literally titled "read access always allows, regardless of mandate state" — with signature/expiry checked first, a read against an expired or badly-signed mandate would have been denied, contradicting both. Read access is now Rule 0, ahead of everything else; signature (now Rule 1), expiry (now Rule 2), and unknown-command (now Rule 3) all kept their relative order among themselves, just shifted down by one. This does not affect the `OVER_TOTAL_CAP` scripted scenario referenced above — that path is unreachable until Rule 4 (merchant) regardless of numbering. See `docs/OUTCOME.md` Phase 1b for the full write-up.

`SpendRequest.access` is typed `'read' | 'write' | undefined`, not just `'read' | 'write'` as originally sketched — the manifest lookup in `03-WEBCMD-INTEGRATION.md` (`Map<string, 'read'|'write'>`) returns `undefined` for an unrecognized command, and Rule 3 needs to actually be able to observe that value. Under the original narrower type, Rule 3's `req.access === undefined` check was unreachable dead code.

`decide()` must have zero I/O. `ledgerBalanceInr` and `txnCountSoFar` are computed by the caller (which does talk to Dodo/disk) and passed in as plain numbers. Unit test with fake mandates, fake balances, fake dates — no network, no filesystem, no webcmd.

## The Receipt schema

Emitted on every ALLOW of a write command.

```ts
// src/receipt/schema.ts

export interface Receipt {
  receipt_id: string;             // e.g. "rcp_..."
  mandate_hash: string;           // sha256 of canonicalJSON(mandate)
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: 'dodo_test'; reserve_ref: string; status: 'captured' };
  execution: { command: string; run_id: string; profile: string };
  evidence: { trace_digest: string; network_order_id?: string };
  prev_receipt_hash: string;      // sha256 of the previous receipt, or "sha256:0000..." for chain head
  signed_at: string;              // ISO 8601
  sig: string;                    // Ed25519, signed with the gate's own key, not the mandate issuer's
}
```

Shape: intent → cart → payment, with webcmd's own `run_id` and a trace digest as the evidence layer.

```ts
// src/receipt/chain.ts
export function buildAndSignReceipt(fields: Omit<Receipt, 'sig' | 'signed_at'>, gatePrivateKey: crypto.KeyObject): Receipt {
  const signed_at = new Date().toISOString();
  const unsigned = { ...fields, signed_at };
  const sig = sign(unsigned, gatePrivateKey);
  return { ...unsigned, sig };
}

export function verifyReceipt(receipt: Receipt, gatePublicKey: crypto.KeyObject): boolean {
  const { sig, ...rest } = receipt;
  return verify(rest, sig, gatePublicKey);
}
```

`gate verify <receipt.json>` walks the whole chain (`prev_receipt_hash` links) and prints pass/fail per receipt. Implement chain-walking by loading all receipts, sorting by `signed_at`, and confirming each one's `prev_receipt_hash` matches `sha256(canonicalJSON(previous receipt))`.

## Unit tests to write first, before any webcmd or Dodo code

```ts
// src/policy/decide.test.ts — illustrative, not exhaustive
test('read access always allows, regardless of mandate state', ...);
test('unknown command denies with UNKNOWN_COMMAND', ...);
test('expired mandate denies with EXPIRED even if amount is fine', ...);
test('amount over per_txn_inr denies with OVER_PER_TXN_CAP and correct overBy', ...);
test('amount over remaining cap denies with OVER_TOTAL_CAP', ...);
test('bad signature denies with BAD_SIGNATURE before any other rule fires', ...);
test('merchant not in scope denies with MERCHANT_NOT_ALLOWED', ...);
test('valid request within all bounds allows', ...);
```

If these pass before Saturday, the single highest-variance part of the system is already de-risked.
