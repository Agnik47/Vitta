// Real, ₹0-cost webcmd add-to-cart for Blinkit items — routed through the real `gate` CLI (never
// webcmd directly) so it still passes through decide() and lands a real GateEvent, same as every
// other write in this project. See ADR-015 / CLAUDE.md rule 8.
import { runGateCli } from "@/lib/gate-cli";
import { CATALOG } from "@/lib/shop-catalog";

// Only product ids that actually exist as a real Blinkit offer in the catalog may be added for
// real — this is the whitelist that keeps this route from becoming an arbitrary webcmd proxy.
const REAL_BLINKIT_PRODUCT_IDS = new Set(
  CATALOG.flatMap((p) => p.offers.filter((o) => o.merchant === "blinkit" && o.real && o.productId).map((o) => o.productId!))
);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { productId, quantity } = (body ?? {}) as { productId?: unknown; quantity?: unknown };

  if (typeof productId !== "string" || !REAL_BLINKIT_PRODUCT_IDS.has(productId)) {
    // Fail closed: an unrecognized product id never reaches webcmd.
    return Response.json({ ok: false, message: "Unknown or non-real product id" }, { status: 400 });
  }

  const qty = typeof quantity === "number" && Number.isInteger(quantity) ? quantity : 1;
  if (qty < 1 || qty > 12) {
    return Response.json({ ok: false, message: "quantity must be between 1 and 12" }, { status: 400 });
  }

  const result = await runGateCli(["run", "--", "webcmd", "blinkit", "add-to-cart", productId, "--quantity", String(qty)]);

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.stdout.trim() || result.stderr.trim() || "gate run failed" },
      { status: 422 }
    );
  }

  return Response.json({ ok: true, raw: result.stdout.trim() });
}
