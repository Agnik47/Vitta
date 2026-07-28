// Receipt type. See docs/04-POLICY-ENGINE-SPEC.md § The Receipt schema.
// Emitted on every ALLOW of a write command. Shape: intent -> cart -> payment, with webcmd's
// own run_id and a trace digest as the evidence layer.

export interface Receipt {
  receipt_id: string; // e.g. "rcp_..."
  mandate_hash: string; // sha256 of canonicalJSON(mandate)
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: 'dodo_test'; reserve_ref: string; status: 'captured' };
  execution: { command: string; run_id: string; profile: string };
  evidence: { trace_digest: string; network_order_id?: string };
  prev_receipt_hash: string; // sha256 of the previous receipt, or the chain-head placeholder — see chain.ts CHAIN_HEAD_HASH
  signed_at: string; // ISO 8601
  sig: string; // Ed25519, signed with the gate's own key, not the mandate issuer's
}
