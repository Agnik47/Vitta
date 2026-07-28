'use client';

import { useEffect, useState } from 'react';
import type { Receipt } from '@/lib/types';
import type { ChainVerification } from '@/lib/read';
import { ReceiptCard } from '@/components/ReceiptCard';

interface ReceiptEntry {
  receipt: Receipt;
  verification: ChainVerification | null;
}

const POLL_INTERVAL_MS = 2000;

export default function ReceiptsPage() {
  const [entries, setEntries] = useState<ReceiptEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const res = await fetch('/api/receipts');
      const data: ReceiptEntry[] = await res.json();
      if (!cancelled) setEntries(data);
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Receipts</h1>
      {entries.length === 0 ? (
        <p className="text-zinc-500">No receipts yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map(({ receipt, verification }) => (
            <ReceiptCard key={receipt.receipt_id} receipt={receipt} verification={verification} />
          ))}
        </div>
      )}
    </div>
  );
}
