"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, Minus, Plus, RefreshCw, ShieldCheck, ShoppingCart, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { MinCartBanner } from "@/components/shop/min-cart-banner";
import { useCart, type CartLine } from "@/lib/cart-context";
import { findProduct, MERCHANT_LABEL, type ShopMerchant } from "@/lib/shop-catalog";
import { getShopSessionId } from "@/lib/shop-session";
import type { Mandate } from "@/lib/types";

/** Only a real line (a live search result, or a catalog offer marked `real: true`) can go through
 *  an actual checkout — an illustrative offer has no merchant behind it to place an order with. */
function isRealLine(line: CartLine): boolean {
  if (line.live) return true;
  return Boolean(findProduct(line.productId)?.offers.find((o) => o.merchant === line.merchant)?.real);
}

function unitPriceOf(line: CartLine): number {
  if (line.live) return line.live.priceInr;
  return findProduct(line.productId)?.offers.find((o) => o.merchant === line.merchant)?.priceInr ?? 0;
}

interface RealCartState {
  totalInr?: number;
  itemCount: number;
}

export default function CartPage() {
  const router = useRouter();
  const { lines, removeItem, setQuantity, totalInr, hasRealItems } = useCart();
  const [starting, setStarting] = useState(false);
  const [minCartInr, setMinCartInr] = useState<number | null>(null);
  const [realCart, setRealCart] = useState<RealCartState | null>(null);
  const [realCartLoading, setRealCartLoading] = useState(false);
  const [realCartError, setRealCartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shop/config")
      .then((r) => r.json())
      .then((json: { minCartInr?: number }) => {
        if (!cancelled && typeof json.minCartInr === "number") setMinCartInr(json.minCartInr);
      })
      .catch(() => {
        // Non-fatal — Proceed just isn't gated on a minimum until this resolves, same as before
        // this check existed.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const realLines = lines.filter(isRealLine);
  const realMerchants = Array.from(new Set(realLines.map((l) => l.merchant)));
  const purchaseMerchant: ShopMerchant | null = realMerchants.length === 1 ? realMerchants[0] : null;
  // The real merchant's own product subtotal — never including an illustrative catalog offer's
  // delivery fee, matching how a real minimum-order-value threshold is actually applied at
  // checkout (product subtotal, not delivery). This is only ever a local ESTIMATE of what's been
  // clicked in this browser tab — the real merchant cart is the actual source of truth (see
  // refreshRealCart below), since it can hold items from an earlier session that this tab's
  // sessionStorage-scoped model has no way to know about.
  const purchaseMerchantSubtotalInr = purchaseMerchant
    ? realLines.filter((l) => l.merchant === purchaseMerchant).reduce((sum, l) => sum + unitPriceOf(l) * l.quantity, 0)
    : 0;

  // Real webcmd cart read against the actual merchant — the same figure decide() gets handed at
  // commit time (dist/cli/search.js resolves it with the gate's own cart-total resolver). This is
  // what the minimum-order-value check and the Proceed gate are keyed on once it's loaded; the
  // local estimate above is only a fallback while it's in flight or if the read fails, and is
  // always labeled as an estimate in the UI so the human is never told a made-up number is real.
  const refreshRealCart = useCallback((merchant: ShopMerchant) => {
    if (merchant === "district") return;
    setRealCartLoading(true);
    setRealCartError(null);
    fetch(`/api/shop/cart-read?merchant=${merchant}`)
      .then((r) => r.json())
      .then((json: { ok: boolean; totalInr?: number; itemCount?: number; message?: string; totalError?: string }) => {
        if (!json.ok) {
          setRealCartError(json.message ?? "Could not read the real cart");
          setRealCart(null);
          return;
        }
        if (json.totalError) {
          setRealCartError(json.totalError);
          setRealCart(null);
          return;
        }
        setRealCart({ totalInr: json.totalInr, itemCount: json.itemCount ?? 0 });
      })
      .catch((err: Error) => {
        setRealCartError(err.message);
        setRealCart(null);
      })
      .finally(() => setRealCartLoading(false));
  }, []);

  useEffect(() => {
    if (!purchaseMerchant) {
      setRealCart(null);
      setRealCartError(null);
      return;
    }
    refreshRealCart(purchaseMerchant);
    // Only when the merchant identity changes (not on every local quantity click) — a real cart
    // read is a genuine 10-90s browser round-trip, so this fires once per merchant selection plus
    // whenever the caller explicitly asks (handleAddSuggestion / the manual Refresh button), not on
    // every local render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseMerchant]);

  const verifiedTotalInr = realCart?.totalInr;
  const cartMismatch =
    verifiedTotalInr !== undefined && verifiedTotalInr !== purchaseMerchantSubtotalInr;
  // Gate on the LOCAL total, not the current real-cart snapshot: starting a purchase job clears
  // the real cart first (see PurchaseAgent's clearCartFirst) and rebuilds it from exactly this
  // tab's local item list, so the pre-clear real cart's total predicts nothing about what the job
  // will actually check out — found live: the real cart fluctuated between reads (₹220 -> ₹172 ->
  // ₹112 across three checks a few minutes apart, no add/remove clicks in between), which would
  // have wrongly blocked Proceed on a real, valid ₹160 local cart. The verified-real panel below
  // still surfaces that real number and the mismatch — as information, not as a gate — since the
  // real gate/decide() call re-verifies the true post-rebuild cart before any money moves regardless.
  const meetsMinimum = minCartInr === null || purchaseMerchantSubtotalInr >= minCartInr;
  const canProceed = realLines.length > 0 && purchaseMerchant !== null && meetsMinimum;

  async function handleProceed() {
    if (!purchaseMerchant) return;
    setStarting(true);
    try {
      const mandateRes = await fetch("/api/mandate").then((r) => r.json()).catch(() => ({ mandate: null }));
      const mandate = (mandateRes as { mandate: Mandate | null }).mandate;

      const items = realLines
        .filter((l) => l.merchant === purchaseMerchant)
        .map((l) => ({
          productId: l.productId,
          url: l.live?.url,
          productName: l.live?.name ?? findProduct(l.productId)?.name ?? l.productId,
          quantity: l.quantity,
        }));

      const res = await fetch("/api/shop/purchase-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getShopSessionId(),
          merchant: purchaseMerchant,
          items,
          minCartInr,
          mandateId: mandate?.mandate_id,
          confirm: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error("Could not start the purchase", { description: json.message });
        return;
      }
      router.push(`/shop/purchase/${json.jobId}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Cart"
        description="Everything you've added across merchants — real Blinkit items and illustrative offers together."
      />

      {lines.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Your cart is empty" hint="Search for a product and add an offer to your cart." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="border border-border bg-card">
            {lines.map((line) => {
              // Live-search-added lines carry their own real snapshot (name/price/image) — they
              // were never in the static mock catalog to begin with, so findProduct() can't
              // resolve them. Catalog-based lines resolve as before.
              const name = line.live?.name ?? findProduct(line.productId)?.name;
              const offer = line.live
                ? null
                : findProduct(line.productId)?.offers.find((o) => o.merchant === line.merchant);
              if (!name || (!line.live && !offer)) return null;
              const unitPrice = line.live?.priceInr ?? offer!.priceInr;
              const deliveryFee = line.live ? 0 : offer!.deliveryFeeInr;
              const lineTotal = (unitPrice + deliveryFee) * line.quantity;
              const isReal = Boolean(line.live) || Boolean(offer?.real);

              return (
                <div
                  key={`${line.productId}-${line.merchant}`}
                  className="flex items-center justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{name}</span>
                      {isReal && (
                        <span className="inline-flex shrink-0 items-center gap-1 border border-allow/30 bg-allow/10 px-1.5 py-0.5 text-[10px] font-medium text-allow">
                          <Zap className="size-3" strokeWidth={2.25} />
                          Real
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {MERCHANT_LABEL[line.merchant]} · ₹{unitPrice.toLocaleString("en-IN")} each
                      {line.live ? " (live price, delivery fee shown at real checkout)" : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 border border-border">
                    <button
                      onClick={() => setQuantity(line.productId, line.merchant, Math.max(1, line.quantity - 1))}
                      className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Minus className="size-3" strokeWidth={2} />
                    </button>
                    <span className="w-8 text-center font-mono text-sm tabular-nums">{line.quantity}</span>
                    <button
                      onClick={() => setQuantity(line.productId, line.merchant, Math.min(12, line.quantity + 1))}
                      className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Plus className="size-3" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="w-20 shrink-0 text-right font-mono text-sm font-medium tabular-nums text-foreground">
                    ₹{lineTotal.toLocaleString("en-IN")}
                  </div>

                  <button
                    onClick={() => removeItem(line.productId, line.merchant)}
                    className="shrink-0 text-ink-faint transition-colors hover:text-deny"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </div>
              );
            })}
          </div>

          {purchaseMerchant && (
            <>
              <div className="flex items-center justify-between gap-3 border border-border bg-card px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  {realCartLoading ? (
                    <>
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" strokeWidth={2} />
                      <span className="text-muted-foreground">Verifying against the real {MERCHANT_LABEL[purchaseMerchant]} cart…</span>
                    </>
                  ) : realCartError ? (
                    <>
                      <AlertTriangle className="size-3.5 shrink-0 text-step-up" strokeWidth={2} />
                      <span className="text-step-up">Could not verify the real cart: {realCartError}</span>
                    </>
                  ) : verifiedTotalInr !== undefined ? (
                    <>
                      <ShieldCheck className="size-3.5 shrink-0 text-allow" strokeWidth={2} />
                      <span className="text-foreground">
                        Verified real {MERCHANT_LABEL[purchaseMerchant]} cart: <strong className="font-mono">₹{verifiedTotalInr.toLocaleString("en-IN")}</strong>
                        {realCart && ` · ${realCart.itemCount} item(s)`}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not yet verified against the real cart.</span>
                  )}
                </div>
                <button
                  onClick={() => refreshRealCart(purchaseMerchant)}
                  disabled={realCartLoading}
                  className="flex shrink-0 items-center gap-1 text-ink-faint transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`size-3 ${realCartLoading ? "animate-spin" : ""}`} strokeWidth={2} />
                  Refresh
                </button>
              </div>

              {cartMismatch && (
                <div className="flex items-start gap-2.5 border border-step-up/30 bg-step-up/5 px-3 py-2.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-step-up" strokeWidth={1.75} />
                  <span>
                    The real {MERCHANT_LABEL[purchaseMerchant]} cart (₹{verifiedTotalInr?.toLocaleString("en-IN")}) doesn&apos;t match
                    what this tab has added this session (₹{purchaseMerchantSubtotalInr.toLocaleString("en-IN")}) — the real cart may
                    still hold items from an earlier session. The verified real total above is what will actually be checked out.
                  </span>
                </div>
              )}

              <MinCartBanner
                merchant={purchaseMerchant}
                cartTotalInr={purchaseMerchantSubtotalInr}
                onContinueShopping={() => router.push("/shop")}
                onItemAdded={() => refreshRealCart(purchaseMerchant)}
              />
            </>
          )}

          <div className="flex flex-col gap-3 border border-border bg-surface-sunken px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] tracking-widest text-ink-faint uppercase">Cart total</div>
                <div className="font-heading text-2xl font-semibold tabular-nums text-foreground">
                  ₹{totalInr.toLocaleString("en-IN")}
                </div>
                {!hasRealItems && (
                  <div className="mt-1 text-xs text-step-up">No real items in cart yet — nothing here can be purchased.</div>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={!canProceed || starting}>
                    {starting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Starting…
                      </>
                    ) : (
                      <>
                        Proceed to purchase
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-deny" strokeWidth={2} />
                      This moves real (test-mode) money
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This clears your real {purchaseMerchant ? MERCHANT_LABEL[purchaseMerchant] : ""} cart, adds exactly the{" "}
                      <strong className="font-mono text-foreground">₹{purchaseMerchantSubtotalInr.toLocaleString("en-IN")}</strong>{" "}
                      of items listed above for real, verifies it, and — if your mandate&apos;s real policy check allows it —
                      places a real order and draws from your real Dodo reserve. It runs to completion with no further
                      confirmation from you. Continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleProceed}>Yes, start the real purchase</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {realLines.length > 0 && realMerchants.length > 1 && (
              <div className="flex items-start gap-2.5 border border-step-up/30 bg-step-up/5 px-3 py-2.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-step-up" strokeWidth={1.75} />
                <span>
                  Your real items span {realMerchants.length} marketplaces (
                  {realMerchants.map((m) => MERCHANT_LABEL[m]).join(", ")}). A single purchase can only check out one
                  marketplace at a time — remove items from all but one to proceed.
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
