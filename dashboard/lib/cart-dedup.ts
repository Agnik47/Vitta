// Cart deduplication & quantity rules (ADR-015 requirement 3).
// Prevents duplicate additions from repeated search API responses, retries, or page refreshes.
//
// A standalone copy of src/agent/cart-dedup.ts, not a re-export — a relative import reaching
// outside dashboard/ crosses Turbopack's pinned root (`turbopack.root: __dirname` in
// next.config.ts, since dashboard/ is a genuinely separate app, not a workspace member) and
// silently resolves to zero exports at bundle time even though `tsc` alone doesn't catch it
// (found live via `npm run build`, not by inspection). Same "mirror src/ shapes by hand" pattern
// dashboard/lib/purchase-job-state.ts already uses — see docs/06-DASHBOARD-SPEC.md § Why a second
// app instead of extending the CLI. Keep in sync by hand if src/agent/cart-dedup.ts changes.

export interface CartLineItem {
  merchant: "blinkit" | "zepto" | "bigbasket" | "district";
  productId: string;
  url?: string;
  title: string;
  brand?: string;
  priceInr: number;
  mrpInr?: number;
  imageUrl?: string;
  quantity: number;
}

export interface CartSummary {
  grandTotalInr: number;
  totalItemCount: number;
  merchantTotals: Record<string, number>;
  merchantItemCounts: Record<string, number>;
}

/** Generates a normalized unique key per merchant line item.
 *  Uses merchant + (productId OR normalized url OR normalized title) as identifier. */
export function getCartLineKey(
  merchant: string,
  productId: string,
  url?: string,
  name?: string
): string {
  const normMerchant = merchant.toLowerCase().trim();
  const idStr = (productId || "").trim().toLowerCase();
  if (idStr && idStr !== "undefined" && idStr !== "null" && idStr !== "0") {
    return `${normMerchant}::${idStr}`;
  }

  if (url && url.trim()) {
    try {
      const parsed = new URL(url.trim());
      const cleanPath = parsed.pathname.replace(/\/+$/, "").toLowerCase();
      if (cleanPath) return `${normMerchant}::url:${cleanPath}`;
    } catch {
      // invalid URL fallback
    }
  }

  const normTitle = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${normMerchant}::title:${normTitle || "unknown"}`;
}

/** Merges duplicate cart lines into a single canonical line item with aggregated quantity. */
export function deduplicateCartLines(lines: CartLineItem[]): CartLineItem[] {
  const lineMap = new Map<string, CartLineItem>();

  for (const item of lines) {
    const key = getCartLineKey(item.merchant, item.productId, item.url, item.title);
    const existing = lineMap.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      if (!existing.imageUrl && item.imageUrl) existing.imageUrl = item.imageUrl;
      if (!existing.brand && item.brand) existing.brand = item.brand;
    } else {
      lineMap.set(key, { ...item });
    }
  }

  return Array.from(lineMap.values());
}

/** Adds a product to an existing cart line array, incrementing quantity if already present. */
export function addOrUpdateCartItem(
  lines: CartLineItem[],
  newItem: CartLineItem
): CartLineItem[] {
  const copy = lines.map((l) => ({ ...l }));
  const keyToFind = getCartLineKey(newItem.merchant, newItem.productId, newItem.url, newItem.title);
  const existingIdx = copy.findIndex(
    (l) => getCartLineKey(l.merchant, l.productId, l.url, l.title) === keyToFind
  );

  if (existingIdx >= 0) {
    copy[existingIdx].quantity += newItem.quantity;
  } else {
    copy.push({ ...newItem });
  }

  return copy;
}

/** Groups cart line items by marketplace merchant. */
export function groupCartByMerchant(lines: CartLineItem[]): Record<string, CartLineItem[]> {
  const grouped: Record<string, CartLineItem[]> = {};
  for (const item of lines) {
    if (!grouped[item.merchant]) grouped[item.merchant] = [];
    grouped[item.merchant].push(item);
  }
  return grouped;
}

/** Calculates summary totals across all cart line items. */
export function calculateCartSummary(lines: CartLineItem[]): CartSummary {
  let grandTotalInr = 0;
  let totalItemCount = 0;
  const merchantTotals: Record<string, number> = {};
  const merchantItemCounts: Record<string, number> = {};

  for (const item of lines) {
    const lineTotal = item.priceInr * item.quantity;
    grandTotalInr += lineTotal;
    totalItemCount += item.quantity;

    merchantTotals[item.merchant] = (merchantTotals[item.merchant] || 0) + lineTotal;
    merchantItemCounts[item.merchant] = (merchantItemCounts[item.merchant] || 0) + item.quantity;
  }

  return {
    grandTotalInr,
    totalItemCount,
    merchantTotals,
    merchantItemCounts,
  };
}
