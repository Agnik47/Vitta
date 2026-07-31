// Receipt type. See docs/04-POLICY-ENGINE-SPEC.md § The Receipt schema.
// Emitted on every ALLOW of a write command. Shape: intent -> cart -> payment, with webcmd's
// own run_id and a trace digest as the evidence layer.

export interface Receipt {
  receipt_id: string; // e.g. "rcp_..."
  // Links back to the TransactionAuthorization created the moment decide() returned ALLOW for this
  // spend, before the merchant was ever asked to confirm anything — see src/receipt/authorization.ts.
  // Every receipt built by cmdRun()'s commit path always has one going forward.
  authorization_id: string;
  mandate_hash: string; // sha256 of canonicalJSON(mandate)
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: 'dodo_test'; reserve_ref: string; status: 'captured' };
  execution: { command: string; run_id: string; profile: string };
  // `network_order_id` is the merchant's own order id, when the merchant returns one (Blinkit
  // does). `commit_proof` records what was accepted as proof of a real order for merchants that
  // don't expose an order id — e.g. Zepto's place-order returns only status/confirmed/message.
  // Exactly one of these is always present on a signed receipt: ADR-013's rule is that nothing is
  // signed without some merchant-issued confirmation, and this field names which one it was.
  evidence: { trace_digest: string; network_order_id?: string; commit_proof?: string };
  prev_receipt_hash: string; // sha256 of the previous receipt, or the chain-head placeholder — see chain.ts CHAIN_HEAD_HASH
  signed_at: string; // ISO 8601
  sig: string; // Ed25519, signed with the gate's own key, not the mandate issuer's
}
