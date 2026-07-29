import { Stamp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The product's honesty requirement made visible: every real payment call in
 * this build targets Dodo's test-mode host, never live money. Styled as a
 * stamped seal (dashed rule, not a solid fill) rather than a leftover warning
 * banner — see dashboard/DESIGN.md § Layout System.
 */
export function TestModeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-dashed border-seal/50 px-2 py-1 text-[11px] font-medium tracking-wide text-seal uppercase",
        className
      )}
    >
      <Stamp className="size-3.5" strokeWidth={2} />
      Test mode — no real money moves here
    </span>
  );
}
