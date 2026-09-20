// The run's real trace from Nasiko's observability API (`GET /api/observability/trace/{id}`,
// docs.nasiko.com/observability/overview) — fetched server-side so NASIKO_TOKEN never reaches the
// browser. Nothing here is synthesized: when the run wasn't routed through Nasiko, or Nasiko can't
// be reached or doesn't know the trace yet, the answer says exactly that and returns no spans.
import { getAgentRun } from "@/lib/agent-runs";
import { runtimeEnv } from "@/lib/runtime-env";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = getAgentRun(runId);
  if (!run) return Response.json({ ok: false, message: "No such run" }, { status: 404 });

  const base = runtimeEnv("NASIKO_URL")?.replace(/\/+$/, "");
  if (!run.nasiko.routed || !base) {
    return Response.json(
      { ok: false, message: "This run was not routed through Nasiko, so Nasiko has no trace for it." },
      { status: 404 }
    );
  }

  const token = runtimeEnv("NASIKO_TOKEN");
  try {
    const res = await fetch(`${base}/api/observability/trace/${encodeURIComponent(run.trace_id)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, message: `Nasiko answered HTTP ${res.status} for trace ${run.trace_id} — it may not be indexed yet.` },
        { status: 502 }
      );
    }
    return Response.json({ ok: true, traceId: run.trace_id, trace: await res.json() });
  } catch (err) {
    return Response.json({ ok: false, message: `Could not reach Nasiko: ${(err as Error).message}` }, { status: 502 });
  }
}
