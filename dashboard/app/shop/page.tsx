"use client";

import { useState } from "react";
import { Search, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExecutionModeToggle } from "@/components/shop/execution-mode-toggle";
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

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-allow/20 bg-allow/5 px-4 py-3">
        <Zap className="mt-0.5 size-3.5 shrink-0 text-allow" strokeWidth={2} />
        <p className="text-[13px] leading-relaxed text-muted-foreground">
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
        className="mb-6 overflow-hidden rounded-xl border border-border bg-card"
      >
        {/* Shown here, at the start of the workflow, so the mode is a deliberate choice made BEFORE
            building a cart — not something noticed for the first time at the confirm dialog. */}
        <div className="border-b border-border bg-muted/30 px-5 py-4">
          <ExecutionModeToggle />
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="flex max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
              <Input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="Search atta, biscuits, cookies…"
                className="h-11 rounded-lg pl-10 text-[15px]"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 rounded-lg px-6"
              disabled={!queryInput.trim() || rangeInverted || noMerchantsSelected}
            >
              Search
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="w-28">
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Min ₹</label>
              <Input
                type="number"
                min={1}
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="any"
                className="mt-1.5 rounded-lg"
              />
            </div>
            <div className="w-28">
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Max ₹</label>
              <Input
                type="number"
                min={1}
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="any"
                className="mt-1.5 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Marketplaces
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                {ALL_MERCHANTS.map((merchant) => {
                  const on = merchantsInput.includes(merchant);
                  return (
                    <label
                      key={merchant}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                        on
                          ? "border-seal/40 bg-seal/10 text-seal"
                          : "border-border text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleMerchant(merchant)}
                        className="sr-only"
                      />
                      <span className={`size-1.5 rounded-full ${on ? "bg-seal" : "bg-ink-faint/40"}`} />
                      {MERCHANT_LABEL[merchant]}
                    </label>
                  );
                })}
              </div>
            </div>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                watchInput
                  ? "border-seal/40 bg-seal/10 text-seal"
                  : "border-border text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <input
                type="checkbox"
                checked={watchInput}
                onChange={(e) => setWatchInput(e.target.checked)}
                className="sr-only"
              />
              <span className={`size-1.5 rounded-full ${watchInput ? "bg-seal" : "bg-ink-faint/40"}`} />
              Keep watching for a match
            </label>
          </div>

          {rangeInverted && (
            <p className="text-xs text-deny">Min ₹ is above Max ₹ — nothing could ever match that range.</p>
          )}
          {noMerchantsSelected && <p className="text-xs text-deny">Select at least one marketplace to search.</p>}

          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-faint">
            The budget range filters real results only — it never invents a match. &ldquo;Keep watching&rdquo;
            re-checks these marketplaces on an interval while this page stays open and surfaces anything that
            comes into range; it never buys on its own, since every purchase in this project needs your
            explicit confirmation first.
          </p>
        </div>
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
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-20 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shop_empty_state.jpg"
            alt="Search empty state"
            className="size-44 rounded-2xl object-cover opacity-90 grayscale-[0.25]"
          />
          <div className="max-w-[300px]">
            <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">
              What are you looking for?
            </h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Search for any grocery item to compare live prices across Zepto, Blinkit, and BigBasket.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
