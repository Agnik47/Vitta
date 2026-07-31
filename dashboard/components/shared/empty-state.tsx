import type { LucideIcon } from "lucide-react";

/**
 * One line of text, no illustration, no emoji — see DESIGN.md § Component
 * Rules. This audience wants to know what to do next, not be delighted.
 */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center bg-muted/10">
      <Icon className="size-6 text-ink-faint" strokeWidth={1.5} />
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {hint ? <p className="mt-1 text-[13px] text-ink-faint">{hint}</p> : null}
      </div>
    </div>
  );
}
