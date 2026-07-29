import { PageHeader } from "@/components/layout/page-header";
import { ConceptPreviewBadge } from "@/components/shared/concept-preview-badge";
import { MarketplaceComparisonTable } from "@/components/concept/marketplace-comparison-table";

export default function ComparePage() {
  return (
    <div>
      <PageHeader
        title="Marketplace comparison"
        description="Blinkit, Zepto, BigBasket, and Instamart side by side — final checkout cost, not just listed price."
        action={<ConceptPreviewBadge />}
      />

      <MarketplaceComparisonTable />

      <p className="mt-4 max-w-2xl text-xs text-ink-faint">
        Sample data for one illustrative product — no live price-scraping exists in this build. Blinkit&apos;s
        final cost above (₹476) matches the real order this project actually placed and receipted — see{" "}
        <a href="/receipts" className="underline decoration-border underline-offset-2 hover:decoration-foreground">
          Receipts
        </a>
        . A rule like &ldquo;never pay more than ₹500 for this item&rdquo; is what becomes a real signed mandate —
        see{" "}
        <a href="/concept/rules" className="underline decoration-border underline-offset-2 hover:decoration-foreground">
          Rule builder
        </a>
        .
      </p>
    </div>
  );
}
