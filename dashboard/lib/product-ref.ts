// Turns a real search result into the exact argument each merchant's `add-to-cart` command wants.
//
// This is not cosmetic — the three merchants genuinely disagree, verified against manifest.json:
//
//   blinkit/add-to-cart   positional `productId`  "Blinkit product id"
//   zepto/add-to-cart     positional `product`    "Product URL from Zepto search results"
//   bigbasket/add-to-cart positional `product`    "Product ID or URL"
//
// Before this existed, the cart-add route validated everything against /^[a-zA-Z0-9_-]{1,64}$/,
// which rejects a URL outright — so every Zepto add-to-cart failed, and BigBasket only worked when
// a bare id happened to be available. The Anakin-backed search returns a real product URL but no
// id (those listing pages expose none), so the URL is the identifier we actually have.
//
// BigBasket ids ARE recoverable from the URL: `/pd/<id>/<slug>/`. Verified live —
// `search.js bigbasket product 150502`, where 150502 came from a real Anakin URL, returned the real
// ₹299 "fresho! Farm Eggs" listing. The id is preferred over the URL because it's the form already
// proven to work end to end.
//
// Security: a URL is accepted only after being parsed with the URL constructor and checked to be
// https on a hostname belonging to that merchant. Never a regex over the raw string, and never a
// URL whose host doesn't match the merchant it's claimed for — otherwise a crafted "product URL"
// could point the real browser session at an arbitrary site.

export type AddToCartMerchant = "blinkit" | "zepto" | "bigbasket";

/** Exact hostnames each merchant is allowed to be referenced by. Suffix matching is done against
 *  these with a leading-dot check, so `evil-bigbasket.com` and `bigbasket.com.attacker.net` both
 *  fail while `www.bigbasket.com` passes. */
const MERCHANT_HOSTS: Record<AddToCartMerchant, string[]> = {
  blinkit: ["blinkit.com"],
  zepto: ["zeptonow.com", "zepto.co.in"],
  bigbasket: ["bigbasket.com"],
};

const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isAddToCartMerchant(value: unknown): value is AddToCartMerchant {
  return value === "blinkit" || value === "zepto" || value === "bigbasket";
}

/** Parse `raw` as an https URL belonging to `merchant`, or return undefined. */
function merchantUrl(raw: string, merchant: AddToCartMerchant): URL | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const host = url.hostname.toLowerCase();
  const allowed = MERCHANT_HOSTS[merchant].some((base) => host === base || host.endsWith(`.${base}`));
  return allowed ? url : undefined;
}

/** BigBasket product detail URLs are `/pd/<numeric id>/<slug>/`. */
function bigbasketIdFromUrl(url: URL): string | undefined {
  const match = /\/pd\/(\d+)(?:\/|$)/.exec(url.pathname);
  return match?.[1];
}

export type ProductRefResult =
  | { ok: true; arg: string; kind: "id" | "url" }
  | { ok: false; message: string };

/**
 * Resolve the positional argument for `webcmd <merchant> add-to-cart <arg>`.
 *
 * Fails closed with an explicit reason rather than guessing: passing the wrong form to webcmd
 * would drive a real browser session toward the wrong thing, and a vague "invalid product id"
 * hides which of the three merchants' conventions was violated.
 */
export function resolveProductRef(raw: string, merchant: AddToCartMerchant): ProductRefResult {
  const value = raw.trim();
  if (!value) return { ok: false, message: "Product reference is empty" };

  const url = merchantUrl(value, merchant);
  const looksLikeUrl = /^https?:\/\//i.test(value);

  if (looksLikeUrl && !url) {
    return {
      ok: false,
      message: `That URL is not an https ${merchant} product URL — refusing to hand it to the browser`,
    };
  }

  switch (merchant) {
    case "blinkit":
      // Blinkit's command takes an id and nothing else. Blinkit results come from webcmd's own
      // search, which always supplies one, so there's no URL fallback to build here.
      if (url) return { ok: false, message: "Blinkit add-to-cart needs a product id, not a URL" };
      return PRODUCT_ID_PATTERN.test(value)
        ? { ok: true, arg: value, kind: "id" }
        : { ok: false, message: "Invalid Blinkit product id" };

    case "zepto":
      // Zepto's command takes the product URL. A bare id can't be turned into one reliably (its
      // URLs are /pn/<slug>/pvid/<uuid> — the slug isn't derivable), so refuse rather than guess.
      if (!url) {
        return { ok: false, message: "Zepto add-to-cart needs the product URL from the search result" };
      }
      return { ok: true, arg: url.toString(), kind: "url" };

    case "bigbasket": {
      // Accepts either. Prefer the id extracted from the URL — that's the form verified live.
      if (url) {
        const id = bigbasketIdFromUrl(url);
        if (id) return { ok: true, arg: id, kind: "id" };
        return { ok: true, arg: url.toString(), kind: "url" };
      }
      return PRODUCT_ID_PATTERN.test(value)
        ? { ok: true, arg: value, kind: "id" }
        : { ok: false, message: "Invalid BigBasket product id or URL" };
    }
  }
}

/** Can this real search result be added to a cart at all? Used by the UI to disable Proceed with a
 *  reason instead of letting the user click into a guaranteed failure. */
export function canAddToCart(
  merchant: AddToCartMerchant,
  productId: string | undefined,
  url: string | undefined
): ProductRefResult {
  // Try the id first for Blinkit (it has no URL form), the URL first for the other two.
  const candidates = merchant === "blinkit" ? [productId, url] : [url, productId];
  let firstFailure: ProductRefResult | undefined;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const result = resolveProductRef(candidate, merchant);
    if (result.ok) return result;
    firstFailure ??= result;
  }
  return firstFailure ?? { ok: false, message: `No usable ${merchant} product reference on this result` };
}
