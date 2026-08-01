// The merchant's OWN cart, read live — the single source of truth for everything the shop UI shows.
//
// WHY THIS EXISTS (the bug it replaces)
// -------------------------------------
// The dashboard used to keep its own optimistic cart in sessionStorage and merely *fire* a real
// add-to-cart alongside it. Those two models drifted apart immediately and permanently, because:
//
//   1. `blinkit add-to-cart --quantity N` is ADDITIVE, not absolute (its own write step does
//      `quantity: current + quantity`). Clicking Add once on a product already in the real cart
//      incremented the real cart while the local copy also incremented independently — and any
//      retry, double-click, or re-run silently multiplied the real quantity again.
//   2. Blinkit had no remove/decrement/clear command at all, so the real cart could only ever grow.
//      Items from previous sessions were unremovable and invisible to the local model.
//
// Observed live 2026-08-01: dashboard said ₹165, the real Blinkit cart held ₹330; a purchase the
// human approved at ₹160/4 items was really ₹354/10 items. That is a money-safety bug, not a
// cosmetic one — the number a human approves must be the number the merchant will charge.
//
// The fix has two halves. This file is the read half: the real cart, normalized, always
// authoritative. The write half is lib/cart-sync.ts, which sets ABSOLUTE quantities (via this
// repo's set-cart-quantity adapter) and then re-reads through here to verify.
//
// Read path note: goes through dist/cli/search.js, not the gate CLI, for the same real reason
// cart-read/route.ts documents — `gate run` short-circuits every access:'read' command and returns
// WITHOUT executing it (rule 0), so the gate literally cannot fetch cart contents. search.js is the
// narrow read-only entry point that refuses anything not marked access:'read' in the manifest.
import { runSearchCli } from "@/lib/live-search";
import type { AddToCartMerchant } from "@/lib/product-ref";

/** One line of the merchant's real cart. Every money-relevant field here comes from the merchant,
 *  never from local state. `imageUrl` is the one exception and is deliberately optional — Blinkit's
 *  `cart` command doesn't expose it (not in its `columns` schema), so the UI merges in a cached
 *  image purely for presentation. An image never affects a total, a quantity, or a decision. */
export interface RealCartLine {
  productId: string;
  name: string;
  variant: string;
  priceInr: number;
  quantity: number;
  lineTotalInr: number;
}

export interface RealCart {
  merchant: AddToCartMerchant;
  lines: RealCartLine[];
  /** Resolved by the CLI with the gate's own resolver — the same figure decide() is handed at
   *  commit time. Deliberately not recomputed here: a second, subtly different sum in the dashboard
   *  would be worse than showing none at all. */
  totalInr: number;
  itemCount: number;
}

export type ReadRealCartResult =
  | { ok: true; cart: RealCart }
  | { ok: false; message: string; authRequired?: boolean };

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Normalizes one raw `blinkit/cart` row. Real columns, verified against the live manifest:
 *  ["status","productId","name","variant","price","quantity","total","itemCount","payable","cartState"] */
function normalizeLine(row: Record<string, unknown>): RealCartLine | null {
  const productId = String(row.productId ?? "").trim();
  const quantity = toNumber(row.quantity);
  // A row without an id or with zero quantity isn't a cart line — drop it rather than render a
  // phantom entry the merchant doesn't actually hold.
  if (!productId || quantity <= 0) return null;
  const priceInr = toNumber(row.price);
  return {
    productId,
    name: String(row.name ?? "").trim() || productId,
    variant: String(row.variant ?? "").trim(),
    priceInr,
    quantity,
    // Prefer the merchant's own line total; fall back to price x quantity only if absent.
    lineTotalInr: row.total !== undefined && row.total !== null ? toNumber(row.total) : priceInr * quantity,
  };
}

/**
 * Reads the merchant's real cart and returns it normalized. An EMPTY cart is a success, not an
 * error — `cartTotalError` is set by the CLI whenever the resolver can't produce a total, which
 * legitimately includes "there is nothing in the cart". Treating that as a failure was what made an
 * emptied cart look like a broken read.
 */
/** Turns a raw webcmd failure into one sentence a person can act on. Presentation only — it never
 *  changes what happened, and the underlying read still failed exactly as it did. Without this the
 *  cart banner renders webcmd's own multi-line diagnostic verbatim, which is unreadable and reads
 *  like a crash rather than "the browser couldn't reach Blinkit just now". */
function readableCartError(raw: string, merchant: AddToCartMerchant): string {
  const name = merchant.charAt(0).toUpperCase() + merchant.slice(1);
  if (/ERR_ABORTED|ERR_NETWORK|ERR_CONNECTION|navigation failed|net::/i.test(raw)) {
    return `Couldn't reach ${name} just now — the browser navigation was interrupted. Nothing was changed; hit Refresh to try again.`;
  }
  if (/timed out/i.test(raw)) {
    return `${name} took too long to respond. Nothing was changed; hit Refresh to try again.`;
  }
  if (/auth|login|not.?logged.?in/i.test(raw)) {
    return `Not signed in to ${name} — sign in to that account, then hit Refresh.`;
  }
  // Unrecognized shape: show the first line only. The full text is still in the server logs, and a
  // wall of stack-trace in a banner helps nobody.
  return raw.split("\n")[0].trim() || `Could not read the real ${name} cart.`;
}

export async function readRealCart(merchant: AddToCartMerchant, timeoutMs = 90_000): Promise<ReadRealCartResult> {
  const raw = await runSearchCli([merchant, "cart"], timeoutMs);
  if (!raw.ok) {
    return {
      ok: false,
      message: readableCartError(raw.message ?? "", merchant),
      authRequired: raw.authRequired,
    };
  }

  const rows = Array.isArray(raw.rows) ? (raw.rows as Array<Record<string, unknown>>) : [];
  const lines = rows.map(normalizeLine).filter((l): l is RealCartLine => l !== null);

  return {
    ok: true,
    cart: {
      merchant,
      lines,
      // An empty cart genuinely totals 0 — that is a real fact, not an invented number.
      totalInr: raw.cartTotalInr ?? 0,
      itemCount: raw.cartItemCount ?? lines.reduce((sum, l) => sum + l.quantity, 0),
    },
  };
}

/** The real current quantity of one product, straight from the merchant. Returns 0 when absent.
 *  This is what every write must compute its delta against — never a local assumption. */
export function quantityOf(cart: RealCart, productId: string): number {
  return cart.lines.find((l) => l.productId === productId)?.quantity ?? 0;
}
