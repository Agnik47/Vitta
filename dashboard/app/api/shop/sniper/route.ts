// Creates and lists Price Sniper watches.
//
// A watch is the only thing in this dashboard that can reach startPurchaseJob() without a human
// present at the moment of spend — that is the entire feature. The confirmation therefore moves
// here, to creation time: `confirm: true` is required exactly as it is on /api/shop/purchase-run,
// so authorizing an unattended purchase stays a deliberate, explicit act rather than a side effect
// of reusing the pipeline.
import {
  createWatch,
  listWatches,
  DEFAULT_INTERVAL_MS,
  MIN_INTERVAL_MS,
  MAX_WINDOW_MS,
} from "@/lib/sniper-watch";
import { resolveProductRef } from "@/lib/product-ref";

const MANDATE_ID_RE = /^mnd_[a-z0-9]+$/;

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    productId,
    productName,
    targetPriceInr,
    quantity,
    windowStartIso,
    windowEndIso,
    intervalMs,
    mode,
    mandateId,
    confirm,
  } = (body ?? {}) as Record<string, unknown>;

  if (confirm !== true) {
    return Response.json(
      {
        ok: false,
        message:
          "Explicit confirmation required — a watch can place a purchase with no further input, so it must be confirmed when it is created",
      },
      { status: 400 }
    );
  }

  // Blinkit only: it is the sole merchant with real add-to-cart and checkout adapters. Validated
  // through the same resolver /api/shop/purchase-run uses, so a malformed id is rejected here
  // rather than discovered minutes later when the watch tries to fire.
  if (typeof productId !== "string" || !productId.trim()) {
    return Response.json({ ok: false, message: "productId is required" }, { status: 400 });
  }
  const resolved = resolveProductRef(productId.trim(), "blinkit");
  if (!resolved.ok) {
    return Response.json({ ok: false, message: resolved.message }, { status: 400 });
  }

  if (typeof productName !== "string" || !productName.trim() || productName.length > 200) {
    return Response.json({ ok: false, message: "productName must be a non-empty string" }, { status: 400 });
  }
  if (typeof targetPriceInr !== "number" || !Number.isFinite(targetPriceInr) || targetPriceInr <= 0) {
    return Response.json({ ok: false, message: "targetPriceInr must be a positive number" }, { status: 400 });
  }
  if (
    quantity !== undefined &&
    (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 12)
  ) {
    return Response.json({ ok: false, message: "quantity must be an integer between 1 and 12" }, { status: 400 });
  }

  // Absolute instants, resolved by the client in the user's own timezone. Accepting bare HH:MM and
  // resolving it here would silently shift the window by hours whenever the server's clock runs in
  // a different zone from the person who set it.
  if (!isIsoInstant(windowStartIso) || !isIsoInstant(windowEndIso)) {
    return Response.json(
      { ok: false, message: "windowStartIso and windowEndIso must be ISO timestamps" },
      { status: 400 }
    );
  }
  const start = Date.parse(windowStartIso);
  const end = Date.parse(windowEndIso);
  if (end <= start) {
    return Response.json({ ok: false, message: "The window must end after it starts" }, { status: 400 });
  }
  if (end <= Date.now()) {
    return Response.json({ ok: false, message: "That window has already closed" }, { status: 400 });
  }
  if (end - start > MAX_WINDOW_MS) {
    return Response.json({ ok: false, message: "The window cannot be longer than 24 hours" }, { status: 400 });
  }

  // Each real check drives a browser and takes 20-40 seconds, so a shorter interval would just
  // queue checks behind each other while claiming a responsiveness it cannot deliver.
  let resolvedInterval = DEFAULT_INTERVAL_MS;
  if (intervalMs !== undefined) {
    if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
      return Response.json(
        { ok: false, message: `intervalMs must be at least ${MIN_INTERVAL_MS} (one minute)` },
        { status: 400 }
      );
    }
    resolvedInterval = Math.round(intervalMs);
  }

  // Fails closed on anything unrecognized rather than defaulting — a typo must never resolve to
  // LIVE. Absent means TEST, the safer of the two for a request arriving from a browser.
  if (mode !== undefined && mode !== "TEST" && mode !== "LIVE") {
    return Response.json({ ok: false, message: 'mode must be "TEST" or "LIVE"' }, { status: 400 });
  }
  const executionMode: "TEST" | "LIVE" = mode === "LIVE" ? "LIVE" : "TEST";

  if (mandateId !== undefined && (typeof mandateId !== "string" || !MANDATE_ID_RE.test(mandateId))) {
    return Response.json({ ok: false, message: "mandateId must look like mnd_..." }, { status: 400 });
  }

  const watch = createWatch({
    productId: resolved.arg,
    productName: productName.trim(),
    targetPriceInr,
    quantity: typeof quantity === "number" ? quantity : 1,
    windowStartIso: new Date(start).toISOString(),
    windowEndIso: new Date(end).toISOString(),
    intervalMs: resolvedInterval,
    mode: executionMode,
    mandateId: typeof mandateId === "string" ? mandateId : undefined,
  });

  return Response.json({ ok: true, watch });
}

export async function GET() {
  return Response.json({ ok: true, watches: listWatches() });
}
