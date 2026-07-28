interface Props {
  balance: { available: true; balanceInr: number } | { available: false; reason: string } | null;
}

export function ReserveBalanceCard({ balance }: Props) {
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Live reserve balance (Dodo, test mode)</div>
      {balance == null ? (
        <div className="mt-1 text-lg text-zinc-500">No mandate funded yet</div>
      ) : balance.available ? (
        <div className="mt-1 text-2xl font-semibold">₹{balance.balanceInr.toLocaleString('en-IN')}</div>
      ) : (
        <div className="mt-1 text-sm text-zinc-500">Unavailable — {balance.reason}</div>
      )}
    </div>
  );
}
