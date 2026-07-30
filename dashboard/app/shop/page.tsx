"use client";

import { useState } from "react";
import { Search, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LiveSearchResults } from "@/components/shop/live-search-results";

export default function ShopPage() {
  const [queryInput, setQueryInput] = useState("");
  // Only set once the user actually submits — each live search fires real, seconds-scale webcmd
  // browser automations per merchant, so this must never fire on every keystroke.
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

  function handleSearch() {
    const q = queryInput.trim();
    if (q) setActiveQuery(q);
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
        className="mb-6 flex max-w-lg items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" strokeWidth={1.75} />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search atta, biscuits, cookies…"
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={!queryInput.trim()}>
          Search
        </Button>
      </form>

      {activeQuery && <LiveSearchResults query={activeQuery} />}
    </div>
  );
}
