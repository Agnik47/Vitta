const BRAND_NAMES: Record<string, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  bigbasket: "BigBasket",
  district: "District",
};

function label(merchant: string): string {
  return BRAND_NAMES[merchant] ?? merchant.charAt(0).toUpperCase() + merchant.slice(1);
}

/** Ink-outlined, not a filled color pill — see DESIGN.md § Component Rules. */
export function MerchantChip({ merchant }: { merchant: string }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-xs font-medium text-foreground">
      {label(merchant)}
    </span>
  );
}
