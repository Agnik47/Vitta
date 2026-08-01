// Receipt type. See docs/04-POLICY-ENGINE-SPEC.md § The Receipt schema.
// Emitted on every ALLOW of a write command. Shape: intent -> cart -> payment, with webcmd's
// own run_id and a trace digest as the evidence layer.
import type { ExecutionMode } from './execution-mode';

export interface Receipt {
  receipt_id: string; // e.g. "rcp_..."
  // Links back to the TransactionAuthorization created the moment decide() returned ALLOW for this
  // spend, before the merchant was ever asked to confirm anything — see src/receipt/authorization.ts.
  // Every receipt built by cmdRun()'s commit path always has one going forward.
  authorization_id: string;
  mandate_hash: string; // sha256 of canonicalJSON(mandate)
  cart: { merchant: string; items: number; total_inr: number };
  payment: { rail: 'prava_sandbox'; reserve_ref: string; status: 'authorized' };
  // `mode` records whether the merchant's own checkout was actually driven to a placed order (LIVE)
  // or the run settled against the Prava test reserve without placing one (TEST). See
  // ./execution-mode.ts. Optional only for backward compatibility: receipts written before this
  // field existed are LIVE by definition, since every one of them attested to a real merchant order.
  // Read it through receiptExecutionMode() rather than defaulting inline.
  execution: { command: string; run_id: string; profile: string; mode?: ExecutionMode };
  // `network_order_id` is the merchant's own order id, when the merchant returns one (Blinkit
  // does). `commit_proof` records what was accepted as proof of a real order for merchants that
  // don't expose an order id — e.g. Zepto's place-order returns only status/confirmed/message.
  //
  // On a LIVE receipt, exactly one of these is always present: ADR-013's rule is that nothing is
  // signed without some merchant-issued confirmation, and this field names which one it was.
  //
  // On a TEST receipt, BOTH are deliberately absent, and that is the honest result — no merchant
  // order was placed, so there is no merchant confirmation to name. This does not weaken ADR-013:
  // the rule is unchanged for LIVE, and a TEST receipt never claims a merchant order exists. The
  // two are told apart by `execution.mode`, which is inside the signed body and therefore just as
  // tamper-evident as the amount.
  evidence: { trace_digest: string; network_order_id?: string; commit_proof?: string };
  prev_receipt_hash: string; // sha256 of the previous receipt, or the chain-head placeholder — see chain.ts CHAIN_HEAD_HASH
  signed_at: string; // ISO 8601
  sig: string; // Ed25519, signed with the gate's own key, not the mandate issuer's
}
