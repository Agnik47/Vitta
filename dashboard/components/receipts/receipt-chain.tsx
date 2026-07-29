import { Receipt as ReceiptIcon, Link2, Link2Off } from "lucide-react";
import type { Receipt } from "@/lib/types";
import type { ChainVerification } from "@/lib/read";
import { ReceiptEntry } from "@/components/receipts/receipt-entry";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

interface Entry {
  receipt: Receipt;
  verification: ChainVerification | null;
}

/**
 * The chain rendered as an actual chain: a connector between consecutive
 * receipts that visibly breaks — solid ink line → dashed deny-red — the
 * instant a tamper-test edit invalidates that link. This is a direct
 * visualization of a real state change, not decoration. See DESIGN.md
 * § Interaction & Motion.
 */
function Connector({ intact }: { intact: boolean }) {
  const Icon = intact ? Link2 : Link2Off;
  return (
    <div className="flex items-center gap-3 pl-6">
      <div
        className={cn(
          "h-6 w-px transition-colors duration-300",
          intact ? "border-l border-border" : "border-l border-dashed border-deny"
        )}
      />
      <Icon className={cn("size-3.5 transition-colors duration-300", intact ? "text-ink-faint" : "text-deny")} strokeWidth={2} />
    </div>
  );
}

export function ReceiptChain({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No receipts yet"
        hint="A receipt is written the moment `gate run` executes an allowed write."
      />
    );
  }

  return (
    <div className="flex flex-col">
      {entries.map((entry, idx) => (
        <div key={entry.receipt.receipt_id}>
          <ReceiptEntry receipt={entry.receipt} verification={entry.verification} />
          {idx < entries.length - 1 ? <Connector intact={entry.verification?.chain_link_valid ?? false} /> : null}
        </div>
      ))}
    </div>
  );
}
