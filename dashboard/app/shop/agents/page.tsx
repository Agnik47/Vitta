"use client";

// Agent activity: a shopping request handed down four agents — Planner, Discovery, Evaluator,
// Purchase — with Vitta's gate deciding whether the last one may spend. Live while a run is in
// flight (the shop CLI rewrites the run record after every stage; this page polls it).
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AgentRunPanel, RunStatusPill } from "@/components/shop/agent-run-panel";
import { ExecutionModeToggle } from "@/components/shop/execution-mode-toggle";
import { Button } from "@/components/ui/button";
import { AGENT_LABEL, isRunActive, type AgentRun } from "@/lib/agent-run-types";
import { useExecutionMode } from "@/lib/execution-mode";

const POLL_MS = 2500;
const EXAMPLE = "Find me the cheapest 2kg atta under ₹300 and buy it";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function AgentsView() {
  const params = useSearchParams();
  const { mode } = useExecutionMode();
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("run"));
  const [request, setRequest] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/shop/agents", { cache: "no-store" });
      const body = (await res.json()) as { ok: boolean; runs: AgentRun[] };
      if (body.ok) setRuns(body.runs);
    } catch {
      // Transient — the next poll retries.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount, then poll — same pattern as app/shop/sniper/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const selected = useMemo(
    () => runs.find((r) => r.run_id === selectedId) ?? runs[0] ?? null,
    [runs, selectedId]
  );

  async function start() {
    setStarting(true);
    try {
      const res = await fetch("/api/shop/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // mode and confirm are always sent explicitly — the route refuses to default either.
        body: JSON.stringify({ request, mode, confirm: true }),
      });
      const body = (await res.json()) as { ok: boolean; runId?: string; message?: string };
      if (!body.ok || !body.runId) {
        toast.error(body.message ?? "Could not start the run");
        return;
      }
      setSelectedId(body.runId);
      setRequest("");
      setConfirm(false);
      toast.success("Agents started");
      void refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const canStart = request.trim().length > 0 && confirm && !starting;

  return (
    <div>
      <PageHeader
        title="Agent activity"
        description="Four agents hand a shopping request down the line. Nasiko routes them; Vitta’s gate — not an agent — decides whether the last one may spend."
      />

      <section className="mb-8 rounded-xl border border-border p-5">
        <label htmlFor="agent-request" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Ask the agents to shop
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="agent-request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            maxLength={500}
            placeholder={EXAMPLE}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-seal/60"
          />
          <Button onClick={start} disabled={!canStart}>
            {starting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Run agents
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <ExecutionModeToggle />
          <label className="flex max-w-md cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 size-4 accent-current" />
            <span>
              I authorize these agents to place an order under my current mandate with no further input. The mandate’s caps, merchants and
              expiry still apply — the gate enforces them, not the agents.
            </span>
          </label>
        </div>
      </section>

      {!loaded ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading runs…
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agent runs yet"
          hint="Start one above, or fire a Price Sniper watch with VITTA_AGENT_PIPELINE=on. `npm run demo:agents -- --persist-runs` records a sandbox demo."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <ul className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
            {runs.map((r) => {
              const active = selected?.run_id === r.run_id;
              const current = r.stages.find((s) => s.status === "running");
              return (
                <li key={r.run_id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.run_id)}
                    className={`w-full rounded-lg border px-3.5 py-3 text-left transition-colors ${
                      active ? "border-seal/50 bg-seal/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <RunStatusPill status={r.status} />
                      <span className="text-[11px] text-ink-faint">{timeOf(r.started_at)}</span>
                    </div>
                    <div className="mt-2 line-clamp-2 text-[13px] text-foreground">{r.request_text ?? "—"}</div>
                    <div className="mt-1 text-[11px] text-ink-faint">
                      {isRunActive(r) && current ? `now: ${AGENT_LABEL[current.agent] ?? current.agent}` : r.source === "price-sniper" ? "Price Sniper" : "user request"}
                      {r.sandbox ? " · sandbox" : ""}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected ? <AgentRunPanel run={selected} /> : null}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  // useSearchParams() needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={null}>
      <AgentsView />
    </Suspense>
  );
}
