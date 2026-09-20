// Read-only mirror of src/agents/runs-store.ts's FlowRecord (and the protocol types inside it).
// Deliberately duplicated, not imported — see lib/types.ts's header and docs/06-DASHBOARD-SPEC.md.
// Plain data, safe on both sides of the client/server boundary.

export type AgentStageStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type AgentRunStatus =
  | "RUNNING"
  | "PURCHASED"
  | "HANDOFF"
  | "DENIED"
  | "STEP_UP_REQUIRED"
  | "NO_PRODUCTS"
  | "NO_PURCHASE"
  | "REVIEW"
  | "FAILED";

export interface AgentStep {
  name: string;
  status: "ok" | "failed" | "skipped";
  detail: string;
  startedAt: string;
  durationMs: number;
}

export interface AgentRunError {
  code: string;
  message: string;
}

export interface AgentRunStage {
  agent: string;
  status: AgentStageStatus;
  span_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  summary?: string;
  steps: AgentStep[];
  error?: AgentRunError;
}

export interface AgentRunCandidate {
  merchant: string;
  product_name: string;
  price_inr: number;
  source: string;
  /** What the person needs to put the pick in their cart. Optional: not every source has both. */
  product_id?: string;
  product_url?: string;
}

export interface AgentRunOutcome {
  status: string;
  merchant: string;
  mode: "TEST" | "LIVE";
  mandate_id?: string;
  verdict?: "ALLOW" | "DENY" | "STEP_UP";
  deny_code?: string;
  reason?: string;
  requested_amount_inr?: number;
  allowed_amount_inr?: number;
  authorization_id?: string;
  receipt_id?: string;
  order_id?: string;
  run_id?: string;
  ledger_unreachable?: boolean;
}

export interface AgentRun {
  run_id: string;
  request_id: string;
  session_id: string;
  trace_id: string;
  source: "user" | "price-sniper";
  mode: "TEST" | "LIVE";
  request_text?: string;
  mandate_id?: string;
  status: AgentRunStatus;
  stages: AgentRunStage[];
  intent?: { product_query: string; quantity: number; max_price_inr?: number };
  proposal?: {
    proposed_action: "purchase" | "none";
    selected?: AgentRunCandidate;
    quantity?: number;
    expected_total_inr?: number;
    reason: string;
    considered: number;
  };
  outcome?: AgentRunOutcome;
  error?: AgentRunError;
  nasiko: { routed: boolean; url?: string; direct?: string[] };
  sandbox?: boolean;
  started_at: string;
  completed_at?: string;
}

export const AGENT_LABEL: Record<string, string> = {
  "vitta-shopping-planner": "Shopping Planner",
  "vitta-deal-discovery": "Deal Discovery",
  "vitta-deal-evaluator": "Deal Evaluator",
  "vitta-purchase-agent": "Purchase Agent",
};

export const AGENT_ROLE: Record<string, string> = {
  "vitta-shopping-planner": "Turns the request into a structured intent",
  "vitta-deal-discovery": "Finds candidates across merchants (Anakin)",
  "vitta-deal-evaluator": "Proposes the best eligible purchase",
  "vitta-purchase-agent": "Buys it — only through the Vitta gate",
};

export const RUN_STATUS_LABEL: Record<AgentRunStatus, string> = {
  RUNNING: "Running",
  PURCHASED: "Purchased",
  HANDOFF: "Approved · hand-off",
  DENIED: "Denied by Vitta",
  STEP_UP_REQUIRED: "Step-up required",
  NO_PRODUCTS: "No products found",
  NO_PURCHASE: "Nothing bought",
  REVIEW: "Ready for your review",
  FAILED: "Failed",
};

export function isRunActive(run: AgentRun): boolean {
  return run.status === "RUNNING";
}
