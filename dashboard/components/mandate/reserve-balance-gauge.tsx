type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;

/**
 * Reserve remaining against the mandate's own cap — real Dodo balance, real
 * cap, a straight linear fill rather than a shadow-heavy stat card. Replaces
 * the old ReserveBalanceCard. See DESIGN.md § Page-by-page.
 */
export function ReserveBalanceGauge({ balance, capInr }: { balance: Balance; capInr?: number }) {
  if (balance == null) {
    return (
      <div>
        <div className="text-[11px] tracking-wide text-ink-faint uppercase">Reserve balance</div>
        <div className="mt-1 text-sm text-muted-foreground">No mandate funded yet</div>
      </div>
    );
  }

  if (!balance.available) {
    return (
      <div>
        <div className="text-[11px] tracking-wide text-ink-faint uppercase">Reserve balance</div>
        <div className="mt-1 text-sm text-muted-foreground">Unavailable — {balance.reason}</div>
      </div>
    );
  }

  const fraction = capInr && capInr > 0 ? Math.max(0, Math.min(1, balance.balanceInr / capInr)) : 1;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] tracking-wide text-ink-faint uppercase">Reserve balance (Dodo, test mode)</span>
        {capInr ? (
          <span className="font-mono text-[11px] tabular-nums text-ink-faint">of ₹{capInr.toLocaleString("en-IN")} cap</span>
        ) : null}
      </div>
      <div className="mt-1 font-heading text-2xl font-medium tabular-nums text-foreground">
        ₹{balance.balanceInr.toLocaleString("en-IN")}
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-seal transition-[width] duration-500 ease-out"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}
