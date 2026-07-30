import { KeyRound, Stamp } from "lucide-react";
import type { Mandate } from "@/lib/types";
import { Panel } from "@/components/shared/panel";
import { ExpiryRing } from "@/components/mandate/expiry-ring";
import { MerchantChip } from "@/components/mandate/merchant-chip";
import { ReserveBalanceGauge } from "@/components/mandate/reserve-balance-gauge";
import { cn } from "@/lib/utils";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;

function StatCell({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-r border-border last:border-r-0 px-4 first:pl-0 last:pr-0">
      <span className="text-[10px] tracking-widest text-ink-faint uppercase">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono tabular-nums")}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </span>
    </div>
  );
}

export function MandateHero({ mandate, balance }: { mandate: Mandate; balance: Balance }) {
  const sigTruncated = mandate.sig.slice(0, 24) + "…";
  const didTruncated = mandate.issuer.slice(0, 28) + "…";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Primary hero panel ── */}
      <Panel className="relative overflow-hidden">
        {/* Watermark seal */}
        <Stamp
          className="pointer-events-none absolute -top-6 -right-6 size-48 text-seal/[0.05]"
          strokeWidth={0.75}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: cap + identity */}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-ink-faint uppercase">Spending cap</div>
            <div className="font-heading text-[56px] leading-none font-semibold tabular-nums text-foreground mt-1">
              ₹{mandate.scope.cap_inr.toLocaleString("en-IN")}
            </div>

            {/* Consent sentence — the actual human-signed contract text */}
            <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
              Agent may spend up to{" "}
              <span className="font-medium text-foreground">
                ₹{mandate.scope.cap_inr.toLocaleString("en-IN")}
              </span>{" "}
              at{" "}
              <span className="font-medium text-foreground">
                {mandate.scope.merchants
                  .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                  .join(", ")}
              </span>
              , max ₹{mandate.scope.per_txn_inr.toLocaleString("en-IN")} per order,
              up to {mandate.scope.max_txns} transaction{mandate.scope.max_txns !== 1 ? "s" : ""}.
            </p>

            {/* Merchant chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {mandate.scope.merchants.map((m) => (
                <MerchantChip key={m} merchant={m} />
              ))}
            </div>
          </div>

          {/* Right: expiry ring */}
          <ExpiryRing expiresAt={mandate.scope.expires_at} />
        </div>

        {/* ── Stats strip ── */}
        <div className="mt-5 flex items-center border-t border-border pt-4">
          <StatCell label="Per-txn cap" value={`₹${mandate.scope.per_txn_inr.toLocaleString("en-IN")}`} mono />
          <StatCell label="Max transactions" value={mandate.scope.max_txns} mono />
          <StatCell label="Subject" value={mandate.subject} />
        </div>
      </Panel>

      {/* ── Reserve balance panel ── */}
      <Panel>
        <ReserveBalanceGauge balance={balance} capInr={mandate.scope.cap_inr} />
      </Panel>

      {/* ── Cryptographic proof panel ── */}
      <Panel className="bg-surface-sunken">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-seal" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-widest text-ink-faint uppercase mb-2">
              Ed25519 signature (verified)
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <div className="text-[10px] text-ink-faint mb-0.5">Mandate ID</div>
                <code className="block truncate font-mono text-xs text-foreground">
                  {mandate.mandate_id}
                </code>
              </div>
              <div>
                <div className="text-[10px] text-ink-faint mb-0.5">Issuer DID</div>
                <code className="block truncate font-mono text-xs text-foreground">
                  {didTruncated}
                </code>
              </div>
              <div>
                <div className="text-[10px] text-ink-faint mb-0.5">Signature</div>
                <code className="block truncate font-mono text-xs text-muted-foreground">
                  {sigTruncated}
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 border border-allow/40 bg-allow/5 px-2 py-0.5 text-[10px] font-medium text-allow">
                  <span className="size-1.5 rounded-full bg-allow" />
                  Signature verified · canonical JSON
                </span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
