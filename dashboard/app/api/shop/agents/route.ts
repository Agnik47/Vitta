// Lists agent runs and starts new ones.
//
// A run has two shapes, and the person picks between them when they start it:
//   • REVIEW (the default): the agents search, evaluate and pick, then HAND THE PICK TO THE PERSON.
//     The Purchase Agent is never entered; the pick is offered for their cart, where "Proceed to
//     purchase" is the existing gated purchase path. Nothing is bought without a human.
//   • AUTONOMOUS (`confirm: true`): the Purchase Agent may place an order under the mandate with no
//     further input. As with /api/shop/purchase-run and the sniper, that authorization has to be
//     explicit — never defaulted, so a forgotten field can only ever produce the safer REVIEW run.
// `mode` is required in both, never defaulted: it decides whether a real order can be placed.
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
    // Anything other than an explicit `confirm: true` is a review run.
    review: confirm !== true,
    dashboardOrigin: new URL(req.url).origin,
  });
  return Response.json({ ok: true, runId }, { status: 202 });
}
