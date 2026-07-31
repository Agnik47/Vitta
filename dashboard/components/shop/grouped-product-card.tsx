"use client";

import { useState } from "react";
import { ImageOff, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart-context";
import { MERCHANT_LABEL, type ShopMerchant } from "@/lib/shop-catalog";
import type { LiveProduct } from "@/lib/live-search";
import { Button } from "@/components/ui/button";

// Re-using the same colors from live-search-results
const MERCHANT_BADGE: Record<string, string> = {
  blinkit: "bg-[#F8CB46]/15 text-[#8a6d00] border-[#F8CB46]/40",
  zepto: "bg-[#6C2BD9]/10 text-[#6C2BD9] border-[#6C2BD9]/30",
  bigbasket: "bg-[#84C225]/15 text-[#4d7a00] border-[#84C225]/40",
};

export interface GroupedProduct {
  key: string;
  name: string;
  imageUrl?: string;
  offers: LiveProduct[];
}

function ProductImage({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!imageUrl || broken) {
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={name}
      onError={() => setBroken(true)}
      className="aspect-square w-full bg-surface-sunken object-contain mix-blend-multiply"
      loading="lazy"
    />
  );
}

function OfferRow({ offer }: { offer: LiveProduct }) {
  const { addItem } = useCart();
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    setAdding(true);
    const result = await addItem(offer.productId, offer.merchant as ShopMerchant, {
      name: offer.name,
      priceInr: offer.priceInr,
      imageUrl: offer.imageUrl,
      url: offer.url,
    });
    setAdding(false);
    if (!result.ok) {
      toast.error("Could not add to real cart", { description: result.message });
      return;
    }
    toast.success(`Added to real ${MERCHANT_LABEL[offer.merchant]} cart`, {
      description: `${offer.name} — ₹${offer.priceInr.toLocaleString("en-IN")}`,
    });
  }

  const discount =
    offer.mrpInr && offer.mrpInr > offer.priceInr
      ? Math.round(((offer.mrpInr - offer.priceInr) / offer.mrpInr) * 100)
      : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${MERCHANT_BADGE[offer.merchant]}`}
          >
            {MERCHANT_LABEL[offer.merchant]}
          </span>
          {discount !== null && (
            <span className="rounded bg-allow px-1.5 py-0.5 text-[10px] font-bold text-white">
              {discount}% OFF
            </span>
          )}
        </div>
        {!offer.available && <span className="text-[10px] text-deny">{offer.availabilityLabel}</span>}
      </div>

      <div className="flex items-end justify-between gap-2 mt-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              ₹{offer.priceInr.toLocaleString("en-IN")}
            </span>
            {offer.mrpInr !== undefined && offer.mrpInr > offer.priceInr && (
              <span className="font-mono text-[11px] text-ink-faint line-through">
                ₹{offer.mrpInr.toLocaleString("en-IN")}
              </span>
            )}
          </div>
          {offer.url && (
            <a
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View on {MERCHANT_LABEL[offer.merchant]}
              <ExternalLink className="size-2.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 text-xs px-2.5"
          disabled={!offer.available || adding}
          onClick={handleAdd}
        >
          {adding ? <Loader2 className="size-3 animate-spin" /> : "Add"}
        </Button>
      </div>
    </div>
  );
}

export function GroupedProductCard({ group }: { group: GroupedProduct }) {
  // Sort offers by price ascending
  const sortedOffers = [...group.offers].sort((a, b) => a.priceInr - b.priceInr);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-sm">
      <div className="relative border-b border-border bg-white">
        <ProductImage imageUrl={group.imageUrl} name={group.name} />
      </div>

      <div className="flex flex-col p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-semibold text-foreground mb-3">
          {group.name}
        </div>

        <div className="flex flex-col gap-2">
          {sortedOffers.map((offer) => (
            <OfferRow key={`${offer.merchant}-${offer.productId}`} offer={offer} />
          ))}
        </div>
      </div>
    </div>
  );
}
