// Read-only mirrors of src/mandate/schema.ts, src/events/GateEvent.ts, src/receipt/schema.ts.
// Deliberately duplicated, not imported — see docs/06-DASHBOARD-SPEC.md § Why a second app
// instead of extending the CLI. Keep in sync by hand if the backend's shape changes.

export interface Mandate {
  mandate_id: string;
  issuer: string;
  subject: string;
  scope: {
    categories: string[];
    merchants: string[];
    cap_inr: number;
    per_txn_inr: number;
    max_txns: number;
    expires_at: string;
  };
  reserve: {
    type: 'dodo_credit_test';
    blocked_inr: number;
    ref: string;
  };
  sig: string;
}

export type DenyCode =
  | 'BAD_SIGNATURE'
  | 'EXPIRED'
  | 'UNKNOWN_COMMAND'
  | 'MERCHANT_NOT_ALLOWED'
  | 'AMOUNT_UNPARSEABLE'
  | 'OVER_PER_TXN_CAP'
  | 'OVER_TOTAL_CAP'
  | 'TXN_LIMIT_REACHED'
  | 'CART_DRIFT'
  | 'INSUFFICIENT_RESERVE'
  | 'ALREADY_EXECUTED';

export interface GateEvent {
  event_id: string;
  ts: string;
  mandate_id: string;
  mandate_hash: string;
  command: string;
  access: 'read' | 'write';
  verdict: 'ALLOW' | 'DENY' | 'STEP_UP';
  code?: DenyCode;
  amount_inr?: number;
  run_id?: string;
  reserve_ref?: string;
  trace_digest?: string;
}

export interface Receipt {
  receipt_id: string;
  // Optional (not required, unlike src/receipt/schema.ts's Receipt) — a receipt signed before the
  // two-stage authorization/confirmation split genuinely has no authorization_id, and that's an
  // honest fact about it, not a validation error.
  authorization_id?: string;
  mandate_hash: string;
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: 'dodo_test'; reserve_ref: string; status: 'captured' };
  execution: { command: string; run_id: string; profile: string };
  evidence: { trace_digest: string; network_order_id?: string; commit_proof?: string };
  prev_receipt_hash: string;
  signed_at: string;
  sig: string;
}

// Read-only mirror of src/receipt/authorization.ts's TransactionAuthorization — see that file for
// the full "why this exists" reasoning. Created the moment decide() returns ALLOW for a commit
// command, before the browser ever touches the merchant's checkout; never implies money moved or
// that the merchant confirmed anything.
export interface TransactionAuthorization {
  authorization_id: string;
  run_id: string;
  mandate_id: string;
  mandate_hash: string;
  merchant: string;
  cart: { items: number; total_inr: number };
  verdict: 'ALLOW';
  reserve_verified_inr: number;
  authorized_at: string;
  sig: string;
}
