'use client';

import { useEffect, useState } from 'react';
import type { Mandate } from '@/lib/types';
import { ReserveBalanceCard } from '@/components/ReserveBalanceCard';

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;

export default function MandateSummaryPage() {
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [balance, setBalance] = useState<Balance>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/mandate')
      .then((r) => r.json())
      .then((data) => {
        setMandate(data.mandate);
        setBalance(data.balance);
        setLoaded(true);
      });
  }, []);

  if (!loaded) return <p className="text-zinc-500">Loading…</p>;

  if (!mandate) {
    return <p className="text-zinc-500">No mandate created yet. Run `gate mandate create` from the CLI.</p>;
  }

  const expiresAt = new Date(mandate.scope.expires_at);
  const msLeft = expiresAt.getTime() - Date.now();
  const expiryLabel =
    msLeft <= 0 ? 'expired' : `${Math.floor(msLeft / 60000)}m ${Math.floor((msLeft % 60000) / 1000)}s left`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Current mandate</h1>
        <p className="font-mono text-sm text-zinc-500">{mandate.mandate_id}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Subject</dt>
        <dd>{mandate.subject}</dd>
        <dt className="text-zinc-500">Merchants in scope</dt>
        <dd>{mandate.scope.merchants.join(', ')}</dd>
        <dt className="text-zinc-500">Per-transaction cap</dt>
        <dd>₹{mandate.scope.per_txn_inr}</dd>
        <dt className="text-zinc-500">Total cap</dt>
        <dd>₹{mandate.scope.cap_inr}</dd>
        <dt className="text-zinc-500">Max transactions</dt>
        <dd>{mandate.scope.max_txns}</dd>
        <dt className="text-zinc-500">Expiry</dt>
        <dd>
          {expiresAt.toLocaleString()} ({expiryLabel})
        </dd>
      </dl>

      <ReserveBalanceCard balance={balance} />
    </div>
  );
}
