import { Panel } from "@/components/shared/panel";
import { MerchantOfferRow } from "@/components/shop/merchant-offer-row";
import { cheapestOffer, type ShopProduct } from "@/lib/shop-catalog";

export function ProductCompareCard({ product }: { product: ShopProduct }) {
  const cheapest = cheapestOffer(product);

  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border bg-surface-sunken px-4 py-3">
        <div>
          <div className="font-heading text-base font-medium text-foreground">{product.name}</div>
          <div className="text-xs text-muted-foreground">
            {product.brand} · {product.variant}
          </div>
        </div>
        <span className="text-[10px] tracking-widest text-ink-faint uppercase">{product.category}</span>
      </div>

      <div>
        {product.offers.map((offer) => (
          <MerchantOfferRow
            key={offer.merchant}
            productId={product.id}
            offer={offer}
            isCheapest={offer.merchant === cheapest.merchant}
          />
        ))}
      </div>
    </Panel>
  );
}
