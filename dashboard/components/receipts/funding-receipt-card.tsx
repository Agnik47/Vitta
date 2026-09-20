import { BadgeCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { FundingReceipt } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FundingEntry {
  receipt: FundingReceipt;
  /** null = no gate key on this machine yet, so the signature cannot be checked here. */
  signature_valid: boolean | null;
}

function status(valid: boolean | null) {
  if (valid === false) return { label: "Tampered", icon: ShieldAlert, className: "border-deny/30 bg-deny/5 text-deny" };
  if (valid === true) return { label: "Verified", icon: BadgeCheck, className: "border-allow/30 bg-allow/5 text-allow" };
  return { label: "Signature pending", icon: ShieldQuestion, className: "border-step-up/30 bg-step-up/5 text-step-up" };
}

/** The receipt for money going INTO a mandate's reserve: a Razorpay test payment, verified by the gate
 *  from Razorpay's own records. Distinct from the spend chain below it — a top-up is not a spend. */
export function FundingReceiptCard({ entry }: { entry: FundingEntry }) {
  const { receipt } = entry;
  const s = status(entry.signature_valid);
  const Icon = s.icon;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <code className="font-mono text-sm font-medium text-foreground">{receipt.funding_receipt_id}</code>
        <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold", s.className)}>
          <Icon className="size-3.5" strokeWidth={2.25} />
          {s.label}
        </span>
      </div>

      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <div className="mb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Reserve funded</div>
          <div className="mt-0.5 font-heading text-[34px] leading-none font-bold tabular-nums text-foreground">
            ₹{receipt.amount_inr.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mode</div>
          <div className="mt-0.5 text-sm font-semibold text-allow">🟢 Razorpay TEST</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border px-5 py-4">
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mandate</div>
          <code className="block truncate font-mono text-xs text-foreground">{receipt.mandate_id}</code>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Issued</div>
          <div className="text-sm text-foreground">{new Date(receipt.issued_at).toLocaleString()}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Razorpay order</div>
          <code className="block truncate font-mono text-xs text-foreground">{receipt.order_id}</code>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {receipt.payments.length === 1 ? "Payment" : "Payments"}
          </div>
          {receipt.payments.map((p) => (
            <div key={p.id} className="truncate font-mono text-xs text-foreground">
              {p.id} · <span className="uppercase">{p.method}</span> · ₹{p.amount_inr.toLocaleString("en-IN")}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-surface-sunken px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="shrink-0 text-[10px] tracking-widest text-ink-faint uppercase">Ed25519 sig</div>
          <code className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{receipt.sig.slice(0, 40)}…</code>
        </div>
      </div>
    </div>
  );
}
