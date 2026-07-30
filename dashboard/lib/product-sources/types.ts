// Common contract every product data source implements, so the search route can try a fast source
// (Anakin) and fall back to a slower-but-proven one (webcmd) without either knowing about the other.
//
// Deliberately re-exports LiveProduct/LiveMerchant rather than redefining them: the webcmd path
// already produces exactly this shape and is verified against real merchant responses, so a second
// near-identical interface would just be drift waiting to happen.
import type { LiveMerchant, LiveProduct, MerchantSearchResult } from "@/lib/live-search";

export type { LiveMerchant, LiveProduct, MerchantSearchResult };

export interface ProductSource {
  /** Short name for logging/debugging which source actually served a result. */
  readonly name: string;
  /** False when the source isn't usable right now (e.g. no API key configured) — the route then
   * skips straight to the next source instead of burning a failed round-trip. */
  isAvailable(): boolean;
  /** Which merchants this source is CONFIRMED to work for. A merchant is only listed here once a
   * real call has actually returned real data for it — never on the strength of docs alone. */
  supports(merchant: LiveMerchant): boolean;
  search(merchant: LiveMerchant, query: string): Promise<MerchantSearchResult>;
}
