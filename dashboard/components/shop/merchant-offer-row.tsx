"use client";

import { useState } from "react";
import { CheckCircle2, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import { MERCHANT_LABEL, type MerchantOffer } from "@/lib/shop-catalog";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One merchant's offer for a product. Real Blinkit offers get a solid "Real" tag (icon+text+color,
 * per this app's established accessibility rule) — everything else is tagged "Illustrative" at the
 * same visual weight, never silently blended in. See ADR-015 / CLAUDE.md rule 8.
 */
export function MerchantOfferRow({
  productId,
  offer,
  isCheapest,
}: {
  productId: string;
  offer: MerchantOffer;
  isCheapest: boolean;
}) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);
  const finalCost = offer.priceInr + offer.deliveryFeeInr;

  async function handleAdd() {
    setAdding(true);
    const result = await addItem(productId, offer.merchant);
    setAdding(false);
    if (!result.ok) {
      toast.error("Could not add to real cart", { description: result.message });
      return;
    }
    if (offer.real) {
      toast.success(`Added to real ${MERCHANT_LABEL[offer.merchant]} cart`, {
        description: `Product ${offer.productId} — ₹${offer.priceInr}`,
      });
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0",
        isCheapest && "bg-seal/[0.03]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-20 shrink-0 text-sm font-medium text-foreground">
          {MERCHANT_LABEL[offer.merchant]}
        </span>

        {offer.real ? (
          <span className="inline-flex shrink-0 items-center gap-1 border border-allow/30 bg-allow/10 px-1.5 py-0.5 text-[10px] font-medium text-allow">
            <Zap className="size-3" strokeWidth={2.25} />
            Real
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 border border-step-up/30 bg-step-up/10 px-1.5 py-0.5 text-[10px] font-medium text-step-up">
            Illustrative
          </span>
        )}

        {isCheapest && (
          <span className="hidden shrink-0 items-center gap-1 text-[10px] font-medium text-seal sm:inline-flex">
            <CheckCircle2 className="size-3" strokeWidth={2.25} />
            Best value
          </span>
        )}

        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Truck className="size-3" strokeWidth={1.75} />
          {offer.etaMinutes} min
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <div className="font-mono text-sm font-medium tabular-nums text-foreground">
            ₹{finalCost.toLocaleString("en-IN")}
          </div>
          {offer.deliveryFeeInr > 0 && (
            <div className="text-[10px] text-ink-faint">
              ₹{offer.priceInr} + ₹{offer.deliveryFeeInr} delivery
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!offer.inStock || adding}
          onClick={handleAdd}
          className="shrink-0"
        >
          {adding ? "Adding…" : offer.inStock ? "Add to cart" : "Out of stock"}
        </Button>
      </div>
    </div>
  );
}
