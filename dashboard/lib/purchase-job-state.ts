// Pure state machine logic for PurchaseJob transitions (ADR-015 Architecture Improvement #2).
//
// TRANSACTION_AUTHORIZED / WAITING_FOR_MERCHANT_CONFIRMATION / MERCHANT_CONFIRMED / DRAW_COMPLETED
// replace the old PAYING/ORDER_PLACED pair — see docs/OUTCOME.md's "two-stage tracking" entry. The
// mandate authorizing a spend (decide() ALLOW + a real, signed TransactionAuthorization) and the
// merchant actually confirming an order are two independent, both-real facts; this state machine
// keeps them distinguishable rather than collapsing an "authorized but still waiting on the
// merchant" run into a blunt FAILED. Kept in sync by hand with src/agent/purchase-job-state.ts —
// see docs/06-DASHBOARD-SPEC.md § Why a second app instead of extending the CLI.

export type PurchaseJobState =
  | "PENDING"
  | "SEARCH_COMPLETE"
  | "WAITING_FOR_SELECTION"
  | "ADDING_TO_CART"
  | "VERIFYING_CART"
  | "WAITING_GATE"
  | "TRANSACTION_AUTHORIZED"
  | "WAITING_FOR_MERCHANT_CONFIRMATION"
  | "MERCHANT_CONFIRMED"
  | "DRAW_COMPLETED"
  | "RECEIPT_READY"
  | "FAILED";

export interface StepEvent {
  type: "step";
  step?: string;
  status?: "running" | "done" | "skipped" | "failed";
  detail?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ResultEvent {
  type: "result";
  ok?: boolean;
  merchant?: string;
  productName?: string;
  verdict?: "ALLOW" | "DENY" | "STEP_UP";
  denyCode?: string;
  /** The real, signed TransactionAuthorization id — present whenever decide() returned ALLOW,
   *  whether or not the merchant went on to confirm an order. */
  authorizationId?: string;
  /** True specifically when the mandate authorized the spend but the merchant hasn't confirmed —
   *  distinct from a genuine policy DENY, which never sets this. */
  awaitingMerchantConfirmation?: boolean;
  receiptId?: string;
  orderId?: string;
  commitProof?: string;
  handoff?: boolean;
  finalAmountInr?: number;
  paymentStatus?: "captured" | "not_charged";
  failureReason?: string;
  completedAt?: string;
  [key: string]: unknown;
}

export type AgentLine = StepEvent | ResultEvent;

export function deriveJobState(events: AgentLine[], current: PurchaseJobState = "PENDING"): PurchaseJobState {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.type === "result") {
      if (ev.ok && ev.receiptId) return "RECEIPT_READY";
      if (ev.awaitingMerchantConfirmation) return "WAITING_FOR_MERCHANT_CONFIRMATION";
      // ok:true with no receiptId and not awaiting confirmation is the proof:'none' hand-off case
      // (a merchant with no order-placing command at all — the gate approved and drove the browser
      // as far as it can, but there is nothing for the merchant to confirm to us).
      if (ev.ok) return "MERCHANT_CONFIRMED";
      return "FAILED";
    }
    if (ev.type === "step") {
      if (ev.step === "add-to-cart") {
        if (ev.status === "running") return "ADDING_TO_CART";
        if (ev.status === "failed") return "FAILED";
      }
      if (ev.step === "verify-cart") {
        if (ev.status === "running") return "VERIFYING_CART";
        if (ev.status === "failed") return "FAILED";
      }
      if (ev.step === "order-value-check") {
        if (ev.status === "running") return "WAITING_GATE";
        if (ev.status === "failed") return "FAILED";
      }
      // 'commit' is only ever reached for a genuine policy DENY/STEP_UP now — a real ALLOW always
      // produces an 'authorize' step instead (see src/agent/PurchaseAgent.ts's run()).
      if (ev.step === "commit") {
        if (ev.status === "running") return "WAITING_GATE";
        if (ev.status === "failed") return "FAILED";
      }
      if (ev.step === "authorize" && ev.status === "done") {
        return "TRANSACTION_AUTHORIZED";
      }
      if (ev.step === "merchant-confirm") {
        if (ev.status === "failed") return "WAITING_FOR_MERCHANT_CONFIRMATION";
        if (ev.status === "done") return "MERCHANT_CONFIRMED";
      }
      if (ev.step === "draw" && ev.status === "done") {
        return "DRAW_COMPLETED";
      }
      if (ev.step === "confirm" && ev.status === "done") {
        return "RECEIPT_READY";
      }
    }
  }
  return current;
}
