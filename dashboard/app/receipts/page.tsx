"use client";

import type { Receipt } from "@/lib/types";
import type { ChainVerification } from "@/lib/read";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptChain } from "@/components/receipts/receipt-chain";
import { FundingReceiptCard, type FundingEntry } from "@/components/receipts/funding-receipt-card";
import { usePolledFetch } from "@/hooks/use-polling";

interface ReceiptEntry {
  receipt: Receipt;
  verification: ChainVerification | null;
}

const POLL_INTERVAL_MS = 2000;

export default function ReceiptsPage() {
  const { data } = usePolledFetch<ReceiptEntry[]>("/api/receipts", POLL_INTERVAL_MS);
  const { data: funding } = usePolledFetch<FundingEntry[]>("/api/receipts/funding", POLL_INTERVAL_MS);
  const fundingEntries = funding ?? [];

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Signed proof of every payment: money in (a Razorpay test payment funding a mandate) and every allowed spend, hash-chained — tamper with one and the next link breaks."
      />

      {fundingEntries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Funding — money in</h2>
          <div className="flex flex-col gap-4">
            {fundingEntries.map((entry) => (
              <FundingReceiptCard key={entry.receipt.funding_receipt_id} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {fundingEntries.length > 0 && (data?.length ?? 0) > 0 && (
        <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Spends — money out</h2>
      )}
      {/* The empty state only shows when there is nothing of either kind */}
      {(fundingEntries.length === 0 || (data?.length ?? 0) > 0) && <ReceiptChain entries={data ?? []} />}
    </div>
  );
}
