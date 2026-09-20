// The coordinator: runs Planner → Discovery → Evaluator → Purchase, one A2A call per hop, and keeps
// one set of ids across all of them. It is client code, not a fifth agent — it holds no policy and
// makes no decision about money. Its only judgement is control flow: stop early when there is
// nothing to buy, and never let a hop's failure be reported as anything but what it was.
//
// Every hop gets its own child traceparent under one trace id, so in Nasiko's observability the
// whole run is a single trace with one span per agent. A Vitta DENY arrives as a structured
// VITTA_DENIED error and is carried through to the final record verbatim.
import { childTraceparent, newCorrelation, traceIdOf, type AgentCaller } from './a2a';
import { saveRun, type FlowRecord, type FlowStage, type FlowStatus, type NasikoRouting } from './runs-store';
import {
  AGENT_NAMES,
  type AgentError,
  type AgentName,
  type AgentResult,
  type Correlation,
  type DiscoveryResult,
  type ExecutionMode,
  type Proposal,
  type PurchaseOutcome,
  type ShoppingIntent,
} from './protocol';

export interface FlowInput {
  /** Natural-language request → goes through the Planner. */
  request?: string;
  /** A ready-made intent (the Price Sniper) → the Planner is skipped. */
  intent?: ShoppingIntent;
  /** Explicit, always: TEST settles against the sandbox reserve without driving checkout; LIVE places a real order. */
  mode: ExecutionMode;
  mandateId?: string;
  sessionId?: string;
  /** Lets a caller (the dashboard) name its run up front so it can follow it. Becomes the shopping
   *  request id, the run id and the purchase idempotency key. */
  requestId?: string;
}

export interface FlowDeps {
  caller: AgentCaller;
  /** Called after every stage change. Defaults to persisting the run for the dashboard. */
  save?: (record: FlowRecord) => void;
  nasiko?: NasikoRouting;
  /** Marks the record as produced against the sandbox simulators. */
  sandbox?: boolean;
}

function spanIdOf(traceparent: string): string {
  return traceparent.split('-')[2];
}

function pipelineStages(): FlowStage[] {
  return AGENT_NAMES.map((agent) => ({ agent, status: 'pending', steps: [] }));
}

export async function runShoppingFlow(input: FlowInput, deps: FlowDeps): Promise<FlowRecord> {
  if (!input.request && !input.intent) throw new Error('runShoppingFlow needs a request or an intent');
  const save = deps.save ?? ((r: FlowRecord) => saveRun(r));

  if (input.requestId !== undefined && !/^[A-Za-z0-9_-]{1,80}$/.test(input.requestId)) {
    throw new Error(`Refusing unsafe request id "${input.requestId}"`);
  }
  const root = newCorrelation({ sessionId: input.sessionId, requestId: input.requestId, mandateId: input.mandateId, caller: 'vitta-orchestrator' });
  const record: FlowRecord = {
    run_id: root.requestId,
    request_id: root.requestId,
    session_id: root.sessionId,
    trace_id: traceIdOf(root.traceparent),
    source: input.intent?.source ?? 'user',
    mode: input.mode,
    request_text: input.request ?? input.intent?.raw_request,
    mandate_id: input.mandateId,
    status: 'RUNNING',
    stages: pipelineStages(),
    intent: input.intent,
    nasiko: deps.nasiko ?? { routed: false },
    ...(deps.sandbox ? { sandbox: true } : {}),
    started_at: new Date().toISOString(),
  };
  save(record);

  const stage = (agent: AgentName): FlowStage => record.stages.find((s) => s.agent === agent) as FlowStage;

  function finish(status: FlowStatus, error?: AgentError): FlowRecord {
    record.status = status;
    if (error) record.error = error;
    record.completed_at = new Date().toISOString();
    save(record);
    return record;
  }

  function skip(agent: AgentName, why: string): void {
    const s = stage(agent);
    s.status = 'skipped';
    s.summary = why;
    save(record);
  }

  /** One hop: child span, timed, recorded, persisted before and after. */
  async function hop(agent: AgentName, payload: unknown, summarize: (r: AgentResult) => string): Promise<AgentResult> {
    const s = stage(agent);
    const correlation: Correlation = { ...root, traceparent: childTraceparent(root.traceparent) };
    s.span_id = spanIdOf(correlation.traceparent);
    s.status = 'running';
    s.started_at = new Date().toISOString();
    save(record);

    const result = await deps.caller.call(agent, { vitta: 1, correlation, input: payload });

    s.completed_at = new Date().toISOString();
    s.duration_ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
    s.steps = result.steps;
    s.status = result.ok ? 'done' : 'failed';
    if (result.ok) s.summary = summarize(result);
    else {
      s.error = result.error;
      s.summary = `${result.error.code}: ${result.error.message}`;
    }
    save(record);
    return result;
  }

  // 1 — Planner (skipped when the Price Sniper already supplies a structured intent).
  let intent: ShoppingIntent;
  if (input.intent) {
    intent = input.intent;
    skip('vitta-shopping-planner', `intent supplied by ${input.intent.source} — no planning needed`);
  } else {
    const planned = await hop('vitta-shopping-planner', { request: input.request }, (r) => {
      const i = (r as { data: ShoppingIntent }).data;
      return `"${i.product_query}" ×${i.quantity}${i.max_price_inr !== undefined ? ` ≤ ₹${i.max_price_inr}` : ''}`;
    });
    if (!planned.ok) return finish('FAILED', planned.error);
    intent = planned.data as ShoppingIntent;
  }
  record.intent = intent;
  save(record);

  // 2 — Discovery
  const found = await hop('vitta-deal-discovery', { intent }, (r) => {
    const d = (r as { data: DiscoveryResult }).data;
    return `${d.candidates.length} candidate(s)${d.merchant_errors.length ? `, ${d.merchant_errors.length} merchant(s) failed` : ''}`;
  });
  if (!found.ok) return finish(found.error.code === 'NO_PRODUCTS_FOUND' ? 'NO_PRODUCTS' : 'FAILED', found.error);
  const discovery = found.data as DiscoveryResult;

  // 3 — Evaluator
  const evaluated = await hop('vitta-deal-evaluator', { intent, candidates: discovery.candidates }, (r) => {
    const p = (r as { data: Proposal }).data;
    return p.selected ? `${p.selected.product_name} @ ${p.selected.merchant} — ${p.proposed_action}` : p.reason;
  });
  if (!evaluated.ok) return finish('FAILED', evaluated.error);
  const proposal = evaluated.data as Proposal;
  record.proposal = proposal;
  save(record);

  if (proposal.proposed_action !== 'purchase') {
    skip('vitta-purchase-agent', 'nothing to buy — ' + proposal.reason);
    return finish('NO_PURCHASE');
  }

  // 4 — Purchase. Everything money-related past this point happens behind the gate.
  const purchased = await hop(
    'vitta-purchase-agent',
    { intent, proposal, mode: input.mode, mandate_id: input.mandateId },
    (r) => {
      const o = (r as { data: PurchaseOutcome }).data;
      return `${o.status} — ${o.merchant}${o.requested_amount_inr !== undefined ? ` ₹${o.requested_amount_inr}` : ''}${o.receipt_id ? ` · ${o.receipt_id}` : ''}`;
    },
  );
  if (purchased.ok) {
    const outcome = purchased.data as PurchaseOutcome;
    record.outcome = outcome;
    record.mandate_id = outcome.mandate_id ?? record.mandate_id;
    return finish(outcome.status === 'HANDOFF' ? 'HANDOFF' : 'PURCHASED');
  }

  // The gate's refusal is data, kept whole: which rule, which amounts, which mandate.
  const details = purchased.error.details as PurchaseOutcome | undefined;
  if (details && typeof details === 'object' && 'status' in details) {
    record.outcome = details;
    record.mandate_id = details.mandate_id ?? record.mandate_id;
  }
  const status: FlowStatus =
    purchased.error.code === 'VITTA_DENIED' ? 'DENIED' : purchased.error.code === 'VITTA_STEP_UP_REQUIRED' ? 'STEP_UP_REQUIRED' : 'FAILED';
  return finish(status, purchased.error);
}
