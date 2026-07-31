"use client";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingCart, Trash2, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useCart } from "@/lib/cart-context";
import { findProduct, MERCHANT_LABEL } from "@/lib/shop-catalog";

export default function CartPage() {
  const { lines, removeItem, setQuantity, totalInr, hasRealItems } = useCart();

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

          <div className="flex items-center justify-between border border-border bg-surface-sunken px-4 py-3">
            <div>
              <div className="text-[10px] tracking-widest text-ink-faint uppercase">Cart total</div>
              <div className="font-heading text-2xl font-semibold tabular-nums text-foreground">
                ₹{totalInr.toLocaleString("en-IN")}
              </div>
              {!hasRealItems && (
                <div className="mt-1 text-xs text-step-up">No real Blinkit items in cart — checkout can only simulate.</div>
              )}
            </div>
            <Button asChild size="lg">
              <Link href="/shop/checkout" className="flex items-center gap-2">
                Proceed to checkout
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
