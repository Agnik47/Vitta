// Real, ₹0-cost webcmd add-to-cart — routed through the real `gate` CLI (never webcmd directly)
// so it still passes through decide() and lands a real GateEvent, same as every other write in
// this project. See ADR-015 / CLAUDE.md rule 8.
//
// The product reference each merchant wants differs (id vs URL) and is resolved by
// lib/product-ref.ts, which also does the host validation — see that file for why a plain regex
// was wrong here.
import { runGateCli } from "@/lib/gate-cli";
import { isAddToCartMerchant, resolveProductRef, type AddToCartMerchant } from "@/lib/product-ref";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { productId, quantity, merchant, url } = (body ?? {}) as {
    productId?: unknown;
    quantity?: unknown;
    merchant?: unknown;
    url?: unknown;
  };

  // Defaults to blinkit so the original Blinkit-only call sites keep working unchanged.
  const site: AddToCartMerchant = isAddToCartMerchant(merchant) ? merchant : "blinkit";

  // Zepto needs the URL and Blinkit needs the id, so accept both fields and let product-ref.ts
  // pick whichever this merchant can actually use.
  const candidates = [
    site === "blinkit" ? productId : url,
    site === "blinkit" ? url : productId,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  if (candidates.length === 0) {
    return Response.json({ ok: false, message: "productId or url is required" }, { status: 400 });
  }

  let resolved = resolveProductRef(candidates[0], site);
  for (let i = 1; i < candidates.length && !resolved.ok; i++) {
    resolved = resolveProductRef(candidates[i], site);
  }
  if (!resolved.ok) {
    // Fail closed: nothing that isn't a valid reference for THIS merchant reaches webcmd.
    return Response.json({ ok: false, message: resolved.message }, { status: 400 });
  }

  const qty = typeof quantity === "number" && Number.isInteger(quantity) ? quantity : 1;
  // Blinkit and Zepto cap at 12, BigBasket at 20 (manifest). 12 is the safe common ceiling.
  if (qty < 1 || qty > 12) {
    return Response.json({ ok: false, message: "quantity must be between 1 and 12" }, { status: 400 });
  }

  // All three add-to-cart commands accept --quantity (verified in manifest.json; an earlier
  // comment here claiming zepto/bigbasket lacked it was simply wrong).
  const result = await runGateCli(
    ["run", "--", "webcmd", site, "add-to-cart", resolved.arg, "--quantity", String(qty)],
    120_000 // a real browser add-to-cart measured 20-40s per merchant; 60s was too tight
  );

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate run failed" },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, raw: result.stdout.trim(), ref: resolved.arg });
}
