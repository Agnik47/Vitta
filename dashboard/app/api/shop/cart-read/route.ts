// Reads the merchant's OWN live cart, so the purchase flow can show what will actually be charged
// rather than the dashboard's optimistic local copy. The total comes back already resolved by the
// gate's own cart-total resolver (computed inside dist/cli/search.js) — the same figure decide()
// is handed at commit time, which is the point: the user sees the real number before confirming.
//
// Goes through dist/cli/search.js, not the gate CLI, for a real reason: `gate run` short-circuits
// every access:'read' command — it logs a free ALLOW and returns WITHOUT executing anything (rule
// 0, src/cli/gate.ts). So the gate literally cannot fetch cart contents. search.js is this repo's
// narrow read-only entry point and refuses anything that isn't access:'read' in the manifest, so
// it can never reach a write/spend command.
import { runSearchCli } from "@/lib/live-search";
import { isAddToCartMerchant } from "@/lib/product-ref";

export async function GET(req: Request) {
  const merchant = new URL(req.url).searchParams.get("merchant");
  if (!isAddToCartMerchant(merchant)) {
    return Response.json(
      { ok: false, message: "merchant must be one of blinkit, zepto, bigbasket" },
      { status: 400 }
    );
  }

  const raw = await runSearchCli([merchant, "cart"], 90_000);
  if (!raw.ok) {
    return Response.json(
      { ok: false, message: raw.message ?? "Could not read the cart", authRequired: raw.authRequired },
      { status: 502 }
    );
  }

  return Response.json({
    ok: true,
    merchant,
    lines: Array.isArray(raw.rows) ? raw.rows : [],
    totalInr: raw.cartTotalInr,
    itemCount: raw.cartItemCount ?? 0,
    totalError: raw.cartTotalError,
  });
}
