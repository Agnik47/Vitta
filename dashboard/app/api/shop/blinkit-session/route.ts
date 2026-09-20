// GET-only. Is the shopping browser signed in to Blinkit?
//
// Vitta fills a cart by driving webcmd's own automation browser. Signed out, that is a GUEST cart in
// that browser: real, and readable by Vitta, but it will not appear in the person's own Blinkit app or
// website. The Cart page says which of the two it is instead of leaving them to wonder. Read-only
// (`blinkit whoami` is access:read in the manifest), cached briefly since each call is a browser hop.
import { runSearchCli } from "@/lib/live-search";

const CACHE_MS = 60_000;
let cached: { at: number; body: Record<string, unknown> } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) return Response.json(cached.body);

  const res = await runSearchCli(["blinkit", "whoami"], 60_000);
  let body: Record<string, unknown>;
  if (res.ok) {
    const row = Array.isArray(res.rows) ? (res.rows[0] as Record<string, unknown> | undefined) : undefined;
    body = { ok: true, signedIn: true, account: typeof row?.name === "string" ? row.name : undefined };
  } else if (res.authRequired) {
    body = { ok: true, signedIn: false };
  } else {
    // Could not tell (browser busy, webcmd missing…): say so, and never cache an unknown.
    return Response.json({ ok: false, message: res.message ?? "Could not check the Blinkit sign-in" }, { status: 502 });
  }
  cached = { at: Date.now(), body };
  return Response.json(body);
}
