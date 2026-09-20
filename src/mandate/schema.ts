// Mandate type + validator. See docs/04-POLICY-ENGINE-SPEC.md § The Mandate schema.

export interface Mandate {
  mandate_id: string; // e.g. "mnd_01J8..." (ULID recommended)
  issuer: string; // "did:key:z6Mk..." — the human, DID-shaped
  subject: string; // "agent:grocery-runner" — the agent this mandate applies to
  scope: {
    categories: string[]; // e.g. ["groceries"]
    merchants: string[]; // e.g. ["blinkit", "zepto", "bigbasket"] — matches webcmd's site keys
    cap_inr: number; // total spend cap across the mandate's lifetime
    per_txn_inr: number; // max spend in a single transaction
    max_txns: number; // max number of allowed write transactions
    expires_at: string; // ISO 8601
  };
  reserve: {
    // Labelled honestly — a test-mode reserve. 'prava_mandate_sandbox' is the previous rail: mandates
    // written under it stay readable and their signatures still verify, but a Razorpay ledger cannot
    // read their reserve, so they have to be funded again.
    type: 'razorpay_test_order' | 'prava_mandate_sandbox';
    blocked_inr: number;
    ref: string; // reserveRef from Ledger.fund(), e.g. razorpay-order:order_XXXX
  };
  sig: string; // Ed25519 signature, base64 or hex
}

/** Hand-written structural type guard — no validation library, per CLAUDE.md § Package choices. */
export function isMandate(value: unknown): value is Mandate {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  if (typeof m.mandate_id !== 'string') return false;
  if (typeof m.issuer !== 'string') return false;
  if (typeof m.subject !== 'string') return false;
  if (typeof m.sig !== 'string') return false;

  if (typeof m.scope !== 'object' || m.scope === null) return false;
  const scope = m.scope as Record<string, unknown>;
  if (!Array.isArray(scope.categories) || !scope.categories.every((c) => typeof c === 'string')) return false;
  if (!Array.isArray(scope.merchants) || !scope.merchants.every((c) => typeof c === 'string')) return false;
  if (typeof scope.cap_inr !== 'number') return false;
  if (typeof scope.per_txn_inr !== 'number') return false;
  if (typeof scope.max_txns !== 'number') return false;
  if (typeof scope.expires_at !== 'string') return false;

  if (typeof m.reserve !== 'object' || m.reserve === null) return false;
  const reserve = m.reserve as Record<string, unknown>;
  if (reserve.type !== 'razorpay_test_order' && reserve.type !== 'prava_mandate_sandbox') return false;
  if (typeof reserve.blocked_inr !== 'number') return false;
  if (typeof reserve.ref !== 'string') return false;

  return true;
}
