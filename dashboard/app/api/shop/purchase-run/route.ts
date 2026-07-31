// Starts and polls the automatic, one-click purchase pipeline. Once the human clicks Proceed and
// then confirms once here, everything else runs with no further input — see
// src/agent/PurchaseAgent.ts, which this route spawns via lib/agent-cli.ts (never decide()/webcmd
// directly — ADR-015 holds for this route exactly as it does for every other write route).
//
// POST starts a job and returns { jobId } immediately — a real run is minutes long (several real
// 20-90s browser round-trips), so the client polls GET rather than this request blocking.
import { isAddToCartMerchant, resolveProductRef } from "@/lib/product-ref";
import { getPurchaseJob, startPurchaseJob } from "@/lib/purchase-job";
import { isValidShopSessionId } from "@/lib/shop-session";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, merchant, items, minCartInr, maxCartInr, mandateId, confirm } = (body ?? {}) as {
    sessionId?: unknown;
    merchant?: unknown;
    items?: unknown;
    minCartInr?: unknown;
    maxCartInr?: unknown;
    mandateId?: unknown;
    confirm?: unknown;
  };

  if (!isValidShopSessionId(sessionId)) {
    return Response.json({ ok: false, message: "sessionId is required" }, { status: 400 });
  }
  if (!isAddToCartMerchant(merchant)) {
    return Response.json({ ok: false, message: "merchant must be one of blinkit, zepto, bigbasket" }, { status: 400 });
  }
  if (confirm !== true) {
    // Fail closed: this pipeline ends in real money moving. No default, no implicit yes — the same
    // rule every other execute-shaped route in this dashboard already enforces.
    return Response.json(
      { ok: false, message: "Explicit confirmation required — pass confirm: true after the human clicks Proceed and confirms" },
      { status: 400 }
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ ok: false, message: "items must be a non-empty array" }, { status: 400 });
  }

  // Every line resolved and validated up front — one bad line fails the whole request rather than
  // silently dropping it from the cart the human actually approved.
  const resolvedItems: Array<{ product: string; productName: string; quantity: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] as {
      productId?: unknown;
      url?: unknown;
      productName?: unknown;
      quantity?: unknown;
    };
    const candidates = [raw.productId, raw.url].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0
    );
    if (candidates.length === 0) {
      return Response.json({ ok: false, message: `Item ${i + 1}: productId or url is required` }, { status: 400 });
    }
    let resolved = resolveProductRef(candidates[0], merchant);
    for (let j = 1; j < candidates.length && !resolved.ok; j++) resolved = resolveProductRef(candidates[j], merchant);
    if (!resolved.ok) {
      return Response.json({ ok: false, message: `Item ${i + 1}: ${resolved.message}` }, { status: 400 });
    }
    const name = typeof raw.productName === "string" && raw.productName.trim() ? raw.productName.trim() : resolved.arg;
    const qty = typeof raw.quantity === "number" && Number.isInteger(raw.quantity) && raw.quantity > 0 ? raw.quantity : 1;
    resolvedItems.push({ product: resolved.arg, productName: name, quantity: qty });
  }

  const min = typeof minCartInr === "number" && Number.isFinite(minCartInr) && minCartInr > 0 ? minCartInr : undefined;
  const max = typeof maxCartInr === "number" && Number.isFinite(maxCartInr) && maxCartInr > 0 ? maxCartInr : undefined;
  const mandate = typeof mandateId === "string" && mandateId.trim() ? mandateId.trim() : undefined;

  const job = startPurchaseJob(sessionId, {
    merchant,
    items: resolvedItems,
    minCartInr: min,
    maxCartInr: max,
    mandateId: mandate,
  });

  return Response.json({ ok: true, jobId: job.id });
}

export async function GET(req: Request) {
  const jobId = new URL(req.url).searchParams.get("id");
  if (!jobId) return Response.json({ ok: false, message: "id is required" }, { status: 400 });

  const job = getPurchaseJob(jobId);
  if (!job) return Response.json({ ok: false, message: "Unknown job id" }, { status: 404 });

  return Response.json({
    ok: true,
    status: job.status,
    // Real bug found while verifying the two-stage authorization/confirmation tracking: this route
    // never sent `state` at all, so every consumer's "State: ..." display and any state-keyed logic
    // silently saw `undefined` regardless of real progress. deriveJobState() was computing it
    // correctly the whole time — it just never left this handler.
    state: job.state,
    events: job.events,
    result: job.result,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  });
}
