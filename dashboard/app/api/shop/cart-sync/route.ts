// The one endpoint the shop UI uses for cart state — reads and writes both return the VERIFIED real
// merchant cart, so the dashboard can only ever mirror it. See lib/cart-sync.ts for the four-step
// read → delta → absolute-write → verify contract and why it replaces the old optimistic local cart.
//
//   GET  ?merchant=blinkit                          -> the real cart, right now
//   POST { merchant, productId, quantity }          -> set that line to exactly `quantity` (0 removes)
//   POST { merchant, clear: true }                  -> empty the cart
//
// Every response carries the full real cart, including on failure where one could be read, because
// the UI's job is to show what the merchant actually holds — especially when a write didn't do what
// was asked.
import { clearRealCart, syncCartQuantity } from "@/lib/cart-sync";
import { readRealCart } from "@/lib/real-cart";
import { isAddToCartMerchant, resolveProductRef } from "@/lib/product-ref";

export async function GET(req: Request) {
  const merchant = new URL(req.url).searchParams.get("merchant");
  if (!isAddToCartMerchant(merchant)) {
    return Response.json({ ok: false, message: "merchant must be one of blinkit, zepto, bigbasket" }, { status: 400 });
  }

  const result = await readRealCart(merchant);
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message, authRequired: result.authRequired }, { status: 502 });
  }
  return Response.json({ ok: true, ...result.cart });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const { merchant, productId, url, quantity, clear } = (body ?? {}) as {
    merchant?: unknown;
    productId?: unknown;
    url?: unknown;
    quantity?: unknown;
    clear?: unknown;
  };

  if (!isAddToCartMerchant(merchant)) {
    return Response.json({ ok: false, message: "merchant must be one of blinkit, zepto, bigbasket" }, { status: 400 });
  }

  if (clear === true) {
    const cleared = await clearRealCart(merchant);
    if (!cleared.ok) {
      return Response.json({ ok: false, message: cleared.message, cart: cleared.cart }, { status: 422 });
    }
    return Response.json({ ok: true, ...cleared.cart, changed: cleared.changed });
  }

  if (typeof quantity !== "number") {
    return Response.json({ ok: false, message: "quantity is required (0 removes the line)" }, { status: 400 });
  }

  // Same resolution the add-to-cart route uses — Blinkit wants an id, Zepto a URL — so a caller can
  // pass whichever it has and the merchant gets the form it can actually use. Fails closed: nothing
  // that isn't a valid reference for THIS merchant reaches webcmd.
  const candidates = [productId, url].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (candidates.length === 0) {
    return Response.json({ ok: false, message: "productId or url is required" }, { status: 400 });
  }
  let resolved = resolveProductRef(candidates[0], merchant);
  for (let i = 1; i < candidates.length && !resolved.ok; i++) {
    resolved = resolveProductRef(candidates[i], merchant);
  }
  if (!resolved.ok) {
    return Response.json({ ok: false, message: resolved.message }, { status: 400 });
  }

  const result = await syncCartQuantity(merchant, resolved.arg, quantity);
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message, cart: result.cart }, { status: 422 });
  }

  return Response.json({
    ok: true,
    ...result.cart,
    changed: result.changed,
    previousQuantity: result.previousQuantity,
    quantity: result.quantity,
  });
}
