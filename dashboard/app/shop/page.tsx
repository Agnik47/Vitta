"use client";

import { useMemo, useState } from "react";
import { Search, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { ProductCompareCard } from "@/components/shop/product-compare-card";
import { EmptyState } from "@/components/shared/empty-state";
import { searchCatalog } from "@/lib/shop-catalog";

export default function ShopPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCatalog(query), [query]);

  return (
    <div>
      <PageHeader
        title="Search & compare"
        description="Search a product, compare final checkout cost across merchants, add the best offer to your cart."
      />

      <div className="mb-5 flex items-center gap-2.5 border border-border bg-card px-4 py-2.5">
        <Zap className="size-3.5 shrink-0 text-allow" strokeWidth={2} />
        <p className="text-xs text-muted-foreground">
          Blinkit offers tagged <span className="font-medium text-allow">Real</span> add to an
          actual live Blinkit cart via webcmd. Other merchants show representative pricing — no
          live scraping/integration exists for them yet.
        </p>
      </div>

      <div className="relative mb-6 max-w-lg">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search atta, biscuits, cookies…"
          className="pl-9"
        />
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Search} title="No products match your search" hint="Try a different term, e.g. “atta” or “biscuit”." />
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((product) => (
            <ProductCompareCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
