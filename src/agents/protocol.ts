// The wire contract shared by the four Vitta shopping agents and whatever orchestrates them.
//
// Every agent speaks the same shape: an AgentRequest envelope in (correlation + typed input), an
// AgentResult out (typed data, or a structured error that keeps the ORIGINAL reason — a Vitta DENY
// is never flattened into a generic "purchase failed").
//
// Boundary (same as src/agent/PurchaseAgent.ts, CLAUDE.md rule 2): nothing under src/agents/ decides
// WHETHER money may move. The Evaluator proposes, the Purchase Agent asks the gate, and the gate —
// src/policy/decide.ts, reached only through the spawned `gate` CLI — is the sole authority.

export type MerchantId = 'blinkit' | 'zepto' | 'bigbasket';
export const MERCHANT_IDS: readonly MerchantId[] = ['blinkit', 'zepto', 'bigbasket'];

export function isMerchantId(value: unknown): value is MerchantId {
  return typeof value === 'string' && (MERCHANT_IDS as readonly string[]).includes(value);
}

export type ExecutionMode = 'TEST' | 'LIVE';

export type AgentName =
  | 'vitta-shopping-planner'
  | 'vitta-deal-discovery'
  | 'vitta-deal-evaluator'
  | 'vitta-purchase-agent';

export const AGENT_NAMES: readonly AgentName[] = [
  'vitta-shopping-planner',
  'vitta-deal-discovery',
  'vitta-deal-evaluator',
  'vitta-purchase-agent',
];

// ---------------------------------------------------------------------------------------------
// Correlation — one set of ids that follows a shopping request through every agent.
// ---------------------------------------------------------------------------------------------

export interface Correlation {
  /** The conversation. Stable across every request in one user session (or one Price Sniper watch). */
  sessionId: string;
  /** One shopping request. Also the purchase idempotency key: a replayed request never buys twice. */
  requestId: string;
  /** W3C traceparent for this hop. Nasiko groups hops (and applies its flow guard) per trace id. */
  traceparent: string;
  /** The mandate the purchase is expected to run under, when the caller knows it. Informational —
   *  `gate run` resolves the mandate itself; the agent never chooses which mandate authorizes it. */
  mandateId?: string;
  /** Who handed this to the agent: 'orchestrator', or another agent's name. */
  caller?: string;
}

export interface AgentRequest<I = unknown> {
  vitta: 1;
  correlation: Correlation;
  input: I;
}

// ---------------------------------------------------------------------------------------------
// Results and structured errors
// ---------------------------------------------------------------------------------------------

export type AgentErrorCode =
  | 'INVALID_REQUEST'
  | 'PLANNER_ERROR'
  | 'DISCOVERY_ERROR'
  | 'ANAKIN_ERROR'
  | 'NO_PRODUCTS_FOUND'
  | 'EVALUATION_ERROR'
  | 'PURCHASE_ERROR'
  | 'VITTA_DENIED'
  | 'VITTA_STEP_UP_REQUIRED'
  | 'LEDGER_ERROR'
  | 'DUPLICATE_REQUEST'
  | 'AGENT_UNREACHABLE'
  | 'AGENT_TIMEOUT';

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  /** Machine-readable specifics. For VITTA_DENIED this is a full PurchaseOutcome. */
  details?: unknown;
}

/** One unit of work inside an agent, kept so a run can be read back as a timeline. */
export interface AgentStep {
  name: string;
  status: 'ok' | 'failed' | 'skipped';
  detail: string;
  startedAt: string;
  durationMs: number;
}

export interface AgentOk<T> {
  ok: true;
  agent: AgentName;
  version: string;
  data: T;
  steps: AgentStep[];
  /** Nasiko's own trace id for this hop (the dispatch stream's `trace_meta`). Set by the client, only
   *  when the hop went through Nasiko; it is what Nasiko's trace view is keyed by, not our traceparent. */
  nasiko_trace_id?: string;
}

export interface AgentFailure {
  ok: false;
  agent: AgentName;
  version: string;
  error: AgentError;
  steps: AgentStep[];
  nasiko_trace_id?: string;
}

export type AgentResult<T = unknown> = AgentOk<T> | AgentFailure;

export function isAgentResult(value: unknown): value is AgentResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.ok !== 'boolean' || typeof v.agent !== 'string' || !Array.isArray(v.steps)) return false;
  if (v.ok) return 'data' in v;
  const e = v.error as Record<string, unknown> | undefined;
  return typeof e === 'object' && e !== null && typeof e.code === 'string' && typeof e.message === 'string';
}

// ---------------------------------------------------------------------------------------------
// Domain payloads
// ---------------------------------------------------------------------------------------------

/** What the user wants, structured. Produced by the Planner (or supplied by the Price Sniper). */
export interface ShoppingIntent {
  raw_request: string;
  product_query: string;
  category: string;
  quantity: number;
  /** Ceiling for the WHOLE line (unit price × quantity). The user's preference, not spending
   *  authority — the mandate still decides whether any of it may be spent. */
  max_price_inr?: number;
  purchase_required: boolean;
  /** Empty = search every supported merchant. */
  preferred_merchants: MerchantId[];
  source: 'user' | 'price-sniper';
  /** Set by the Price Sniper: watch exactly this product rather than searching. */
  pinned?: { merchant: MerchantId; product_id: string };
}

export interface Candidate {
  merchant: MerchantId;
  product_name: string;
  price_inr: number;
  availability: boolean;
  product_url?: string;
  product_id?: string;
  /** Which real source produced this row: 'anakin', 'webcmd', ... Never invented. */
  source: string;
}

export interface MerchantSearchError {
  merchant: MerchantId;
  error: string;
  source?: string;
}

export interface DiscoveryResult {
  candidates: Candidate[];
  merchant_errors: MerchantSearchError[];
}

export interface RejectedCandidate {
  candidate: Candidate;
  reason: string;
}

/** The Evaluator's recommendation. A proposal is NOT an authorization. */
export interface Proposal {
  proposed_action: 'purchase' | 'none';
  selected?: Candidate;
  quantity: number;
  /** price_inr × quantity — what the Evaluator expects the line to cost, before fees. */
  expected_total_inr?: number;
  reason: string;
  considered: number;
  rejected: RejectedCandidate[];
}

export type PurchaseStatus = 'PURCHASED' | 'HANDOFF' | 'DENIED' | 'STEP_UP_REQUIRED' | 'AWAITING_MERCHANT' | 'FAILED';

export interface PurchaseOutcome {
  status: PurchaseStatus;
  merchant: MerchantId;
  mode: ExecutionMode;
  mandate_id?: string;
  verdict?: 'ALLOW' | 'DENY' | 'STEP_UP';
  /** Vitta's own DenyCode, verbatim, e.g. OVER_PER_TXN_CAP. */
  deny_code?: string;
  /** Human-readable reason, verbatim from the gate where there is one. */
  reason?: string;
  /** The cart total the GATE priced from the real merchant cart — never the agent's own claim. */
  requested_amount_inr?: number;
  /** The limit that was exceeded, when the deny code names one (per-transaction cap). */
  allowed_amount_inr?: number;
  authorization_id?: string;
  receipt_id?: string;
  order_id?: string;
  /** The gate's own run id, read back from the signed receipt/authorization. */
  run_id?: string;
  /** True when the gate could not read the reserve and so treated it as ₹0 (fail-closed). */
  ledger_unreachable?: boolean;
  events: Array<{ step: string; status: string; detail: string; timestamp: string }>;
}

// ---------------------------------------------------------------------------------------------
// Helpers shared by every agent
// ---------------------------------------------------------------------------------------------

export const AGENT_VERSION = '0.1.0';

/** Times steps so an agent's result reads back as a timeline. */
export class StepRecorder {
  readonly steps: AgentStep[] = [];

  async run<T>(name: string, fn: () => Promise<T> | T, detail: (result: T) => string): Promise<T> {
    const startedAt = new Date();
    try {
      const result = await fn();
      this.steps.push({
        name,
        status: 'ok',
        detail: detail(result),
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      });
      return result;
    } catch (err) {
      this.steps.push({
        name,
        status: 'failed',
        detail: (err as Error).message,
        startedAt: startedAt.toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
      });
      throw err;
    }
  }

  note(name: string, status: AgentStep['status'], detail: string): void {
    this.steps.push({ name, status, detail, startedAt: new Date().toISOString(), durationMs: 0 });
  }
}

export function agentOk<T>(agent: AgentName, data: T, steps: AgentStep[]): AgentOk<T> {
  return { ok: true, agent, version: AGENT_VERSION, data, steps };
}

export function agentFail(agent: AgentName, error: AgentError, steps: AgentStep[]): AgentFailure {
  return { ok: false, agent, version: AGENT_VERSION, error, steps };
}

/** Thrown inside an agent to bail out with a specific structured code. */
export class AgentFault extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AgentFault';
  }
}

export type AgentHandler = (request: AgentRequest<unknown>) => Promise<AgentResult>;

// ---------------------------------------------------------------------------------------------
// Input validation — every agent is an HTTP surface, so its input is untrusted.
// ---------------------------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const MAX_TEXT = 2000;

export function isShoppingIntent(value: unknown): value is ShoppingIntent {
  if (!isRecord(value)) return false;
  if (typeof value.raw_request !== 'string' || value.raw_request.length > MAX_TEXT) return false;
  if (typeof value.product_query !== 'string' || value.product_query.trim() === '' || value.product_query.length > 200) return false;
  if (typeof value.category !== 'string') return false;
  if (!Number.isInteger(value.quantity) || (value.quantity as number) < 1 || (value.quantity as number) > 50) return false;
  if (value.max_price_inr !== undefined && !(typeof value.max_price_inr === 'number' && value.max_price_inr > 0 && Number.isFinite(value.max_price_inr))) return false;
  if (typeof value.purchase_required !== 'boolean') return false;
  if (!Array.isArray(value.preferred_merchants) || !value.preferred_merchants.every(isMerchantId)) return false;
  if (value.source !== 'user' && value.source !== 'price-sniper') return false;
  if (value.pinned !== undefined) {
    if (!isRecord(value.pinned) || !isMerchantId(value.pinned.merchant)) return false;
    if (typeof value.pinned.product_id !== 'string' || value.pinned.product_id === '') return false;
  }
  return true;
}

export function isCandidate(value: unknown): value is Candidate {
  if (!isRecord(value)) return false;
  return (
    isMerchantId(value.merchant) &&
    typeof value.product_name === 'string' &&
    value.product_name !== '' &&
    typeof value.price_inr === 'number' &&
    Number.isFinite(value.price_inr) &&
    typeof value.availability === 'boolean' &&
    typeof value.source === 'string' &&
    (value.product_url === undefined || typeof value.product_url === 'string') &&
    (value.product_id === undefined || typeof value.product_id === 'string')
  );
}

export function isProposal(value: unknown): value is Proposal {
  if (!isRecord(value)) return false;
  if (value.proposed_action !== 'purchase' && value.proposed_action !== 'none') return false;
  if (!Number.isInteger(value.quantity) || (value.quantity as number) < 1) return false;
  if (value.selected !== undefined && !isCandidate(value.selected)) return false;
  return typeof value.reason === 'string';
}
