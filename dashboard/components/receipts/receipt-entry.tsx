import { BadgeCheck, Link2Off, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { Receipt } from "@/lib/types";
import type { ChainVerification } from "@/lib/read";
import { Panel } from "@/components/shared/panel";
import { cn } from "@/lib/utils";

const DENY_STYLE = "border-deny/30 bg-deny/10 text-deny";
const ALLOW_STYLE = "border-allow/30 bg-allow/10 text-allow";
const STEP_UP_STYLE = "border-step-up/30 bg-step-up/10 text-step-up";

/**
 * Deliberately keeps these two failure modes distinct rather than collapsing
 * both into one "invalid" badge — this receipt's OWN signature being wrong
 * (it was directly edited) is a different fact from it being unable to prove
 * continuity from its predecessor (the predecessor was edited instead). This
 * is the exact distinction docs/05-DEMO-SCRIPT.md Beat 7 demonstrates: tamper
 * one receipt and the *next* receipt's chain link breaks, not just the
 * tampered one's own signature.
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
  // signature_valid is null/undefined — gate public key not yet available, see
  // docs/agent-b/WORKSPACE.md. Chain-link validity needs no key and is still real.
  return chainValid
    ? { label: "Chain valid · signature pending", icon: ShieldQuestion, className: STEP_UP_STYLE }
    : { label: "Chain broken", icon: Link2Off, className: DENY_STYLE };
}

export function ReceiptEntry({ receipt, verification }: { receipt: Receipt; verification: ChainVerification | null }) {
  const status = overallStatus(verification);
  const Icon = status.icon;

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium">{receipt.receipt_id}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
            status.className
          )}
        >
          <Icon className="size-3" strokeWidth={2.25} />
          {status.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-ink-faint">Merchant</dt>
          <dd className="mt-0.5">{receipt.cart.merchant}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Total</dt>
          <dd className="mt-0.5 font-mono tabular-nums">₹{receipt.cart.total_inr.toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Run ID</dt>
          <dd className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{receipt.execution.run_id}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Signed at</dt>
          <dd className="mt-0.5">{new Date(receipt.signed_at).toLocaleString()}</dd>
        </div>
      </dl>
    </Panel>
  );
}
