import { cn } from "@/lib/utils";

const BRAND_NAMES: Record<string, string> = {
  blinkit: "Blinkit",
  zepto: "Zepto",
  bigbasket: "BigBasket",
  district: "District",
};

/**
 * Interactive counterpart to mandate/merchant-chip.tsx's read-only display
 * chip — background/border-color shift only on toggle, no scale/translate,
 * per DESIGN.md § Interaction & Motion.
 */
export function MerchantToggle({
  merchant,
  selected,
  onToggle,
}: {
  merchant: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors",
        selected
          ? "border-seal/50 bg-seal/10 text-seal"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {BRAND_NAMES[merchant] ?? merchant}
    </button>
  );
}
