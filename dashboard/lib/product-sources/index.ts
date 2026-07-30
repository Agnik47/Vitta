// Picks which source serves each merchant, and caches real results.
//
// Order: fastest confirmed-working source first (Anakin, when a key is configured and that merchant
// is confirmed), then the proven webcmd browser path. A source that reports failure falls through
// to the next one rather than surfacing an error while another real option exists.
import { anakinSource } from "@/lib/product-sources/anakin";
import { webcmdSource } from "@/lib/product-sources/webcmd-fallback";
import type { LiveMerchant, MerchantSearchResult, ProductSource } from "@/lib/product-sources/types";

const SOURCES: ProductSource[] = [anakinSource, webcmdSource];

// Real search results, cached briefly so repeated/refined searches for the same term return
// instantly instead of re-driving a browser. Short TTL because prices and stock are genuinely
// volatile on these platforms — a stale price shown as current would be its own kind of wrong.
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  result: MerchantSearchResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): MerchantSearchResult | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.result;
}

function cacheSet(key: string, result: MerchantSearchResult): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Cheap eviction: drop the oldest insertion (Map preserves insertion order).
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function searchMerchant(merchant: LiveMerchant, query: string): Promise<MerchantSearchResult> {
  const key = `${merchant}:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  // Keep the FIRST failure, not the last: the primary source's error is the informative one. A
  // fallback's error (e.g. webcmd's generic EMPTY_RESULT) would otherwise mask why the fast path
  // actually failed.
  let firstFailure: MerchantSearchResult | null = null;

  for (const source of SOURCES) {
    if (!source.isAvailable() || !source.supports(merchant)) continue;
    const result = await source.search(merchant, query);
    if (result.ok) {
      // Only successful results are cached — caching a failure would keep a merchant dark for the
      // full TTL after a transient blip.
      cacheSet(key, result);
      return result;
    }
    firstFailure ??= result;
  }

  return firstFailure ?? { merchant, ok: false, products: [], error: "No configured source could serve this merchant" };
}

export const SEARCHABLE_MERCHANTS: LiveMerchant[] = ["blinkit", "zepto", "bigbasket"];
