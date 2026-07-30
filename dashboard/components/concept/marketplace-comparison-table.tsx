import { Award, CheckCircle, Clock, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface MerchantQuote {
  merchant: string;
  listedInr: number;
  deliveryInr: number;
  platformInr: number;
  discountInr: number;
  etaMinutes: number;
  /** Blinkit's ₹476 is a real receipt anchor — explicitly flagged. */
  isReal?: boolean;
}

// Sample data — NOT live-scraped. One real anchor: Blinkit ₹476 matches
// the actual Beats 5-8 receipt. Other figures are representative.
const QUOTES: MerchantQuote[] = [
  {
    merchant: "Blinkit",
    listedInr: 460,
    deliveryInr: 25,
    platformInr: 9,
    discountInr: 18,
    etaMinutes: 14,
    isReal: true,
  },
  {
    merchant: "Zepto",
    listedInr: 468,
    deliveryInr: 0,
    platformInr: 12,
    discountInr: 10,
    etaMinutes: 17,
  },
  {
    merchant: "BigBasket",
    listedInr: 452,
    deliveryInr: 40,
    platformInr: 0,
    discountInr: 0,
    etaMinutes: 45,
  },
  {
    merchant: "Instamart",
    listedInr: 465,
    deliveryInr: 19,
    platformInr: 15,
    discountInr: 25,
    etaMinutes: 12,
  },
];

function finalCost(q: MerchantQuote): number {
  return q.listedInr + q.deliveryInr + q.platformInr - q.discountInr;
}

function money(inr: number, sign = false): string {
  const prefix = sign && inr > 0 ? "+" : sign && inr < 0 ? "−" : "";
  return `${prefix}₹${Math.abs(inr).toLocaleString("en-IN")}`;
}

/** One row in the breakdown list. */
function BreakdownRow({
  label,
  value,
  sub,
  positive,
  negative,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          positive && "text-allow",
          negative && "text-deny"
        )}
      >
        {value}
        {sub && <span className="ml-1 text-xs text-muted-foreground">{sub}</span>}
      </span>
    </div>
  );
}

function MerchantCard({
  quote,
  isCheapest,
}: {
  quote: MerchantQuote;
  isCheapest: boolean;
}) {
  const total = finalCost(quote);

  return (
    <div
      className={cn(
        // Base card — sharp corners, hairline border, no shadow
        "flex flex-col rounded-none border bg-card transition-colors duration-250",
        isCheapest
          ? "border-seal"
          : "border-border"
      )}
    >
      {/* ── Merchant header ── */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isCheapest ? "border-seal/30 bg-seal/5" : "border-border"
        )}
      >
        <span className="font-heading text-base font-semibold text-foreground">
          {quote.merchant}
        </span>

        <div className="flex items-center gap-1.5">
          {isCheapest && (
            <span className="inline-flex items-center gap-1 border border-seal/50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-seal uppercase">
              <Award className="size-3" strokeWidth={2.25} />
              Best value
            </span>
          )}
          {quote.isReal && (
            <a
              href="/receipts"
              className="inline-flex items-center gap-1 border border-allow/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-allow uppercase hover:border-allow transition-colors duration-200"
              title="This order was actually placed — see Receipts"
            >
              <CheckCircle className="size-3" strokeWidth={2.25} />
              Real order
            </a>
          )}
        </div>
      </div>

      {/* ── Price breakdown ── */}
      <div className="flex-1 px-4 divide-y divide-border">
        <BreakdownRow label="Listed price" value={money(quote.listedInr)} />
        <BreakdownRow
          label="Delivery"
          value={quote.deliveryInr === 0 ? "Free" : money(quote.deliveryInr)}
          positive={quote.deliveryInr === 0}
        />
        <BreakdownRow
          label="Platform fee"
          value={quote.platformInr === 0 ? "—" : money(quote.platformInr)}
        />
        {quote.discountInr > 0 && (
          <BreakdownRow
            label="Discount"
            value={`−${money(quote.discountInr)}`}
            positive
          />
        )}
      </div>

      {/* ── Final checkout ── */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-t",
          isCheapest ? "border-seal/30" : "border-border"
        )}
      >
        <div>
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">
            Final checkout
          </div>
          <div
            className={cn(
              "font-heading text-2xl font-semibold tabular-nums leading-none mt-0.5",
              isCheapest ? "text-seal" : "text-foreground"
            )}
          >
            ₹{total.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" strokeWidth={1.75} />
          {quote.etaMinutes} min
        </div>
      </div>
    </div>
  );
}

export function MarketplaceComparisonTable() {
  const cheapest = QUOTES.reduce(
    (best, q) => (finalCost(q) < finalCost(best) ? q : best),
    QUOTES[0]
  );

  return (
    <div>
      {/* ── Product identity strip ── */}
      <div className="mb-5 flex items-center gap-3 rounded-none border border-border bg-card px-4 py-3">
        <Package className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <div className="text-sm font-medium text-foreground">
            Aashirvaad Shudh Chakki Atta 5 kg × 2
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            Comparing final checkout cost across 4 quick-commerce platforms
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-ink-faint">
          <Truck className="size-3.5" strokeWidth={1.5} />
          Same-day delivery
        </div>
      </div>

      {/* ── Merchant card grid ── */}
      <div className="grid grid-cols-1 gap-0 border border-border sm:grid-cols-2 lg:grid-cols-4">
        {QUOTES.map((q) => (
          <MerchantCard
            key={q.merchant}
            quote={q}
            isCheapest={q.merchant === cheapest.merchant}
          />
        ))}
      </div>

      {/* ── Mandate gate note ── */}
      <div className="mt-4 rounded-none border border-dashed border-seal/30 bg-seal/5 px-4 py-3">
        <div className="text-[11px] font-medium tracking-wider text-seal uppercase mb-1">
          Mandate gate context
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          In a real run, the agent compares final checkout costs (not listed prices) and submits the lowest to
          the policy engine. The mandate&apos;s per-transaction cap gates whether that amount is allowed —
          e.g., a ₹500 cap would permit Zepto&apos;s ₹470 but deny BigBasket&apos;s ₹492.{" "}
          <a
            href="/concept/rules"
            className="text-seal underline decoration-seal/40 underline-offset-2 hover:decoration-seal transition-colors"
          >
            Create a rule →
          </a>
        </p>
      </div>
    </div>
  );
}
