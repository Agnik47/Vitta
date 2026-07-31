import { CircleCheck, CircleX, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const VERDICT_STYLE = {
  ALLOW: { icon: CircleCheck, className: "border-allow/30 bg-allow/10 text-allow" },
  DENY: { icon: CircleX, className: "border-deny/30 bg-deny/10 text-deny" },
  STEP_UP: { icon: ArrowUpRight, className: "border-step-up/30 bg-step-up/10 text-step-up" },
} as const;

/**
 * Icon + text + color, always together — never color alone. See
 * DESIGN.md § Accessibility Notes.
 */
export function VerdictBadge({ verdict }: { verdict: "ALLOW" | "DENY" | "STEP_UP" }) {
  const { icon: Icon, className } = VERDICT_STYLE[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        className
      )}
    >
      <Icon className="size-3" strokeWidth={2.25} />
      {verdict.replace("_", "-")}
    </span>
  );
}
