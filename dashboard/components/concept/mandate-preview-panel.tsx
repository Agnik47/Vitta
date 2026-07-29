import { FlaskConical } from "lucide-react";
import { MerchantChip } from "@/components/mandate/merchant-chip";

export interface RulePreview {
  product: string;
  targetPriceInr: number;
  maxBudgetInr: number;
  merchants: string[];
  expiresAtLabel: string;
  purchaseLimit: number;
  autoBuy: boolean;
}

/**
 * Deliberately dashed border (real panels use a solid hairline, see
 * shared/panel.tsx) — the same visual grammar as TestModeBadge/
 * ConceptPreviewBadge's dashed treatment, so "this is illustrative" is
 * legible from shape alone, not just the banner text. Field layout echoes
 * mandate/mandate-hero.tsx on purpose: this is what that panel would show
 * if `gate mandate create` ran with these inputs.
 */
export function MandatePreviewPanel({ preview }: { preview: RulePreview }) {
  return (
    <div className="rounded-md border border-dashed border-step-up/50 bg-card px-5 py-5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-step-up uppercase">
        <FlaskConical className="size-3.5" strokeWidth={2} />
        Preview only — no mandate created
      </div>

      <div className="mt-3 text-[11px] tracking-wide text-ink-faint uppercase">Would-be spending cap</div>
      <div className="font-heading text-[32px] leading-none font-medium tabular-nums text-foreground">
        ₹{preview.maxBudgetInr.toLocaleString("en-IN")}
      </div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">for &ldquo;{preview.product}&rdquo;</div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {preview.merchants.length > 0 ? (
          preview.merchants.map((m) => <MerchantChip key={m} merchant={m} />)
        ) : (
          <span className="text-xs text-ink-faint">No merchants selected</span>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-faint">Target price</dt>
          <dd className="mt-0.5 font-mono tabular-nums">₹{preview.targetPriceInr.toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Purchase limit</dt>
          <dd className="mt-0.5 font-mono tabular-nums">{preview.purchaseLimit}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Expires</dt>
          <dd className="mt-0.5">{preview.expiresAtLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">Fulfilment</dt>
          <dd className="mt-0.5">{preview.autoBuy ? "Auto-buy" : "Manual review"}</dd>
        </div>
      </dl>

      <p className="mt-5 border-t border-border pt-4 text-xs text-ink-faint">
        A real mandate is Ed25519-signed by a human and only ever created from the CLI — run{" "}
        <code className="font-mono text-foreground">gate mandate create</code> to make one for real. This preview
        never leaves your browser.
      </p>
    </div>
  );
}
