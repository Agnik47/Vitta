import type { LucideIcon } from "lucide-react";

/**
 * One line of text, no illustration, no emoji — see DESIGN.md § Component
 * Rules. This audience wants to know what to do next, not be delighted.
 */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 py-12 text-center">
      <Icon className="size-5 text-ink-faint" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">{title}</p>
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
