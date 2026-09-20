"use client";

// One agent run, told as it happened: the four agents in order, what each handed on, and — the part
// that matters — Vitta's own verdict on the purchase, shown separately from the agents so it is
// obvious that the agents proposed and the gate decided.
//
// Everything here is read from the run record the shop CLI wrote. Nothing is inferred or invented:
// a stage that hasn't run is "pending", a denial shows the gate's own deny code and the amounts it
// actually saw, and the Nasiko trace is only ever the real one fetched from Nasiko.
import { useState } from "react";
import { Bot, Check, ChevronDown, ExternalLink, Loader2, Minus, ShieldCheck, ShieldX, X } from "lucide-react";
import { ExecutionModeBadge } from "@/components/shop/execution-mode-toggle";
import { Button } from "@/components/ui/button";
import {
  AGENT_LABEL,
  AGENT_ROLE,
  RUN_STATUS_LABEL,
  type AgentRun,
  type AgentRunStage,
  type AgentRunStatus,
  type AgentStageStatus,
} from "@/lib/agent-run-types";

export const RUN_TONE: Record<AgentRunStatus, string> = {
  RUNNING: "border-seal/40 bg-seal/10 text-seal",
  PURCHASED: "border-allow/40 bg-allow/10 text-allow",
  HANDOFF: "border-allow/40 bg-allow/10 text-allow",
  DENIED: "border-deny/40 bg-deny/10 text-deny",
  STEP_UP_REQUIRED: "border-deny/40 bg-deny/10 text-deny",
  NO_PRODUCTS: "border-border bg-muted/40 text-muted-foreground",
  NO_PURCHASE: "border-border bg-muted/40 text-muted-foreground",
  FAILED: "border-deny/40 bg-deny/10 text-deny",
};

export function RunStatusPill({ status }: { status: AgentRunStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${RUN_TONE[status]}`}>
      {status === "RUNNING" ? <Loader2 className="size-3 animate-spin" /> : null}
      {RUN_STATUS_LABEL[status]}
    </span>
  );
}

function StageIcon({ status }: { status: AgentStageStatus }) {
  const base = "flex size-6 shrink-0 items-center justify-center rounded-full border";
  switch (status) {
    case "done":
      return <span className={`${base} border-allow/40 bg-allow/10 text-allow`}><Check className="size-3.5" /></span>;
    case "failed":
      return <span className={`${base} border-deny/40 bg-deny/10 text-deny`}><X className="size-3.5" /></span>;
    case "running":
      return <span className={`${base} border-seal/40 bg-seal/10 text-seal`}><Loader2 className="size-3.5 animate-spin" /></span>;
    case "skipped":
      return <span className={`${base} border-border bg-muted/40 text-ink-faint`}><Minus className="size-3.5" /></span>;
    default:
      return <span className={`${base} border-border text-ink-faint`}><span className="size-1.5 rounded-full bg-current" /></span>;
  }
}

/** The gate echoes the command it was asked to run (`› zepto place-order`) before its verdict line;
 *  show the verdict, not the echo. */
function meaningfulLine(detail: string): string {
  const lines = detail.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find((l) => !l.startsWith("›")) ?? lines[0] ?? "";
}

function StageRow({ stage }: { stage: AgentRunStage }) {
  const [open, setOpen] = useState(false);
  const hasSteps = stage.steps.length > 0;
  return (
    <li className="rounded-lg border border-border bg-background/60">
      <button
        type="button"
        onClick={() => hasSteps && setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
        aria-expanded={open}
      >
        <StageIcon status={stage.status} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-foreground">{AGENT_LABEL[stage.agent] ?? stage.agent}</span>
            {stage.duration_ms !== undefined ? <span className="text-[11px] text-ink-faint">{stage.duration_ms} ms</span> : null}
          </div>
          <div className="text-[12px] text-ink-faint">{AGENT_ROLE[stage.agent]}</div>
          {stage.summary ? <div className="mt-1 break-words text-[13px] text-muted-foreground">{stage.summary}</div> : null}
        </div>
        {hasSteps ? <ChevronDown className={`mt-1 size-4 shrink-0 text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} /> : null}
      </button>
      {open ? (
        <ol className="space-y-1 border-t border-border px-3.5 py-2.5">
          {stage.steps.map((step, i) => (
            <li key={`${step.name}-${i}`} className="flex gap-2 text-[12px]">
              <span className={step.status === "failed" ? "text-deny" : step.status === "skipped" ? "text-ink-faint" : "text-allow"}>
                {step.status === "failed" ? "✗" : step.status === "skipped" ? "–" : "✓"}
              </span>
              <span className="w-32 shrink-0 font-mono text-ink-faint">{step.name}</span>
              <span className="min-w-0 break-words text-muted-foreground">{meaningfulLine(step.detail)}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function inr(n: number | undefined): string {
  return n === undefined ? "—" : `₹${n.toLocaleString("en-IN")}`;
}

/** Vitta's verdict, kept visually apart from the agents: they propose, the gate decides. */
function GateVerdict({ run }: { run: AgentRun }) {
  const o = run.outcome;
  if (!o) return null;
  const denied = o.verdict === "DENY" || run.status === "DENIED";
  const stepUp = o.verdict === "STEP_UP" || run.status === "STEP_UP_REQUIRED";
  const allowed = o.verdict === "ALLOW" && !denied && !stepUp;
  if (!denied && !stepUp && !allowed) return null;

  const tone = allowed ? "border-allow/40 bg-allow/5" : "border-deny/40 bg-deny/5";
  const Icon = allowed ? ShieldCheck : ShieldX;
  const headline = denied ? `DENY · ${o.deny_code ?? "denied"}` : stepUp ? "STEP-UP REQUIRED" : "ALLOW";

  return (
    <section className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2.5">
        <Icon className={`size-5 ${allowed ? "text-allow" : "text-deny"}`} />
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Vitta gate — deterministic, no LLM</div>
          <div className={`font-heading text-lg font-bold ${allowed ? "text-allow" : "text-deny"}`}>{headline}</div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
        <div>
          <dt className="text-ink-faint">Merchant</dt>
          <dd className="text-foreground">{o.merchant}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">Amount the gate saw</dt>
          <dd className="text-foreground">{inr(o.requested_amount_inr)}</dd>
        </div>
        {o.allowed_amount_inr !== undefined ? (
          <div>
            <dt className="text-ink-faint">Allowed per transaction</dt>
            <dd className="text-foreground">{inr(o.allowed_amount_inr)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-ink-faint">Mandate</dt>
          <dd className="break-all font-mono text-[12px] text-foreground">{o.mandate_id ?? run.mandate_id ?? "—"}</dd>
        </div>
        {o.receipt_id ? (
          <div>
            <dt className="text-ink-faint">Receipt</dt>
            <dd className="break-all font-mono text-[12px] text-foreground">{o.receipt_id}</dd>
          </div>
        ) : null}
        {o.authorization_id && !o.receipt_id ? (
          <div>
            <dt className="text-ink-faint">Authorization</dt>
            <dd className="break-all font-mono text-[12px] text-foreground">{o.authorization_id}</dd>
          </div>
        ) : null}
      </dl>
      {denied ? (
        <p className="mt-3 text-[13px] text-muted-foreground">
          The purchase was refused before the merchant was asked to order. Nothing was drawn from the reserve, and no receipt exists for it.
        </p>
      ) : null}
      {o.ledger_unreachable ? (
        <p className="mt-2 text-[13px] text-deny">
          The gate could not read the reserve balance and failed closed — this is an outage, not a spending-limit decision.
        </p>
      ) : null}
    </section>
  );
}

interface NasikoTraceState {
  loading: boolean;
  message?: string;
  spans?: number;
}

function TraceBox({ run }: { run: AgentRun }) {
  const [state, setState] = useState<NasikoTraceState>({ loading: false });

  async function load() {
    setState({ loading: true });
    try {
      const res = await fetch(`/api/shop/agents/${run.run_id}/trace`, { cache: "no-store" });
      const body = (await res.json()) as { ok: boolean; message?: string; trace?: unknown };
      if (!body.ok) return setState({ loading: false, message: body.message });
      // Nasiko documents "one trace, every span"; the exact envelope isn't ours to assume, so count
      // spans only if an array of them is plainly there, and otherwise just say the trace exists.
      const t = body.trace as { spans?: unknown[]; data?: { spans?: unknown[] } } | unknown[];
      const spans = Array.isArray(t) ? t.length : (t?.spans ?? t?.data?.spans)?.length;
      setState({ loading: false, spans, message: spans === undefined ? "Trace found in Nasiko." : undefined });
    } catch (err) {
      setState({ loading: false, message: (err as Error).message });
    }
  }

  return (
    <section className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Nasiko trace</div>
          <div className="mt-0.5 break-all font-mono text-[12px] text-foreground">{run.trace_id}</div>
          <div className="text-[12px] text-ink-faint">
            session {run.session_id} · {run.nasiko.routed
              ? run.nasiko.direct?.length
                ? `hops routed through Nasiko (${run.nasiko.direct.map((a) => AGENT_LABEL[a] ?? a).join(", ")} called directly)`
                : "hops routed through Nasiko"
              : "hops sent directly to the agents (not through Nasiko)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {run.nasiko.routed ? (
            <Button variant="outline" size="sm" onClick={load} disabled={state.loading}>
              {state.loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Load spans
            </Button>
          ) : null}
          {run.nasiko.url ? (
            <a
              href={run.nasiko.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted/50"
            >
              Open Nasiko <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
      {state.spans !== undefined ? <p className="mt-2 text-[13px] text-allow">{state.spans} span(s) recorded by Nasiko for this trace.</p> : null}
      {state.message ? <p className="mt-2 text-[13px] text-muted-foreground">{state.message}</p> : null}
      {!run.nasiko.routed ? (
        <p className="mt-2 text-[12px] text-ink-faint">
          Set NASIKO_URL and the four NASIKO_AGENT_ID_* variables to route runs through Nasiko; its observability then shows this exact trace id.
        </p>
      ) : null}
    </section>
  );
}

export function AgentRunPanel({ run }: { run: AgentRun }) {
  const selected = run.proposal?.selected;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <Bot className="size-3.5" /> {run.source === "price-sniper" ? "Price Sniper run" : "Shopping request"}
          </div>
          <h2 className="mt-1 break-words font-heading text-lg font-bold text-foreground">{run.request_text ?? "—"}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run.sandbox ? (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              SANDBOX · simulated merchant
            </span>
          ) : null}
          <ExecutionModeBadge mode={run.mode} />
          <RunStatusPill status={run.status} />
        </div>
      </div>

      <ol className="space-y-2">
        {run.stages.map((stage) => (
          <StageRow key={stage.agent} stage={stage} />
        ))}
      </ol>

      {selected ? (
        <section className="rounded-xl border border-border p-4 text-[13px]">
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Proposal — not an authorization</div>
          <div className="mt-1 text-foreground">
            {selected.product_name} · {selected.merchant} · {inr(run.proposal?.expected_total_inr ?? selected.price_inr)}
            <span className="ml-2 text-ink-faint">via {selected.source}</span>
          </div>
          <div className="mt-0.5 text-muted-foreground">{run.proposal?.reason}</div>
        </section>
      ) : null}

      <GateVerdict run={run} />

      {run.error && !run.outcome ? (
        <section className="rounded-xl border border-deny/40 bg-deny/5 p-4 text-[13px]">
          <div className="font-semibold text-deny">{run.error.code}</div>
          <div className="mt-1 break-words text-muted-foreground">{run.error.message}</div>
        </section>
      ) : null}

      <TraceBox run={run} />
    </div>
  );
}
