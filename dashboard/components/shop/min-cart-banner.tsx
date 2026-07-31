"use client";

// Minimum Cart Value Banner (ADR-015 requirement 4).
// Shows the real shortfall to a merchant's minimum order value and, when short, real live
// suggestions to close the gap — never fabricated products or invented prices. The minimum itself
// comes from the same single /api/shop/config value the automatic purchase pipeline already uses
// (see cart/page.tsx's handleProceed) — this used to keep its own hardcoded per-merchant table,
// which could silently drift from that value; one number, one source, per config route's own
// design note.

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MERCHANT_LABEL, type ShopMerchant } from "@/lib/shop-catalog";
import { useCart } from "@/lib/cart-context";
import type { LiveMerchant, LiveProduct, MerchantSearchResult } from "@/lib/live-search";

// Same staple order PurchaseAgent.ts's findRealTopUp() searches server-side for the fully
// automatic pipeline — kept in sync by hand (mirrors src/ shapes, same pattern as every other
// dashboard/lib file per docs/06-DASHBOARD-SPEC.md).
const TOPUP_QUERIES = ["milk", "bread", "eggs", "biscuits", "bananas"];
const MAX_SUGGESTIONS = 3;

interface MinCartBannerProps {
  merchant: ShopMerchant;
  cartTotalInr: number;
  onContinueShopping?: () => void;
  /** Called after a real add-to-cart from a suggestion succeeds, so the caller can re-verify the
   *  real merchant cart rather than trust this component's own optimistic local add. */
  onItemAdded?: () => void;
}

export function MinCartBanner({ merchant, cartTotalInr, onContinueShopping, onItemAdded }: MinCartBannerProps) {
  const { addItem } = useCart();
  const [minRequired, setMinRequired] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<LiveProduct[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const isLiveMerchant = merchant === "blinkit" || merchant === "zepto" || merchant === "bigbasket";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/config")
      .then((r) => r.json())
      .then((json: { minCartInr?: number }) => {
        if (!cancelled && typeof json.minCartInr === "number") setMinRequired(json.minCartInr);
      })
      .catch(() => {
        // Non-fatal — the banner just won't render until this resolves.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shortfall = minRequired !== null ? Math.max(0, minRequired - cartTotalInr) : 0;

  // Fetch real suggestions only once we know there's a real gap to close, and only once per
  // merchant/shortfall-existing — re-searching on every ₹1 of cart movement would just hammer a
  // real 20-40s browser search for no benefit once a usable list is already showing.
  //
  // `loadingSuggestions` is deliberately NOT a dependency here even though the effect sets it:
  // it's derived UI state, and putting a value the effect itself writes into that same effect's
  // dependency array creates a self-cancelling loop — flipping it to true re-triggers the effect,
  // whose cleanup then cancels the fetch that had just started, forever, before it can ever land.
  // Found live: every real search kept completing successfully (confirmed via server logs) while
  // the banner stayed stuck on "Searching…" indefinitely, because `cancelled` was flipping true
  // moments after each fetch began.
  useEffect(() => {
    if (!isLiveMerchant || shortfall <= 0 || suggestions !== null) return;
    let cancelled = false;
    setLoadingSuggestions(true);

    (async () => {
      for (const query of TOPUP_QUERIES) {
        try {
          const res = await fetch(`/api/shop/search?q=${encodeURIComponent(query)}&merchant=${merchant}`);
          const json: { ok: boolean; results?: MerchantSearchResult[] } = await res.json();
          const result = json.ok ? json.results?.[0] : undefined;
          const candidates = (result?.ok ? result.products : [])
            .filter((p) => p.available && p.priceInr > 0)
            .sort((a, b) => a.priceInr - b.priceInr)
            .slice(0, MAX_SUGGESTIONS);
          if (candidates.length > 0) {
            if (!cancelled) setSuggestions(candidates);
            return;
          }
        } catch {
          // Real network/parse failure on this query — try the next staple rather than give up.
        }
      }
      if (!cancelled) setSuggestions([]); // every real query came back empty — honestly show none
    })().finally(() => {
      if (!cancelled) setLoadingSuggestions(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isLiveMerchant, merchant, shortfall, suggestions]);

  // Cart moved back into range (e.g. the user removed an item) — drop stale suggestions so a later
  // shortfall re-fetches fresh ones instead of showing an old, possibly-sold-out list.
  useEffect(() => {
    if (shortfall <= 0 && suggestions !== null) setSuggestions(null);
  }, [shortfall, suggestions]);

  if (merchant === "district" || minRequired === null) return null;

  if (shortfall === 0) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-allow/30 bg-allow/10 px-4 py-2.5 text-xs text-allow">
        <div className="flex items-center gap-2 font-medium">
          <ShoppingBag className="size-4 shrink-0" />
          Minimum order value of ₹{minRequired} satisfied for {MERCHANT_LABEL[merchant]}
        </div>
      </div>
    );
  }

  async function handleAddSuggestion(product: LiveProduct) {
    setAddingId(product.productId || product.url || product.name);
    const result = await addItem(product.productId, merchant, {
      name: product.name,
      priceInr: product.priceInr,
      imageUrl: product.imageUrl,
      url: product.url,
    });
    setAddingId(null);
    if (!result.ok) {
      // The banner has no toast context of its own — a failed real add-to-cart just leaves the
      // suggestion clickable again rather than silently pretending it worked.
      setSuggestions((prev) => prev ?? null);
      return;
    }
    onItemAdded?.();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-500" strokeWidth={2} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">
            Your cart total is below {MERCHANT_LABEL[merchant]}&apos;s minimum order value.
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {MERCHANT_LABEL[merchant]} requires a minimum cart total of{" "}
            <strong className="font-mono text-foreground">₹{minRequired}</strong>. You are currently{" "}
            <strong className="font-mono text-orange-600 dark:text-orange-400">₹{shortfall} short</strong> (current
            total: ₹{cartTotalInr}).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-orange-500/20 pt-3">
        <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          Real {MERCHANT_LABEL[merchant]} products to close the gap:
        </span>

        {loadingSuggestions && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            Searching {MERCHANT_LABEL[merchant]} live…
          </span>
        )}

        {suggestions?.length === 0 && !loadingSuggestions && (
          <span className="text-xs text-muted-foreground">
            No real in-stock staples found to suggest right now — search for something else below.
          </span>
        )}

        {suggestions?.map((p) => {
          const id = p.productId || p.url || p.name;
          return (
            <Button
              key={id}
              size="sm"
              variant="outline"
              disabled={addingId === id}
              onClick={() => handleAddSuggestion(p)}
              className="h-7 gap-1 border-orange-500/30 text-xs hover:bg-orange-500/10"
            >
              {addingId === id ? (
                <Loader2 className="size-3 animate-spin text-orange-500" />
              ) : (
                <Plus className="size-3 text-orange-500" />
              )}
              {p.name} (+₹{p.priceInr})
            </Button>
          );
        })}

        {onContinueShopping && (
          <Button size="sm" variant="ghost" onClick={onContinueShopping} className="ml-auto h-7 text-xs">
            Keep shopping
          </Button>
        )}
      </div>
    </div>
  );
}
