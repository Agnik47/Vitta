// Funds a mandate's reserve by spawning `gate fund` â€” Prava session creation, never a
// direct PravaLedger call from route code. See ADR-015 / CLAUDE.md rule 8. The route supports
// both flows:
// - `amountInr`: create a new Prava checkout session and return its checkout URL
// - `reserveRef`: attach an already-approved Prava mandate reference
import { runGateCli } from "@/lib/gate-cli";

const MANDATE_ID_RE = /^mnd_[a-z0-9]+$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { mandateId, reserveRef, amountInr } = (body ?? {}) as { mandateId?: unknown; reserveRef?: unknown; amountInr?: unknown };

  if (typeof mandateId !== "string" || !MANDATE_ID_RE.test(mandateId)) {
    return Response.json({ ok: false, message: "mandateId must look like mnd_..." }, { status: 400 });
  }

  const hasReserveRef = typeof reserveRef === "string" && reserveRef.trim().length > 0;
  const hasAmount = typeof amountInr === "number" && Number.isFinite(amountInr) && amountInr > 0;

  if (!hasReserveRef && !hasAmount) {
    return Response.json({ ok: false, message: "amountInr or reserveRef is required" }, { status: 400 });
  }

  const argv = hasAmount
    ? ["fund", mandateId, "--amount", String(amountInr)]
    : ["fund", mandateId, "--reserve-ref", String(reserveRef)];

  const result = await runGateCli(argv);

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate fund failed" },
      { status: 422 }
    );
  }

  const raw = result.stdout.trim();
  const reserveRefMatch = /reserve reference\s+([^\s]+)/i.exec(raw);
  const checkoutUrlMatch = /(https:\/\/\S+)/i.exec(raw);
  return Response.json({
    ok: true,
    raw,
    reserveRef: reserveRefMatch?.[1],
    checkoutUrl: checkoutUrlMatch?.[1],
  });
}
