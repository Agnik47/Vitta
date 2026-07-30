// The proven-but-slow source: drives a real stealth browser via webcmd (20-40s per merchant,
// measured live). Kept exactly as-is from the prior pass — this is the honest fallback whenever a
// faster source doesn't cover a merchant or fails on it, so real data still reaches the user rather
// than a gap or a fabrication.
import { searchOneMerchant } from "@/lib/live-search";
import type { LiveMerchant, MerchantSearchResult, ProductSource } from "@/lib/product-sources/types";

export const webcmdSource: ProductSource = {
  name: "webcmd",
  isAvailable: () => true,
  // Every merchant in scope has a real, manifest-declared webcmd `search` command.
  supports: () => true,
  search(merchant: LiveMerchant, query: string): Promise<MerchantSearchResult> {
    return searchOneMerchant(merchant, query);
  },
};
