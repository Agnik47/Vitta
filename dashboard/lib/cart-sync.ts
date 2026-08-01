// The write half of "the merchant's cart is the single source of truth" (read half: lib/real-cart.ts).
//
// THE CONTRACT
// ------------
// Every cart mutation follows the same four steps, with no shortcuts:
//
//   1. READ the real merchant cart — never assume the local copy's quantity is right.
//   2. COMPUTE the delta between the real current quantity and the desired quantity.
//   3. WRITE an ABSOLUTE target quantity (not "add N more").
//   4. RE-READ and VERIFY the merchant now actually reports the desired quantity.
//
// Only after step 4 succeeds may the UI update. If verification fails, the caller still gets the
// real cart back — so the user sees the truth, not the intent.
//
// WHY AN ABSOLUTE WRITE RATHER THAN A DELTA-SIZED ADD
// ---------------------------------------------------
// The obvious reading of "compute the delta, then apply it" is `add-to-cart --quantity <delta>`.
// That is what the old code effectively did, and it is not safe here: the packaged Blinkit
// add-to-cart is additive, so a delta-add is only correct if the cart is in exactly the state we
// read a moment ago. Any retry, double-submit, slow browser round-trip, or concurrent tab makes it
// silently wrong, and it compounds — this is precisely how a ₹160 cart became a real ₹354 one.
//
// An absolute write is IDEMPOTENT: applying "quantity = 3" twice leaves 3, not 6. The delta is still
// computed (steps 1-2) because it decides *whether* a write is needed at all and is what we report,
// but the write itself states the destination rather than the distance. Same intent, no drift.
//
// The absolute primitive comes from this repo's own webcmd adapter (webcmd-adapters/blinkit/
// set-cart-quantity.js) — packaged Blinkit has no way to decrease a quantity at all.
//
// Every write goes through the real `gate` CLI, never webcmd directly (CLAUDE.md rule 8 / ADR-015):
// a cart mutation is an access:'write' command and stays inside the one audited decision path, so it
// still produces a real GateEvent. It commits ₹0 — only place-order moves money.
import { friendlyGateFailureMessage, runGateCli } from "@/lib/gate-cli";
import type { AddToCartMerchant } from "@/lib/product-ref";
import { quantityOf, readRealCart, type RealCart } from "@/lib/real-cart";

/** Blinkit's own per-command ceiling (manifest: "max 12"), and the adapter enforces 0-12 too. */
const MAX_QUANTITY = 12;

export type CartSyncResult =
  | { ok: true; cart: RealCart; changed: boolean; previousQuantity: number; quantity: number }
  | { ok: false; message: string; cart?: RealCart };

/** Which real webcmd command expresses "make this line exactly N".
 *
 *  Only Blinkit has the absolute set-cart-quantity adapter today. For the other merchants this
 *  returns null and the caller fails closed rather than silently falling back to an additive
 *  add-to-cart — an additive write dressed up as a synchronized one is exactly the bug being fixed
 *  here, and it would be worse for it to be hidden behind a "sync" name. */
function absoluteSetCommand(merchant: AddToCartMerchant, productRef: string, quantity: number): string[] | null {
  if (merchant !== "blinkit") return null;
  return ["run", "--", "webcmd", "blinkit", "set-cart-quantity", productRef, "--quantity", String(quantity)];
}

/**
 * Sets one product to an exact quantity in the merchant's real cart, then returns the verified real
 * cart. `quantity: 0` removes the line.
 *
 * Never throws on a merchant/policy refusal — a DENY or a failed write is a normal outcome the UI
 * must render, so it comes back as `ok: false` with the real cart attached where possible.
 */
export async function syncCartQuantity(
  merchant: AddToCartMerchant,
  productRef: string,
  desiredQuantity: number,
  timeoutMs = 180_000
): Promise<CartSyncResult> {
  if (!Number.isInteger(desiredQuantity) || desiredQuantity < 0 || desiredQuantity > MAX_QUANTITY) {
    return { ok: false, message: `quantity must be a whole number between 0 and ${MAX_QUANTITY}` };
  }

  // STEP 1 — read the real cart. This is the only trusted view of "what is currently there".
  const before = await readRealCart(merchant);
  if (!before.ok) {
    return { ok: false, message: before.message };
  }

  // STEP 2 — compute the delta against the REAL quantity, not a local guess.
  const previousQuantity = quantityOf(before.cart, productRef);
  if (previousQuantity === desiredQuantity) {
    // Already correct. Doing nothing is the right answer — re-issuing an add here is exactly how
    // quantities used to creep upward on every retry.
    return { ok: true, cart: before.cart, changed: false, previousQuantity, quantity: desiredQuantity };
  }

  // STEP 3 — one absolute write to the destination quantity.
  const argv = absoluteSetCommand(merchant, productRef, desiredQuantity);
  if (!argv) {
    return {
      ok: false,
      message: `${merchant} has no absolute cart-quantity command, so its cart cannot be kept in sync yet. Blinkit is the supported merchant for synchronized carts.`,
      cart: before.cart,
    };
  }

  const result = await runGateCli(argv, timeoutMs);
  if (!result.ok) {
    const raw = result.stdout.trim() || result.stderr.trim() || "cart update failed";
    return { ok: false, message: friendlyGateFailureMessage(raw), cart: before.cart };
  }

  // STEP 4 — re-read and verify. The write command reports its own success, but "I wrote it" is a
  // different fact from "the merchant now says it" — and this project has already been burned once
  // by trusting a cart-mutation command's self-report (a clear-cart that reported success over a
  // cart that was still full).
  const after = await readRealCart(merchant);
  if (!after.ok) {
    return { ok: false, message: `Cart was updated but could not be verified: ${after.message}` };
  }

  const verifiedQuantity = quantityOf(after.cart, productRef);
  if (verifiedQuantity !== desiredQuantity) {
    return {
      ok: false,
      message: `Cart did not end up as expected — asked for ${desiredQuantity}, ${merchant} reports ${verifiedQuantity}. Showing the real cart.`,
      cart: after.cart,
    };
  }

  return { ok: true, cart: after.cart, changed: true, previousQuantity, quantity: verifiedQuantity };
}

/**
 * Empties the merchant's real cart, then verifies it is actually empty.
 *
 * Gates on the VERIFIED remaining count rather than the command's exit code, for the reason above:
 * a clear that reports success over a non-empty cart is a failure mode this project has already hit
 * for real.
 */
export async function clearRealCart(merchant: AddToCartMerchant, timeoutMs = 180_000): Promise<CartSyncResult> {
  if (merchant !== "blinkit") {
    return { ok: false, message: `${merchant} has no clear-cart command available.` };
  }

  const result = await runGateCli(["run", "--", "webcmd", "blinkit", "clear-cart"], timeoutMs);
  if (!result.ok) {
    const raw = result.stdout.trim() || result.stderr.trim() || "clear-cart failed";
    return { ok: false, message: friendlyGateFailureMessage(raw) };
  }

  const after = await readRealCart(merchant);
  if (!after.ok) {
    return { ok: false, message: `Cart was cleared but could not be verified: ${after.message}` };
  }
  if (after.cart.itemCount !== 0) {
    return {
      ok: false,
      message: `Cart still holds ${after.cart.itemCount} item(s) after clearing — refusing to report it as empty.`,
      cart: after.cart,
    };
  }

  return { ok: true, cart: after.cart, changed: true, previousQuantity: 0, quantity: 0 };
}
