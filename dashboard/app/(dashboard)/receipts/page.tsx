"use client";

import type { Receipt } from "@/lib/types";
import type { ChainVerification } from "@/lib/read";
import { PageHeader } from "@/components/layout/page-header";
import { ReceiptChain } from "@/components/receipts/receipt-chain";
import { usePolledFetch } from "@/hooks/use-polling";

interface ReceiptEntry {
  receipt: Receipt;
  verification: ChainVerification | null;
}

const POLL_INTERVAL_MS = 2000;

export default function ReceiptsPage() {
  const { data } = usePolledFetch<ReceiptEntry[]>("/api/receipts", POLL_INTERVAL_MS);

  return (
    <div>
      <PageHeader
        title="Receipts"
        description="Signed, hash-chained proof of every allowed spend — tamper with one and the next link breaks."
      />
      <ReceiptChain entries={data ?? []} />
    </div>
  );
}
