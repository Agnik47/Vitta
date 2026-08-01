"use client";

// One unified grid of real product cards across every merchant — not grouped into per-merchant
// sections. Each card is a real listing from one real marketplace; results are never merged or
// matched across merchants (that would require product-identity matching this build can't verify,
// and guessing at it would be fabrication). Cards stream in as each merchant's source resolves.
//
// Product Selection + Quantity Selection happen right here, on each card: clicking "Add to cart"
// IS the selection — it runs a real webcmd add-to-cart (₹0 committed until checkout) and lands the
// item in the Unified Cart (lib/cart-context.tsx), where quantity can be adjusted further. This page
// never runs a purchase itself and never navigates straight into a purchase flow for a single
// item — every real spend happens from the cart's own "Proceed to Purchase" confirmation, so a
// multi-item, multi-merchant search session all funnels through one cart, not a side-channel
// selection per product.
import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, ExternalLink, ImageOff, Loader2, PackageSearch, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateWatchDialog, type WatchTarget } from "@/components/shop/create-watch-dialog";
import { useCart } from "@/lib/cart-context";
import { MERCHANT_LABEL, type ShopMerchant } from "@/lib/shop-catalog";
import { canAddToCart, type AddToCartMerchant } from "@/lib/product-ref";
import type { LiveMerchant, LiveProduct, MerchantSearchResult } from "@/lib/live-search";

const ALL_MERCHANTS: LiveMerchant[] = ["blinkit", "zepto", "bigbasket"];

// Each merchant gets its own badge tint so a card's origin is readable at a glance in a mixed grid.
// Text label always present too — never color alone (this app's established accessibility rule).
const MERCHANT_BADGE: Record<LiveMerchant, string> = {
  blinkit: "bg-[#F8CB46]/15 text-[#8a6d00] border-[#F8CB46]/40",
  zepto: "bg-[#6C2BD9]/10 text-[#6C2BD9] border-[#6C2BD9]/30",
  bigbasket: "bg-[#84C225]/15 text-[#4d7a00] border-[#84C225]/40",
};

export interface BudgetRange {
  minInr?: number;
  maxInr?: number;
}

type Slot = { status: "loading" } | { status: "done"; result: MerchantSearchResult };

/** A product's identity within the grid — Anakin results have no id, so the URL carries it. */
function productKey(p: LiveProduct): string {
  return `${p.merchant}::${p.productId || p.url || p.name}`;
}

function inBudget(p: LiveProduct, budget: BudgetRange): boolean {
  if (budget.minInr !== undefined && p.priceInr < budget.minInr) return false;
  if (budget.maxInr !== undefined && p.priceInr > budget.maxInr) return false;
  return true;
}

function ProductImage({ product }: { product: LiveProduct }) {
  const [broken, setBroken] = useState(false);
  if (!product.imageUrl || broken) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-surface-sunken">
        <div className="flex flex-col items-center gap-1 text-ink-faint">
          <ImageOff className="size-5" strokeWidth={1.5} />
          <span className="text-[10px]">No image available</span>
        </div>
      </div>
    );
  }
  return (
    // Plain <img>, not next/image — real merchant CDN hosts aren't known ahead of time, and an
    // unconfigured remotePattern would hard-error instead of degrading.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.imageUrl}
      alt={product.name}
      onError={() => setBroken(true)}
      className="aspect-square w-full bg-surface-sunken object-contain"
      loading="lazy"
    />
  );
}

function ProductCard({
  product,
  cheapest,
  onWatch,
}: {
  product: LiveProduct;
  cheapest: boolean;
  onWatch: (target: WatchTarget) => void;
}) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  // Only Blinkit can actually be bought by this project, and a watch that could never fire a real
  // purchase would be theatre. An id is required too — it's what the price check is keyed on.
  const watchable = product.merchant === "blinkit" && !!product.productId;

  // Whether this specific result can actually reach webcmd's add-to-cart — Blinkit needs an id,
  // Zepto needs a product URL. Checked up front so an unusable card says why instead of failing
  // after the click.
  const addable = canAddToCart(product.merchant as AddToCartMerchant, product.productId, product.url);

  async function handleAdd(e: React.MouseEvent) {
    e.stopPropagation(); // adding is not selecting
    setAdding(true);
    const result = await addItem(product.productId, product.merchant as ShopMerchant, {
      name: product.name,
      priceInr: product.priceInr,
      imageUrl: product.imageUrl,
      url: product.url,
    });
    setAdding(false);
    if (!result.ok) {
      toast.error("Could not add to real cart", { description: result.message });
      return;
    }
    toast.success(`Added to real ${MERCHANT_LABEL[product.merchant]} cart`, {
      description: `${product.name} — ₹${product.priceInr.toLocaleString("en-IN")}`,
    });
  }

  const discount =
    product.mrpInr && product.mrpInr > product.priceInr
      ? Math.round(((product.mrpInr - product.priceInr) / product.mrpInr) * 100)
      : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card transition-colors hover:border-ink-faint">
      <div className="relative">
        <ProductImage product={product} />
        <span
          className={`absolute top-2 left-2 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${MERCHANT_BADGE[product.merchant]}`}
        >
          {MERCHANT_LABEL[product.merchant]}
        </span>
        {discount !== null && (
          <span className="absolute top-2 right-2 rounded bg-allow px-1.5 py-0.5 text-[10px] font-bold text-white">
            {discount}% OFF
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {cheapest && (
          <span className="w-fit rounded border border-allow/40 bg-allow/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-allow uppercase">
            Lowest price
          </span>
        )}

        <div className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-medium text-foreground">
          {product.name}
        </div>
        {product.brand && <div className="-mt-1 text-xs text-muted-foreground">{product.brand}</div>}

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            ₹{product.priceInr.toLocaleString("en-IN")}
          </span>
          {product.mrpInr !== undefined && product.mrpInr > product.priceInr && (
            <span className="font-mono text-xs text-ink-faint line-through">
              ₹{product.mrpInr.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {!product.available && <div className="text-xs text-deny">{product.availabilityLabel}</div>}
        {product.available && !addable.ok && (
          <div className="text-xs text-step-up" title={addable.ok ? undefined : addable.message}>
            Can&apos;t be added automatically
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {watchable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onWatch({
                  productId: product.productId,
                  productName: product.name,
                  currentPriceInr: product.priceInr,
                });
              }}
              className="w-full justify-center gap-1.5 border border-dashed border-border text-xs text-muted-foreground hover:text-seal"
            >
              <Crosshair className="size-3.5" strokeWidth={1.75} />
              Watch price
            </Button>
          )}
          <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!product.available || adding || !addable.ok}
            onClick={handleAdd}
            className="flex-1"
          >
            {adding ? "Adding…" : "Add to cart"}
          </Button>
          {product.url && (
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`View on ${MERCHANT_LABEL[product.merchant]}`}
              className="flex shrink-0 items-center gap-1 rounded border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              View
              <ExternalLink className="size-3" strokeWidth={1.75} />
            </a>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

function loadingSlots(merchants: LiveMerchant[]): Record<LiveMerchant, Slot> {
  return Object.fromEntries(merchants.map((m) => [m, { status: "loading" } as Slot])) as Record<LiveMerchant, Slot>;
}

export function LiveSearchResults({
  query,
  budget = {},
  watch = false,
  merchants = ALL_MERCHANTS,
}: {
  query: string;
  budget?: BudgetRange;
  /** Re-runs the real search on an interval while this view stays open, so a product that comes
   *  into budget surfaces without the user re-searching. It never buys anything by itself. */
  watch?: boolean;
  /** Restrict which marketplaces are actually queried — an unselected merchant makes no request at
   *  all (not just hidden client-side), so a preferred-marketplace filter saves the real search
   *  round-trip too. Defaults to all three. */
  merchants?: LiveMerchant[];
}) {
  const [slots, setSlots] = useState<Record<LiveMerchant, Slot>>(() => loadingSlots(merchants));
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [watchTarget, setWatchTarget] = useState<WatchTarget | null>(null);
  // Bumped per query so a slow response from a superseded search can't overwrite a newer one.
  const generation = useRef(0);

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSlots(loadingSlots(merchants));
  }

  // Never calls setState synchronously — only from the fetch callbacks. The "back to loading" reset
  // is handled by the adjust-state-during-render block above, which is where React wants it.
  const runSearch = useCallback(
    () => {
      const myGeneration = ++generation.current;

      for (const merchant of merchants) {
        fetch(`/api/shop/search?q=${encodeURIComponent(query)}&merchant=${merchant}`)
          .then((res) => res.json())
          .then((json: { ok: boolean; results?: MerchantSearchResult[]; message?: string }) => {
            if (generation.current !== myGeneration) return;
            const result: MerchantSearchResult =
              json.ok && json.results?.[0]
                ? json.results[0]
                : { merchant, ok: false, products: [], error: json.message ?? "Request failed" };
            setSlots((prev) => ({ ...prev, [merchant]: { status: "done", result } }));
          })
          .catch((err: Error) => {
            if (generation.current !== myGeneration) return;
            setSlots((prev) => ({
              ...prev,
              [merchant]: { status: "done", result: { merchant, ok: false, products: [], error: err.message } },
            }));
          });
      }
    },
    // The parent remounts this component (via a `key` that includes the merchant selection) on any
    // real filter change, same as it already does for query/budget — so `merchants` only needs to
    // be a stable reference across ONE mount's lifetime, not across every render.
    [query, merchants]
  );

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    if (!watch) return;
    // Server-side results are cached for 5 minutes, so polling faster than that just returns the
    // same cached answer while still costing a request. Match the cache window.
    const id = setInterval(() => {
      runSearch();
      setRefreshedAt(Date.now());
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [watch, runSearch]);

  const done = merchants.filter((m) => slots[m]?.status === "done");
  const stillLoading = merchants.filter((m) => slots[m]?.status === "loading");
  const allProducts = done.flatMap((m) => {
    const slot = slots[m];
    return slot.status === "done" ? slot.result.products : [];
  });
  // The budget filter narrows real results only. A merchant with nothing in range contributes no
  // cards — it never gets a placeholder or an estimated price.
  const products = allProducts.filter((p) => inBudget(p, budget));
  const filteredOut = allProducts.length - products.length;

  const failures = done
    .map((m) => (slots[m]?.status === "done" ? (slots[m] as { result: MerchantSearchResult }).result : null))
    .filter((r): r is MerchantSearchResult => r !== null && !r.ok);

  const allDone = stillLoading.length === 0;

  // Recommendation only — the cheapest available real result. Never auto-selected.
  const cheapest = products
    .filter((p) => p.available)
    .reduce<LiveProduct | null>((best, p) => (best === null || p.priceInr < best.priceInr ? p : best), null);
  const cheapestKey = cheapest ? productKey(cheapest) : null;

  return (
    <div className="flex flex-col gap-4 pb-24">
      {stillLoading.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          Fetching live from {stillLoading.map((m) => MERCHANT_LABEL[m]).join(", ")}…
        </div>
      )}

      {watch && allDone && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          Watching for a product in range — re-checking every 5 minutes
          {refreshedAt && ` · last checked ${new Date(refreshedAt).toLocaleTimeString()}`}
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((p) => {
            const key = productKey(p);
            return (
              <ProductCard key={key} product={p} cheapest={key === cheapestKey} onWatch={setWatchTarget} />
            );
          })}
        </div>
      )}

      <CreateWatchDialog
        target={watchTarget}
        open={watchTarget !== null}
        onOpenChange={(next) => {
          if (!next) setWatchTarget(null);
        }}
      />

      {allDone && products.length === 0 && failures.length < merchants.length && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-12 text-center">
          <PackageSearch className="size-5 text-ink-faint" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">
            No matching products found across Zepto, Blinkit, or BigBasket.
          </p>
          {filteredOut > 0 && (
            <p className="text-xs text-ink-faint">
              {filteredOut} real {filteredOut === 1 ? "result was" : "results were"} found but fell outside your
              budget range.
            </p>
          )}
        </div>
      )}

      {allDone && products.length > 0 && filteredOut > 0 && (
        <p className="text-xs text-ink-faint">
          {filteredOut} further real {filteredOut === 1 ? "result" : "results"} hidden by your budget range.
        </p>
      )}

      {/* Failures are reported separately from "no results" — they're different facts, and hiding a
          broken merchant behind an empty grid would misrepresent what the user is seeing. */}
      {allDone && failures.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border px-4 py-3">
          {failures.map((f) => (
            <div key={f.merchant} className="flex items-start gap-2 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-step-up" strokeWidth={1.75} />
              <span>
                <span className="font-medium text-foreground">{MERCHANT_LABEL[f.merchant]}</span>{" "}
                unavailable — {f.error ?? "unknown error"}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
