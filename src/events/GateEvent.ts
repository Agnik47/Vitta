// The one contract every phase reads. Populated in full from day one — never a placeholder,
// never restructured later. See docs/01-ARCHITECTURE.md § GateEvent for the source of this shape,
// and docs/common/03-INTERFACES.md for the cross-agent change protocol if it ever needs to change.

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
  event_id: string; // ULID or crypto.randomUUID()
  ts: string; // ISO 8601
  mandate_id: string;
  mandate_hash: string; // sha256 hex of canonicalJSON(mandate)
  command: string; // e.g. "blinkit/place-order"
  access: 'read' | 'write';
  verdict: 'ALLOW' | 'DENY' | 'STEP_UP';
  code?: DenyCode; // only set when verdict === 'DENY'
  amount_inr?: number;
  run_id?: string; // webcmd's runId, once bound
  reserve_ref?: string; // Prava checkout-session / credit-entitlement reference
  trace_digest?: string; // sha256 of webcmd's --trace artifact, only on ALLOW
}
