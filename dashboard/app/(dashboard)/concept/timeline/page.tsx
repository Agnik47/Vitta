"use client";

import { Search, Columns3, ShoppingCart, ShieldCheck, Wallet, Receipt as ReceiptIcon } from "lucide-react";
import type { GateEvent, Receipt } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { ConceptPreviewBadge } from "@/components/shared/concept-preview-badge";
import { Panel } from "@/components/shared/panel";
import { PipelineStepper, type StageData } from "@/components/concept/pipeline-stepper";
import { CheckoutActivityChart, type ActivityBar } from "@/components/concept/checkout-activity-chart";
import { useIncrementalPoll, usePolledFetch } from "@/hooks/use-polling";

const POLL_INTERVAL_MS = 4000;

// Sample-only future projections — always appended after any real receipts,
// clearly labeled in the legend/tooltip/chip, never presented as measured
// data. Amounts are illustrative, not derived from any live source.
const SAMPLE_PROJECTIONS: ActivityBar[] = [
  { label: "Next order (est.)", amountInr: 310, kind: "sample" },
  { label: "In 2 weeks (est.)", amountInr: 275, kind: "sample" },
  { label: "In a month (est.)", amountInr: 430, kind: "sample" },
];

interface ReceiptEntry {
  receipt: Receipt;
  verification: unknown;
}

export default function TimelinePage() {
  const { items: events } = useIncrementalPoll<GateEvent>("/api/events", POLL_INTERVAL_MS);
  const { data: receiptEntries } = usePolledFetch<ReceiptEntry[]>("/api/receipts", POLL_INTERVAL_MS);

  const receipts = (receiptEntries ?? []).map((e) => e.receipt);
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestReceipt = receipts.length > 0 ? receipts[receipts.length - 1] : null;

  const stages: StageData[] = [
    { key: "search", label: "Search", value: "Chocolate Peanut Butter 1kg", icon: Search, real: false },
    { key: "compare", label: "Compare", value: "4 marketplaces checked", icon: Columns3, real: false },
    { key: "checkout", label: "Checkout", value: "Final cost calculated", icon: ShoppingCart, real: false },
    {
      key: "mandate",
      label: "Mandate approval",
      value: latestEvent ? `${latestEvent.verdict} · ${latestEvent.command}` : "Awaiting a real gate run",
      icon: ShieldCheck,
      real: latestEvent !== null,
    },
    {
      key: "payment",
      label: "Payment",
      value: latestReceipt ? `₹${latestReceipt.cart.total_inr.toLocaleString("en-IN")} captured` : "Awaiting a real receipt",
      icon: Wallet,
      real: latestReceipt !== null,
    },
    {
      key: "receipt",
      label: "Receipt",
      value: latestReceipt ? latestReceipt.receipt_id : "Awaiting a real receipt",
      icon: ReceiptIcon,
      real: latestReceipt !== null,
    },
  ];

  const realBars: ActivityBar[] = receipts.map((r) => ({
    label: new Date(r.signed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    amountInr: r.cart.total_inr,
    kind: "real",
  }));
  const chartData = [...realBars, ...SAMPLE_PROJECTIONS];

  return (
    <div>
      <PageHeader
        title="Activity timeline"
        description="Search → compare → checkout → mandate approval → payment → receipt, as one visual flow."
        action={<ConceptPreviewBadge />}
      />

      <Panel>
        <PipelineStepper stages={stages} />
      </Panel>

      <p className="mt-4 max-w-2xl text-xs text-ink-faint">
        Search, compare, and checkout-calculation are concept-only — no live price-monitoring exists in this build.
        Mandate approval, payment, and receipt light up with real data (from{" "}
        <a href="/events" className="underline decoration-border underline-offset-2 hover:decoration-foreground">
          Events
        </a>{" "}
        and{" "}
        <a href="/receipts" className="underline decoration-border underline-offset-2 hover:decoration-foreground">
          Receipts
        </a>
        ) the moment a real <code className="font-mono text-foreground">gate run</code> produces it on this machine.
      </p>

      <div className="mt-8">
        <h2 className="font-heading text-lg font-medium text-foreground">Checkout activity</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          {realBars.length > 0
            ? `${realBars.length} real receipt${realBars.length === 1 ? "" : "s"} on this machine, plus sample projections.`
            : "0 real receipts on this machine yet — showing sample projections only."}
        </p>
        <Panel>
          <CheckoutActivityChart data={chartData} />
        </Panel>
      </div>
    </div>
  );
}
