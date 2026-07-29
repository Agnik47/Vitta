// Resolve the authoritative pre-payment total for a commit-path decision from webcmd's own JSON.
//
// The bug this fixes (docs/common/02-DECISIONS.md ADR-013 follow-up 1, ADR-014): for a small cart
// with delivery/handling fees, `blinkit cart -f json`'s sum of per-line `payable` gave ₹20 while
// Blinkit's UI showed ₹55 (₹20 items + ₹30 delivery + ₹5 handling). `decide()` was therefore not
// always evaluating the merchant's true grand total — a ₹20 cart that is really ₹55 could clear a
// ₹50 cap, contradicting docs/03-WEBCMD-INTEGRATION.md § Step 3's premise that the total handed to
// decide() is authoritative.
//
// Why the fix lives here (a new file), not in `decide()`: decide() must stay pure and
// fee-agnostic per CLAUDE.md rule 2 — computing "what the merchant will really charge" from a mix
// of read commands is I/O-shaped resolution logic, and belongs on the webcmd side of the seam.
//
// Why extracted from `src/cli/gate.ts` (where the old, cart-only version lived) into its own
// module: the resolver is pure over parsed JSON, i.e. genuinely unit-testable without a live
// browser — moving it here lets us exercise every real-payload shape (small-cart fee gap, an empty
// cart, a checkout that's blocked, discrepancies between cart-sum and checkout-payable) as fast
// tests, not as one-off manual verifications hidden in a rehearsal transcript.
//
// The specific safety property this exposes: resolveCartTotalInr() returns the MAX of every
// price-shaped number webcmd surfaces for the cart. If any single field under-reports, the others
// still guard the cap. The only failure mode left is one webcmd's ENTIRE JSON is uniformly wrong
// — that's a webcmd bug outside our scope (CLAUDE.md rule 7 + "Do not modify webcmd" from
// docs/03-WEBCMD-INTEGRATION.md).

/** Real `blinkit/checkout` shape, per its columns in manifest.json:
 *  ["status","itemCount","itemsTotal","deliveryCharge","handlingCharge","payable",
 *   "cartState","checkoutBlocked","validations"]. Only what's consumed here is typed;
 *  extend if a future policy layer needs another field. */
export interface CheckoutRow {
  status?: string;
  itemCount?: number;
  itemsTotal?: number;
  deliveryCharge?: number;
  handlingCharge?: number;
  payable?: number;
  cartState?: string;
  checkoutBlocked?: boolean;
  validations?: unknown[];
}

/** Real `blinkit/cart` shape — a bare array of line items (found live, ADR-013 predecessor). */
export interface CartLineRow {
  price?: number;
  quantity?: number;
  total?: number;
  payable?: number;
  itemCount?: number;
}

export interface CartTotalResolution {
  /** The number to feed to decide(). The MAX of every candidate below that was present. */
  amountInr: number;
  /** Total item count (from checkout when present, else summed from cart lines). */
  itemCount: number;
  /** Which source(s) contributed to the returned amount, for the event log. */
  sources: string[];
  /** True when the merchant itself says checkout can't proceed (blocked or non-empty validations).
   *  The caller must refuse (STEP_UP or explicit fail) rather than pass this to decide() — an
   *  ALLOW here would attest to an order the merchant would have refused to place. */
  merchantBlocked: boolean;
  /** Human-readable reason for merchantBlocked, when true. Empty otherwise. */
  blockedReason: string;
}

/** Resolve the authoritative pre-payment total from webcmd's real cart+checkout JSON.
 *
 *  Contract:
 *   - Returns the MAX of every price-shaped field either payload exposes, per the "fail closed"
 *     invariant (CLAUDE.md rule 3): if the fields disagree, decide() should see the largest so a
 *     cap check can't be cleared by silently under-counting fees.
 *   - Throws if NEITHER payload has any usable number. `decide()` will then return DENY
 *     AMOUNT_UNPARSEABLE — nothing gets executed, nothing gets drawn. Matches the fail-closed
 *     posture of every other unresolvable-input path in this CLI.
 *
 *  Non-goals (deliberate):
 *   - This does NOT reach into the DOM to scrape hidden fee lines. That would require modifying
 *     webcmd or bypassing its JSON contract — both explicitly out of scope
 *     (docs/03-WEBCMD-INTEGRATION.md § Do not).
 *   - This does NOT decide "cart vs checkout" categorically. Neither is fully trustworthy on its
 *     own (both under-reported in the real ADR-013 run). MAX-of-everything is the correct
 *     policy-safe reconciliation. */
export function resolveCartTotalInr(
  checkout: CheckoutRow | undefined,
  cartLines: CartLineRow[] | undefined,
): CartTotalResolution {
  const candidates: Array<{ value: number; source: string }> = [];

  if (checkout) {
    if (typeof checkout.payable === 'number' && checkout.payable > 0) {
      candidates.push({ value: checkout.payable, source: 'checkout.payable' });
    }
    // Sum-of-components: catches the case where `payable` is the pre-fee number and the fees
    // ARE reported separately (the exact ADR-013 failure mode variant, if checkout ever fills in
    // deliveryCharge/handlingCharge for the same run it also under-reports payable).
    const componentSum =
      (checkout.itemsTotal ?? 0) + (checkout.deliveryCharge ?? 0) + (checkout.handlingCharge ?? 0);
    if (componentSum > 0) {
      candidates.push({ value: componentSum, source: 'checkout.itemsTotal+fees' });
    }
  }

  if (cartLines && cartLines.length > 0) {
    const cartSum = cartLines.reduce((sum, line) => sum + (line.payable ?? line.total ?? 0), 0);
    if (cartSum > 0) {
      candidates.push({ value: cartSum, source: 'cart.line-sum' });
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      'Neither checkout nor cart returned a usable amount (all fields missing or ₹0). Refusing to hand decide() an unparseable total.',
    );
  }

  // MAX, not sum — these are three views of the SAME cart, not three separate carts to be added.
  const winner = candidates.reduce((best, c) => (c.value > best.value ? c : best));
  const contributingSources = candidates.filter((c) => c.value === winner.value).map((c) => c.source);

  // Item count: prefer checkout's headline (single value), fall back to summing cart quantities,
  // fall back to line count. Never load-bearing for decide() (only cosmetic on the receipt), so
  // graceful degradation is fine here.
  let itemCount = 0;
  if (checkout && typeof checkout.itemCount === 'number') {
    itemCount = checkout.itemCount;
  } else if (cartLines && cartLines.length > 0) {
    itemCount = cartLines.reduce((sum, line) => sum + (line.quantity ?? 1), 0);
  }

  const merchantBlocked = Boolean(
    checkout?.checkoutBlocked === true || (checkout?.validations && checkout.validations.length > 0),
  );
  const blockedReason = merchantBlocked
    ? checkout?.checkoutBlocked === true
      ? 'checkout.checkoutBlocked = true'
      : `checkout.validations reported ${(checkout?.validations ?? []).length} issue(s)`
    : '';

  return {
    amountInr: winner.value,
    itemCount,
    sources: contributingSources,
    merchantBlocked,
    blockedReason,
  };
}
