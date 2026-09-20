// Lists agent runs and starts new ones.
//
// Starting a run means four agents hand a request down to a Purchase Agent that can, with no
// further input, place an order under the mandate. As with /api/shop/purchase-run and the sniper,
// that authorization is made explicit here: `confirm: true` and an explicit `mode` are both
// required, never defaulted — a forgotten field must not decide whether a real order is placed.
// The mandate itself (caps, merchants, expiry) is enforced later, and only, by the gate.
import { listAgentRuns, startAgentRun } from "@/lib/agent-runs";

const MANDATE_ID_RE = /^mnd_[a-z0-9]+$/;
const MAX_REQUEST_LENGTH = 500;

export async function GET() {
  return Response.json({ ok: true, runs: listAgentRuns() });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }
  const { request, mode, mandateId, confirm } = (body ?? {}) as Record<string, unknown>;

  if (confirm !== true) {
    return Response.json(
      {
        ok: false,
        message:
          "Explicit confirmation required — the agents can place an order under your mandate with no further input, so it must be confirmed when the run is started",
      },
      { status: 400 }
    );
  }
  if (mode !== "TEST" && mode !== "LIVE") {
    return Response.json({ ok: false, message: 'mode must be "TEST" or "LIVE"' }, { status: 400 });
  }
  if (typeof request !== "string" || !request.trim()) {
    return Response.json({ ok: false, message: "A shopping request is required" }, { status: 400 });
  }
  if (request.length > MAX_REQUEST_LENGTH) {
    return Response.json({ ok: false, message: `Request too long (max ${MAX_REQUEST_LENGTH} characters)` }, { status: 400 });
  }
  if (mandateId !== undefined && (typeof mandateId !== "string" || !MANDATE_ID_RE.test(mandateId))) {
    return Response.json({ ok: false, message: "Invalid mandate id" }, { status: 400 });
  }

  const { runId } = startAgentRun({
    request: request.trim(),
    mode,
    mandateId: typeof mandateId === "string" ? mandateId : undefined,
    dashboardOrigin: new URL(req.url).origin,
  });
  return Response.json({ ok: true, runId }, { status: 202 });
}
