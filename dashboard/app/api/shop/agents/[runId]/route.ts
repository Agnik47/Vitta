// One agent run — polled by the Agent Activity page while a run is in flight.
import { getAgentRun } from "@/lib/agent-runs";

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = getAgentRun(runId);
  if (!run) return Response.json({ ok: false, message: "No such run" }, { status: 404 });
  return Response.json({ ok: true, run });
}
