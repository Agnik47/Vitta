// Executes a real spend by spawning `gate run -- webcmd <merchant> place-order --confirm` — this
// is the one route in the whole dashboard that can move real money. Never calls decide()/execute()
// directly; the spawned CLI is the only decision-maker, exactly as CLAUDE.md rule 8 (superseded,
// ADR-015) requires. Real money moving through a web click still needs the same real-purchase
// confirmation discipline this project has used for every prior live test — `confirm: true` in the
// request body is the client-side half of that; a human explicitly clicking "Confirm & execute" in
// the checkout UI is what should set it, never a default.
import { runGateCli } from "@/lib/gate-cli";

// Only Blinkit has a real, tested webcmd integration in this project — see
// docs/common/09-HACKATHON-WOW-PLAN.md § Explicit non-goals. Executing against any other merchant
// here would either error inside webcmd or, worse, silently do nothing while implying it worked.
const EXECUTABLE_MERCHANTS = new Set(["blinkit"]);
const EXECUTABLE_COMMANDS = new Set(["place-order"]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { merchant, command, confirm } = (body ?? {}) as {
    merchant?: unknown;
    command?: unknown;
    confirm?: unknown;
  };

  if (typeof merchant !== "string" || !EXECUTABLE_MERCHANTS.has(merchant)) {
    return Response.json(
      { ok: false, message: "Only Blinkit has a real, executable integration in this build" },
      { status: 400 }
    );
  }
  if (typeof command !== "string" || !EXECUTABLE_COMMANDS.has(command)) {
    return Response.json({ ok: false, message: "Unsupported command" }, { status: 400 });
  }
  if (confirm !== true) {
    // Fail closed: this is real money. No default, no implicit yes.
    return Response.json(
      { ok: false, message: "Explicit confirmation required — pass confirm: true after the human clicks through a real confirmation step" },
      { status: 400 }
    );
  }

  const result = await runGateCli(["run", "--", "webcmd", merchant, command, "--confirm"]);

  const verdict = /^✗?\s*(ALLOW|DENY|STEP_UP)/m.exec(result.stdout)?.[1] as
    | "ALLOW"
    | "DENY"
    | "STEP_UP"
    | undefined;
  const receiptIdMatch = /receipt (rcp_[a-z0-9]+)/.exec(result.stdout);

  return Response.json({
    ok: result.ok,
    verdict,
    receiptId: receiptIdMatch?.[1],
    raw: result.stdout.trim(),
    stderr: result.stderr.trim(),
  });
}
