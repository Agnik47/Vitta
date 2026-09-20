// Persisted record of each shopping run, one JSON file per run. The dashboard's Agent Activity page
// reads these the same way it reads receipts/ and events.jsonl — a flat file the CLI writes and the
// dashboard only reads (docs/06-DASHBOARD-SPEC.md). Written atomically (temp file + rename) after
// every stage, so a page polling mid-run never sees a half-written file.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { agentRunsDir } from './idempotency';
import type { AgentError, AgentName, AgentStep, ExecutionMode, Proposal, PurchaseOutcome, ShoppingIntent } from './protocol';

/** How a run's hops travelled. `direct` lists agents called straight at their own URL even though a
 *  Nasiko control plane was configured (e.g. a Purchase Agent that must sit next to the gate). */
export interface NasikoRouting {
  routed: boolean;
  url?: string;
  direct?: AgentName[];
}

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface FlowStage {
  agent: AgentName;
  status: StageStatus;
  /** This hop's W3C span id — the same id Nasiko sees in the traceparent it receives. */
  span_id?: string;
  /** Nasiko's own trace id for this hop — the one its trace view (and `GET /api/observability/trace/<id>`)
   *  is keyed by. Only present when the hop was dispatched through Nasiko. */
  nasiko_trace_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  summary?: string;
  steps: AgentStep[];
  error?: AgentError;
}

export type FlowStatus =
  | 'RUNNING'
  | 'PURCHASED'
  | 'HANDOFF'
  | 'DENIED'
  | 'STEP_UP_REQUIRED'
  | 'NO_PRODUCTS'
  | 'NO_PURCHASE'
  | 'REVIEW'
  | 'FAILED';

export interface FlowRecord {
  /** Also the shopping request id and the purchase idempotency key. */
  run_id: string;
  request_id: string;
  session_id: string;
  /** W3C trace id — search for this in Nasiko's observability to find the same run. */
  trace_id: string;
  source: 'user' | 'price-sniper';
  mode: ExecutionMode;
  request_text?: string;
  mandate_id?: string;
  status: FlowStatus;
  stages: FlowStage[];
  intent?: ShoppingIntent;
  proposal?: Proposal;
  outcome?: PurchaseOutcome;
  /** The error that ended the run, with its original code and reason. */
  error?: AgentError;
  /** Whether hops were dispatched through Nasiko's control plane or straight to the agents. */
  nasiko: NasikoRouting;
  /** True when the merchant and Razorpay were the sandbox simulators (npm run demo:agents). Shown as a
   *  badge in the dashboard so a simulated run is never mistaken for a real one. */
  sandbox?: boolean;
  started_at: string;
  completed_at?: string;
}

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function fileFor(runId: string, dir: string): string {
  if (!RUN_ID_RE.test(runId)) throw new Error(`Refusing unsafe run id "${runId}"`);
  return path.join(dir, `${runId}.json`);
}

export function saveRun(record: FlowRecord, dir = agentRunsDir()): void {
  mkdirSync(dir, { recursive: true });
  const file = fileFor(record.run_id, dir);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(record, null, 2));
  renameSync(tmp, file);
}

export function loadRun(runId: string, dir = agentRunsDir()): FlowRecord | undefined {
  const file = fileFor(runId, dir);
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, 'utf-8')) as FlowRecord;
}

/** Newest first. A file mid-rename or unreadable is skipped, never thrown. */
export function listRuns(dir = agentRunsDir()): FlowRecord[] {
  if (!existsSync(dir)) return [];
  const runs: FlowRecord[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      runs.push(JSON.parse(readFileSync(path.join(dir, f), 'utf-8')) as FlowRecord);
    } catch {
      // partial write — ignore
    }
  }
  return runs.sort((a, b) => b.started_at.localeCompare(a.started_at));
}
