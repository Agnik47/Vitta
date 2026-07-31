const BRAND_NAMES: Record<string, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  bigbasket: "BigBasket",
  district: "District",
};

function label(merchant: string): string {
  return BRAND_NAMES[merchant] ?? merchant.charAt(0).toUpperCase() + merchant.slice(1);
}

/** Rounded-full pill — matches the docs design system. */
export function MerchantChip({ merchant }: { merchant: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors duration-150">
      {label(merchant)}
    </span>
  );
}
