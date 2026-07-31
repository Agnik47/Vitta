"use client";

// Minimum Cart Value Banner component (ADR-015 requirement 4).
// Displays marketplace minimum threshold requirements, shortfall remaining, staple suggestions
// from the same marketplace, and automatically enables Proceed when satisfied.

import { AlertTriangle, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MERCHANT_LABEL, type ShopMerchant } from "@/lib/shop-catalog";
import { useCart } from "@/lib/cart-context";

type SupportedMinCartMerchant = "blinkit" | "zepto" | "bigbasket";

const MARKETPLACE_MIN_VALUES: Record<SupportedMinCartMerchant, number> = {
  blinkit: 150,
  zepto: 100,
  bigbasket: 200,
};

const STAPLE_TOPUPS: Record<SupportedMinCartMerchant, Array<{ name: string; priceInr: number; productId: string }>> = {
  blinkit: [
    { name: "Amul Taaza Toned Milk 500ml", priceInr: 28, productId: "topup-blinkit-milk" },
    { name: "Fresh Table Eggs (6 pack)", priceInr: 55, productId: "topup-blinkit-eggs" },
    { name: "Britannia White Bread 400g", priceInr: 40, productId: "topup-blinkit-bread" },
  ],
  zepto: [
    { name: "Nandini Toned Milk 500ml", priceInr: 27, productId: "topup-zepto-milk" },
    { name: "Farm Fresh Eggs (6 pcs)", priceInr: 52, productId: "topup-zepto-eggs" },
    { name: "Modern Whole Wheat Bread", priceInr: 45, productId: "topup-zepto-bread" },
  ],
  bigbasket: [
    { name: "Fresho Farm Eggs 6pcs", priceInr: 48, productId: "topup-bb-eggs" },
    { name: "Nandini GoodLife Milk 500ml", priceInr: 30, productId: "topup-bb-milk" },
    { name: "BB Royal Whole Wheat Atta 1kg", priceInr: 65, productId: "topup-bb-atta" },
  ],
};

interface MinCartBannerProps {
  merchant: ShopMerchant;
  cartTotalInr: number;
  onContinueShopping?: () => void;
}

export function MinCartBanner({ merchant, cartTotalInr, onContinueShopping }: MinCartBannerProps) {
  const { addItem } = useCart();
  if (merchant === "district") return null;
  const minRequired = MARKETPLACE_MIN_VALUES[merchant] ?? 150;
  const shortfall = Math.max(0, minRequired - cartTotalInr);
  const isSatisfied = shortfall === 0;

  if (isSatisfied) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-allow/30 bg-allow/10 px-4 py-2.5 text-xs text-allow">
        <div className="flex items-center gap-2 font-medium">
          <ShoppingBag className="size-4 shrink-0" />
          Minimum order value of ₹{minRequired} satisfied for {MERCHANT_LABEL[merchant]}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-orange-500" strokeWidth={2} />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">
            Your cart total is below the minimum order value required by this marketplace.
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {MERCHANT_LABEL[merchant]} requires a minimum cart total of{" "}
            <strong className="font-mono text-foreground">₹{minRequired}</strong>. You are currently{" "}
            <strong className="font-mono text-orange-600 dark:text-orange-400">₹{shortfall} short</strong> (Current total: ₹{cartTotalInr}).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-orange-500/20">
        <span className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
          Suggested top-ups from {MERCHANT_LABEL[merchant]}:
        </span>
        {STAPLE_TOPUPS[merchant].map((topup) => (
          <Button
            key={topup.productId}
            size="sm"
            variant="outline"
            onClick={() =>
              addItem(topup.productId, merchant, {
                name: topup.name,
                priceInr: topup.priceInr,
              })
            }
            className="h-7 text-xs gap-1 border-orange-500/30 hover:bg-orange-500/10"
          >
            <Plus className="size-3 text-orange-500" />
            {topup.name} (+₹{topup.priceInr})
          </Button>
        ))}

        {onContinueShopping && (
          <Button size="sm" variant="ghost" onClick={onContinueShopping} className="h-7 text-xs ml-auto">
            Continue shopping
          </Button>
        )}
      </div>
    </div>
  );
}
