// Reads or cancels one Price Sniper watch.
import { cancelWatch, getWatch } from "@/lib/sniper-watch";

const WATCH_ID_RE = /^[a-f0-9-]{36}$/;

export async function GET(_req: Request, ctx: { params: Promise<{ watchId: string }> }) {
  const { watchId } = await ctx.params;
  if (!WATCH_ID_RE.test(watchId)) {
    return Response.json({ ok: false, message: "Invalid watch id" }, { status: 400 });
  }
  const watch = getWatch(watchId);
  if (!watch) return Response.json({ ok: false, message: "Unknown watch id" }, { status: 404 });
  return Response.json({ ok: true, watch });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ watchId: string }> }) {
  const { watchId } = await ctx.params;
  if (!WATCH_ID_RE.test(watchId)) {
    return Response.json({ ok: false, message: "Invalid watch id" }, { status: 400 });
  }
  // Cancelling a watch that already fired is a no-op by design — the purchase behind it is real and
  // already running, and pretending otherwise here would only hide it from the UI.
  const watch = cancelWatch(watchId);
  if (!watch) return Response.json({ ok: false, message: "Unknown watch id" }, { status: 404 });
  return Response.json({ ok: true, watch });
}
