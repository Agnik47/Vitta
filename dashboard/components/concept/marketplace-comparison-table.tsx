import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface MerchantQuote {
  merchant: string;
  listedInr: number;
  deliveryInr: number;
  platformInr: number;
  discountInr: number;
  etaMinutes: number;
}

// Sample data for one illustrative product — NOT live-scraped, no such feature
// exists yet (see PRODUCT_FEATURE.md's "Marketplace Comparison" section). One
// real anchor deliberately kept in: Blinkit's final cost below (₹476) matches
// the actual receipt from this build's real Beats 5-8 rehearsal (see
// /receipts) — the other three merchants' figures are representative,
// hand-picked to show a realistic, non-rigged spread, not derived from any
// live source.
const QUOTES: MerchantQuote[] = [
  { merchant: "Blinkit", listedInr: 460, deliveryInr: 25, platformInr: 9, discountInr: 18, etaMinutes: 14 },
  { merchant: "Zepto", listedInr: 468, deliveryInr: 0, platformInr: 12, discountInr: 10, etaMinutes: 17 },
  { merchant: "BigBasket", listedInr: 452, deliveryInr: 40, platformInr: 0, discountInr: 0, etaMinutes: 45 },
  { merchant: "Instamart", listedInr: 465, deliveryInr: 19, platformInr: 15, discountInr: 25, etaMinutes: 12 },
];

function finalCost(q: MerchantQuote): number {
  return q.listedInr + q.deliveryInr + q.platformInr - q.discountInr;
}

function money(inr: number): string {
  return `₹${inr.toLocaleString("en-IN")}`;
}

const ROWS: { label: string; render: (q: MerchantQuote) => string; emphasize?: boolean }[] = [
  { label: "Listed price", render: (q) => money(q.listedInr) },
  { label: "Delivery fee", render: (q) => (q.deliveryInr === 0 ? "Free" : money(q.deliveryInr)) },
  { label: "Platform fee", render: (q) => (q.platformInr === 0 ? "—" : money(q.platformInr)) },
  { label: "Discount / coupon", render: (q) => (q.discountInr === 0 ? "—" : `−${money(q.discountInr)}`) },
  { label: "Final checkout cost", render: (q) => money(finalCost(q)), emphasize: true },
  { label: "ETA", render: (q) => `${q.etaMinutes} min` },
];

export function MarketplaceComparisonTable() {
  const cheapest = QUOTES.reduce((best, q) => (finalCost(q) < finalCost(best) ? q : best), QUOTES[0]);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            <th className="w-40 px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase">
              Aashirvaad Atta 5kg ×2
            </th>
            {QUOTES.map((q) => (
              <th key={q.merchant} className="px-3 py-2.5 text-sm font-medium text-foreground">
                <div className="flex items-center gap-1.5">
                  {q.merchant}
                  {q.merchant === cheapest.merchant ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-seal/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-seal uppercase">
                      <Award className="size-3" strokeWidth={2.25} />
                      Best value
                    </span>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2.5 text-xs text-ink-faint">{row.label}</td>
              {QUOTES.map((q) => (
                <td
                  key={q.merchant}
                  className={cn(
                    "px-3 py-2.5 font-mono text-sm tabular-nums",
                    row.emphasize && "font-medium text-foreground",
                    row.emphasize && q.merchant === cheapest.merchant && "text-seal"
                  )}
                >
                  {row.render(q)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
