// Executes a real spend by spawning the real `gate` CLI — this is the one route in the whole
// dashboard that can move real money. Never calls decide()/execute() directly; the spawned CLI is
// the only decision-maker, exactly as CLAUDE.md rule 8 (superseded, ADR-015) requires. Real money
// moving through a web click still needs the same real-purchase confirmation discipline this
// project has used for every prior live test — `confirm: true` in the request body is the
// client-side half of that; a human explicitly clicking through a confirmation dialog in the
// purchase UI is what should set it, never a default.
//
// Which command actually commits differs per merchant, and the gate CLI is the authority on that
// (src/webcmd/commit-spec.ts). This route mirrors the same table only to decide what to spawn:
//
//   blinkit    place-order --confirm   -> returns a real orderId, draws, signs a receipt
//   zepto      place-order --confirm   -> returns status/confirmed, draws, signs a receipt
//   bigbasket  place-order --confirm   -> custom adapter added 2026-07-31 (packaged webcmd had no
//                                         order-placing command for this merchant at all — see
//                                         webcmd/clis/bigbasket/place-order.js). Modeled on
//                                         Blinkit's: same --confirm gate, same real orderId in its
//                                         result columns, same fail-closed refusal without one.
//                                         UNVERIFIED LIVE — that adapter's own header documents why:
//                                         add-to-cart's write path has an unresolved, thoroughly
//                                         investigated reliability problem in this session that
//                                         blocks getting a real cart to place an order from at all.
import { runGateCli } from "@/lib/gate-cli";

const COMMIT_COMMAND = {
  blinkit: ["place-order", "--confirm"],
  zepto: ["place-order", "--confirm"],
  bigbasket: ["place-order", "--confirm"],
} as const;

type ExecutableMerchant = keyof typeof COMMIT_COMMAND;

function isExecutableMerchant(value: unknown): value is ExecutableMerchant {
  return value === "blinkit" || value === "zepto" || value === "bigbasket";
}

/** Merchants the gate can actually complete a purchase for (i.e. that can produce a receipt). All
 *  three now have a real place-order path — see the comment above on BigBasket's caveat. */
const CAN_COMPLETE: Record<ExecutableMerchant, boolean> = {
  blinkit: true,
  zepto: true,
  bigbasket: true,
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { merchant, confirm } = (body ?? {}) as { merchant?: unknown; confirm?: unknown };

  if (!isExecutableMerchant(merchant)) {
    return Response.json(
      { ok: false, message: "merchant must be one of blinkit, zepto, bigbasket" },
      { status: 400 }
    );
  }
  if (confirm !== true) {
    // Fail closed: this is real money. No default, no implicit yes.
    return Response.json(
      {
        ok: false,
        message:
          "Explicit confirmation required — pass confirm: true after the human clicks through a real confirmation step",
      },
      { status: 400 }
    );
  }

  // A commit drives a real browser through cart reads plus the commit itself; measured webcmd
  // round-trips are 20-40s each, so the default 60s would time out mid-purchase.
  const result = await runGateCli(
    ["run", "--", "webcmd", merchant, ...COMMIT_COMMAND[merchant]],
    240_000
  );

  // gate.ts's formatGateEventLine() always emits raw ANSI color codes with no TTY detection
  // (docs/AGENTS.md's deliberate design for a real interactive terminal) — a spawned child
  // process's stdout carries them too. Found live while building the two-stage authorization
  // tracking: `^✗?\s*(ALLOW|...)` anchors to the true start of the line, which is the escape
  // sequence itself, not "ALLOW" — so this regex has silently never matched a real execution here,
  // meaning `verdict` came back undefined on every real run through this route. Same fix as
  // src/agent/parse-commit-output.ts: strip codes before matching.
  // eslint-disable-next-line no-control-regex
  const plainStdout = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");

  const verdict = /^✗?\s*(ALLOW|DENY|STEP_UP)/m.exec(plainStdout)?.[1] as
    | "ALLOW"
    | "DENY"
    | "STEP_UP"
    | undefined;
  const receiptId = /receipt (rcp_[a-z0-9]+)/.exec(plainStdout)?.[1];
  // BigBasket's hand-off line: `  finish here: <url>` printed by the gate when the merchant has no
  // order-placing command. Surfaced so the UI can offer the real link rather than a generic message.
  const handoffUrl = /finish here: (https:\/\/\S+)/.exec(plainStdout)?.[1];

  return Response.json({
    ok: result.ok,
    verdict,
    receiptId,
    // True when the purchase still needs the human to place the order on the merchant's own site.
    handoff: CAN_COMPLETE[merchant] ? false : result.ok,
    handoffUrl,
    merchant,
    raw: result.stdout.trim(),
    stderr: result.stderr.trim(),
  });
}
