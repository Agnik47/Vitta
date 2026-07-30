// Funds a mandate's reserve by spawning `gate fund` — real Dodo balance read/attach, never a
// direct DodoCreditLedger call from route code. See ADR-015 / CLAUDE.md rule 8. Same as the CLI
// itself, this route can only ATTACH an existing already-paid reserve (--reserve-ref) — it cannot
// complete a new Dodo checkout, since entering payment details is a prohibited agent action
// regardless of whether the trigger is a terminal or a browser.
import { runGateCli } from "@/lib/gate-cli";

const MANDATE_ID_RE = /^mnd_[a-z0-9]+$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { mandateId, reserveRef } = (body ?? {}) as { mandateId?: unknown; reserveRef?: unknown };

  if (typeof mandateId !== "string" || !MANDATE_ID_RE.test(mandateId)) {
    return Response.json({ ok: false, message: "mandateId must look like mnd_..." }, { status: 400 });
  }
  if (typeof reserveRef !== "string" || reserveRef.trim().length === 0) {
    return Response.json(
      { ok: false, message: "reserveRef is required — this route only attaches an already-paid reserve, it cannot complete a new checkout" },
      { status: 400 }
    );
  }

  const result = await runGateCli(["fund", mandateId, "--reserve-ref", reserveRef]);

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate fund failed" },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, raw: result.stdout.trim() });
}
