// Creates a real, Ed25519-signed mandate by spawning `gate mandate create` — never reimplements
// signing/schema logic here. See ADR-015 / CLAUDE.md rule 8.
import { runGateCli } from "@/lib/gate-cli";

const ALLOWED_MERCHANTS = new Set(["blinkit", "zepto", "bigbasket", "district"]);
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { subject, capInr, perTxnInr, merchants, expires } = (body ?? {}) as {
    subject?: unknown;
    capInr?: unknown;
    perTxnInr?: unknown;
    merchants?: unknown;
    expires?: unknown;
  };

  if (typeof subject !== "string" || subject.trim().length === 0 || subject.length > 100) {
    return Response.json({ ok: false, message: "subject must be a non-empty string" }, { status: 400 });
  }
  if (typeof capInr !== "number" || !Number.isFinite(capInr) || capInr <= 0) {
    return Response.json({ ok: false, message: "capInr must be a positive number" }, { status: 400 });
  }
  if (typeof perTxnInr !== "number" || !Number.isFinite(perTxnInr) || perTxnInr <= 0) {
    return Response.json({ ok: false, message: "perTxnInr must be a positive number" }, { status: 400 });
  }
  if (!Array.isArray(merchants) || merchants.length === 0 || !merchants.every((m) => typeof m === "string" && ALLOWED_MERCHANTS.has(m))) {
    return Response.json({ ok: false, message: "merchants must be a non-empty array of known merchant names" }, { status: 400 });
  }
  if (typeof expires !== "string" || !TIME_RE.test(expires)) {
    return Response.json({ ok: false, message: "expires must be HH:MM (24-hour)" }, { status: 400 });
  }

  const result = await runGateCli([
    "mandate",
    "create",
    "--subject",
    subject,
    "--cap",
    String(capInr),
    "--per-txn",
    String(perTxnInr),
    "--merchants",
    merchants.join(","),
    "--expires",
    expires,
  ]);

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate mandate create failed" },
      { status: 422 }
    );
  }

  const mandateIdMatch = /MANDATE (mnd_[a-z0-9]+)/.exec(result.stdout);
  return Response.json({ ok: true, mandateId: mandateIdMatch?.[1], raw: result.stdout.trim() });
}
