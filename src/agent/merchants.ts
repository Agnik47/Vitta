// One profile per marketplace this build can actually purchase from — the single place merchant
// quirks live, so PurchaseAgent.ts itself stays generic across all three.
//
// Verified against the real manifest.json (809 commands after this build's custom BigBasket
// adapters — see webcmd/clis/bigbasket/*.js) and src/webcmd/commit-spec.ts, which remains the
// authority on commit command + proof kind; this file only adds what the agent needs beyond that.

export type PurchaseMerchant = 'blinkit' | 'zepto' | 'bigbasket';

export interface MerchantProfile {
  site: PurchaseMerchant;
  /** What add-to-cart's positional argument must be. Blinkit takes a bare product id; Zepto's
   *  manifest help text is literally "Product URL from Zepto search results"; BigBasket accepts
   *  either (verified live: /pd/<id>/ works, so an id is preferred when available). */
  productRefKind: 'id' | 'url' | 'id-or-url';
  /** Per-command quantity ceiling from each site's own manifest args. */
  maxQuantity: number;
  /** True if the merchant has a clear-cart command in its webcmd manifest. Defaults to true;
   *  set to false if not available. */
  supportsClearCart?: boolean;
  /** True if the merchant has a command that sets a cart line to an EXACT quantity (rather than
   *  only adding on top of what's there). When true, the agent states absolute destinations, which
   *  is idempotent and survives retries; when false it must fall back to the additive add-to-cart,
   *  which is only correct from a known-empty cart. */
  supportsAbsoluteQuantity?: boolean;
  /** A precondition that must hold before this merchant can return anything real, checked with a
   *  real read command — not a guess. Absent means no known precondition. */
  precondition?: {
    /** Read command to run to check the precondition. */
    check: string;
    /** True if the parsed row satisfies the precondition. */
    satisfied: (row: Record<string, unknown>) => boolean;
    /** Shown to the human when unsatisfied — this is a one-time setup step, not a bug to retry. */
    message: string;
  };
}

export const MERCHANT_PROFILES: Record<PurchaseMerchant, MerchantProfile> = {
  blinkit: {
    site: 'blinkit',
    productRefKind: 'id',
    maxQuantity: 12,
    // True as of 2026-08-01: packaged webcmd genuinely has no Blinkit clear-cart, so this was false
    // and the pipeline's clear step always skipped — which is how a previous session's real items
    // survived into a later purchase (a human-approved ₹160/4-item cart checked out as ₹354/10).
    // This repo now ships a real one (webcmd-adapters/blinkit/clear-cart.js, verified live), so the
    // clear step runs for real. It is still gated on a verified-empty read-back, not on the
    // command's own success report — see PurchaseAgent Step 1.
    supportsClearCart: true,
    // Blinkit's packaged add-to-cart is ADDITIVE (`quantity: current + quantity`), so building a
    // cart with it is only correct from a known-empty start and breaks on any retry. This repo's
    // set-cart-quantity adapter states an absolute destination instead, which is idempotent.
    supportsAbsoluteQuantity: true,
  },
  zepto: {
    site: 'zepto',
    productRefKind: 'url',
    maxQuantity: 12,
    precondition: {
      check: 'location',
      // Real shape verified live: {selected, area, city, pincode, hasCoordinates, source}. A
      // session with no delivery location returns every field empty/false and every Zepto search
      // returns zero products — this is why, not scraper flakiness (see docs/OUTCOME.md).
      satisfied: (row) => row.selected === true || Boolean(row.pincode),
      message:
        'Zepto has no delivery location set in this browser session. Set one in the browser once — ' +
        'this is a one-time setup step, not something the agent can do (choosing an address is a ' +
        'real-world action outside what browser automation should silently decide).',
    },
  },
  bigbasket: {
    site: 'bigbasket',
    productRefKind: 'id-or-url',
    maxQuantity: 20,
  },
};

export function isPurchaseMerchant(value: unknown): value is PurchaseMerchant {
  return value === 'blinkit' || value === 'zepto' || value === 'bigbasket';
}
