"use client";

import { useState } from "react";
import { Search, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveSearchResults, type BudgetRange } from "@/components/shop/live-search-results";
import { MERCHANT_LABEL } from "@/lib/shop-catalog";
import type { LiveMerchant } from "@/lib/live-search";

const ALL_MERCHANTS: LiveMerchant[] = ["blinkit", "zepto", "bigbasket"];

interface ActiveSearch {
  query: string;
  budget: BudgetRange;
  watch: boolean;
  merchants: LiveMerchant[];
}

function parseBudget(raw: string): number | undefined {
  const n = Number(raw.trim());
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function ShopPage() {
  const [queryInput, setQueryInput] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [watchInput, setWatchInput] = useState(false);
  const [merchantsInput, setMerchantsInput] = useState<LiveMerchant[]>(ALL_MERCHANTS);
  // Only set once the user actually submits — a live search fires real requests per merchant, so
  // this must never fire on every keystroke.
  const [active, setActive] = useState<ActiveSearch | null>(null);

  const minInr = parseBudget(minInput);
  const maxInr = parseBudget(maxInput);
  const rangeInverted = minInr !== undefined && maxInr !== undefined && minInr > maxInr;
  const noMerchantsSelected = merchantsInput.length === 0;

  function toggleMerchant(merchant: LiveMerchant) {
    setMerchantsInput((prev) =>
      prev.includes(merchant) ? prev.filter((m) => m !== merchant) : [...prev, merchant]
    );
  }

  function handleSearch() {
    const q = queryInput.trim();
    if (!q || rangeInverted || noMerchantsSelected) return;
    setActive({ query: q, budget: { minInr, maxInr }, watch: watchInput, merchants: merchantsInput });
  }

  return (
    <div>
      <PageHeader
        title="Search & compare"
        description="Search a product for real, live results across every marketplace this project has a real integration with."
      />

      <div className="mb-5 flex items-center gap-2.5 border border-border bg-card px-4 py-2.5">
        <Zap className="size-3.5 shrink-0 text-allow" strokeWidth={2} />
        <p className="text-xs text-muted-foreground">
          Every card is a real listing fetched live from that marketplace — no mock data, and prices
          are never merged or estimated across merchants. A merchant that returns nothing or errors
          says so honestly rather than showing a placeholder.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="mb-6 flex flex-col gap-3"
      >
        <div className="flex max-w-lg items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Search atta, biscuits, cookies…"
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={!queryInput.trim() || rangeInverted || noMerchantsSelected}>
            Search
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <label className="text-[11px] tracking-wide text-ink-faint uppercase">Min ₹</label>
            <Input
              type="number"
              min={1}
              value={minInput}
              onChange={(e) => setMinInput(e.target.value)}
              placeholder="any"
              className="mt-1.5"
            />
          </div>
          <div className="w-32">
            <label className="text-[11px] tracking-wide text-ink-faint uppercase">Max ₹</label>
            <Input
              type="number"
              min={1}
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
              placeholder="any"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-wide text-ink-faint uppercase">Marketplaces</label>
            <div className="mt-1.5 flex items-center gap-3">
              {ALL_MERCHANTS.map((merchant) => (
                <label key={merchant} className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={merchantsInput.includes(merchant)}
                    onChange={() => toggleMerchant(merchant)}
                    className="size-3.5 accent-[var(--seal)]"
                  />
                  {MERCHANT_LABEL[merchant]}
                </label>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={watchInput}
              onChange={(e) => setWatchInput(e.target.checked)}
              className="size-3.5 accent-[var(--seal)]"
            />
            Keep watching for a match
          </label>
        </div>

        {rangeInverted && (
          <p className="text-xs text-deny">Min ₹ is above Max ₹ — nothing could ever match that range.</p>
        )}
        {noMerchantsSelected && (
          <p className="text-xs text-deny">Select at least one marketplace to search.</p>
        )}

        <p className="max-w-2xl text-xs text-ink-faint">
          The budget range filters real results only — it never invents a match. &ldquo;Keep watching&rdquo;
          re-checks these marketplaces on an interval while this page stays open and surfaces anything that
          comes into range; it never buys on its own, since every purchase in this project needs your
          explicit confirmation first.
        </p>
      </form>

      {active ? (
        <LiveSearchResults
          key={`${active.query}|${active.budget.minInr ?? ""}|${active.budget.maxInr ?? ""}|${active.merchants.join(",")}`}
          query={active.query}
          budget={active.budget}
          watch={active.watch}
          merchants={active.merchants}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border px-6 py-20 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shop_empty_state.jpg"
            alt="Search empty state"
            className="w-48 h-48 rounded-xl object-cover shadow-sm opacity-90 grayscale-[0.2]"
          />
          <div className="max-w-[280px]">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              What are you looking for?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for any grocery item to compare live prices across Zepto, Blinkit, and BigBasket.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
