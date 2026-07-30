import { BadgeCheck, Link2Off, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { Receipt } from "@/lib/types";
import type { ChainVerification } from "@/lib/read";
import { cn } from "@/lib/utils";

const DENY_STYLE = "border-deny/30 bg-deny/5 text-deny";
const ALLOW_STYLE = "border-allow/30 bg-allow/5 text-allow";
const STEP_UP_STYLE = "border-step-up/30 bg-step-up/5 text-step-up";

/**
 * Deliberately keeps these two failure modes distinct:
 * — Own signature invalid = the receipt itself was edited (tampered)
 * — Chain link invalid = the predecessor was edited (chain broken)
 * See docs/05-DEMO-SCRIPT.md Beat 7 and DESIGN.md § Motion.
 */
function overallStatus(verification: ChainVerification | null) {
  const chainValid = verification?.chain_link_valid ?? false;
  const sigValid = verification?.signature_valid;

  if (sigValid === false) {
    return { label: "Tampered", icon: ShieldAlert, className: DENY_STYLE };
  }
  if (sigValid === true && chainValid) {
    return { label: "Verified", icon: BadgeCheck, className: ALLOW_STYLE };
  }
  if (sigValid === true && !chainValid) {
    return { label: "Chain broken", icon: Link2Off, className: DENY_STYLE };
  }
  return chainValid
    ? { label: "Chain valid · sig pending", icon: ShieldQuestion, className: STEP_UP_STYLE }
    : { label: "Chain broken", icon: Link2Off, className: DENY_STYLE };
}

function Field({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] tracking-widest text-ink-faint uppercase mb-0.5">{label}</div>
      <div className={cn("text-sm text-foreground", mono && "font-mono text-xs")}>{children}</div>
    </div>
  );
}

export function ReceiptEntry({
  receipt,
  verification,
}: {
  receipt: Receipt;
  verification: ChainVerification | null;
}) {
  const status = overallStatus(verification);
  const Icon = status.icon;
  const isVerified = status.label === "Verified";

  return (
    <div className="border border-border bg-card">
      {/* ── Header row ── */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isVerified ? "border-border" : "border-deny/20"
        )}
      >
        <code className="font-mono text-sm font-medium text-foreground">{receipt.receipt_id}</code>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-medium",
            status.className
          )}
        >
          <Icon className="size-3.5" strokeWidth={2.25} />
          {status.label}
        </span>
      </div>

      {/* ── Amount hero ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Amount paid</div>
          <div className="font-heading text-[32px] font-semibold tabular-nums leading-none text-foreground mt-0.5">
            ₹{receipt.cart.total_inr.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase">Merchant</div>
          <div className="mt-0.5 text-sm font-medium text-foreground capitalize">{receipt.cart.merchant}</div>
        </div>
      </div>

      {/* ── Fields grid ── */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 border-t border-border mt-2">
        <Field label="Run ID" mono>
          <span className="truncate block">{receipt.execution.run_id}</span>
        </Field>
        <Field label="Signed at">
          {new Date(receipt.signed_at).toLocaleString()}
        </Field>
        <Field label="Items">{receipt.cart.items}</Field>
        <Field label="Payment rail">
          <span className="uppercase">{receipt.payment.rail}</span>
          {" · "}
          <span className="capitalize">{receipt.payment.status}</span>
        </Field>
      </div>

      {/* ── Signature strip ── */}
      <div className="border-t border-border bg-surface-sunken px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="text-[10px] tracking-widest text-ink-faint uppercase shrink-0">Ed25519 sig</div>
          <code className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
            {receipt.sig.slice(0, 40)}…
          </code>
        </div>
      </div>
    </div>
  );
}
