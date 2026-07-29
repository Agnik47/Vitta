import { Stamp } from "lucide-react";
import type { Mandate } from "@/lib/types";
import { Panel } from "@/components/shared/panel";
import { ExpiryRing } from "@/components/mandate/expiry-ring";
import { MerchantChip } from "@/components/mandate/merchant-chip";
import { ReserveBalanceGauge } from "@/components/mandate/reserve-balance-gauge";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;

export function MandateHero({ mandate, balance }: { mandate: Mandate; balance: Balance }) {
  return (
    <Panel className="relative overflow-hidden">
      <Stamp
        className="pointer-events-none absolute -top-6 -right-6 size-40 text-seal/[0.06]"
        strokeWidth={1}
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] tracking-wide text-ink-faint uppercase">Spending cap</div>
          <div className="font-heading text-[40px] leading-none font-medium tabular-nums text-foreground">
            ₹{mandate.scope.cap_inr.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{mandate.mandate_id}</div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {mandate.scope.merchants.map((m) => (
              <MerchantChip key={m} merchant={m} />
            ))}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-ink-faint">Subject</dt>
              <dd className="mt-0.5 truncate">{mandate.subject}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Per-transaction cap</dt>
              <dd className="mt-0.5 font-mono tabular-nums">₹{mandate.scope.per_txn_inr.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Max transactions</dt>
              <dd className="mt-0.5 font-mono tabular-nums">{mandate.scope.max_txns}</dd>
            </div>
          </dl>
        </div>

        <ExpiryRing expiresAt={mandate.scope.expires_at} />
      </div>

      <div className="relative border-t border-border pt-5">
        <ReserveBalanceGauge balance={balance} capInr={mandate.scope.cap_inr} />
      </div>
    </Panel>
  );
}
