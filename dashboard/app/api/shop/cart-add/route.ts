// Legacy "add N of this product" endpoint, now implemented on top of the synchronized cart layer.
//
// It used to call `gate run -- webcmd blinkit add-to-cart --quantity N` directly. That command is
// ADDITIVE, so this route was one of the two sources of the dashboard/Blinkit cart divergence: a
// retry, a double-click, or a re-submit silently multiplied the real quantity while the dashboard's
// local copy incremented once. Rather than delete the route (and risk a caller elsewhere quietly
// 404ing), it now resolves the real current quantity first and writes an ABSOLUTE destination via
// lib/cart-sync.ts — so even a duplicated request can only ever land the cart where it was asked to
// be, and the caller gets the verified real cart back.
//
// Prefer POST /api/shop/cart-sync for new code: it states the target quantity outright, which is
// fully idempotent. This route's "add one more" contract is inherently relative and is kept only
// for compatibility.
import { syncCartQuantity } from "@/lib/cart-sync";
import { quantityOf, readRealCart } from "@/lib/real-cart";
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

  const addQuantity = typeof quantity === "number" && Number.isInteger(quantity) ? quantity : 1;
  if (addQuantity < 1 || addQuantity > 12) {
    return Response.json({ ok: false, message: "quantity must be between 1 and 12" }, { status: 400 });
  }

  // Resolve "add N" against the REAL cart rather than assuming it starts wherever the caller thinks.
  const before = await readRealCart(site);
  if (!before.ok) {
    return Response.json({ ok: false, message: before.message }, { status: 502 });
  }
  const target = Math.min(quantityOf(before.cart, resolved.arg) + addQuantity, 12);

  const result = await syncCartQuantity(site, resolved.arg, target);
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message, cart: result.cart }, { status: 422 });
  }

  return Response.json({ ok: true, ref: resolved.arg, quantity: result.quantity, cart: result.cart });
}
