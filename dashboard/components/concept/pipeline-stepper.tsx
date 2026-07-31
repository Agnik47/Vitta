import type { LucideIcon } from "lucide-react";
import { CircleCheck, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageData {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  real: boolean;
}

function StageTag({ real }: { real: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        real ? "border-allow/40 bg-allow/10 text-allow" : "border-dashed border-ink-faint/60 text-ink-faint"
      )}
    >
      {real ? <CircleCheck className="size-2.5" strokeWidth={2.5} /> : <FlaskConical className="size-2.5" strokeWidth={2.5} />}
      {real ? "Real" : "Sample"}
    </span>
  );
}

/**
 * Structural time-flow connector — deliberately uniform and solid throughout,
 * unlike receipts/receipt-chain.tsx's connector, which breaks color/style to
 * signal a tamper event. Reusing that "breaking" language here for a plain
 * sequence would dilute the one place it's supposed to mean something.
 */
export function PipelineStepper({ stages }: { stages: StageData[] }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-0">
      {stages.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex items-start sm:flex-1">
            <div className="flex min-w-0 flex-1 flex-col items-start sm:items-center sm:text-center">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2",
                  stage.real ? "border-allow/50 bg-allow/10" : "border-dashed border-ink-faint/50 bg-secondary/50"
                )}
              >
                <Icon className={cn("size-4", stage.real ? "text-allow" : "text-ink-faint")} strokeWidth={1.75} />
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{stage.label}</div>
              <div className="mt-0.5 line-clamp-2 max-w-[9rem] text-xs text-muted-foreground">{stage.value}</div>
              <div className="mt-1.5">
                <StageTag real={stage.real} />
              </div>
            </div>

            {i < stages.length - 1 ? (
              <div className="mt-[18px] hidden h-px flex-1 bg-border sm:block" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
