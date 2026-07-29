import type { GateEvent } from "@/lib/types";
import { VerdictBadge } from "@/components/events/verdict-badge";
import { cn } from "@/lib/utils";

const ROW_ACCENT = {
  ALLOW: "before:bg-allow",
  DENY: "before:bg-deny",
  STEP_UP: "before:bg-step-up",
} as const;

export function EventRow({ event }: { event: GateEvent }) {
  return (
    <tr
      className={cn(
        "relative border-b border-border transition-[opacity,transform] duration-300 ease-out",
        "starting:-translate-y-1 starting:opacity-0",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5",
        ROW_ACCENT[event.verdict]
      )}
    >
      <td className="py-2 pr-3 pl-3 text-xs whitespace-nowrap text-muted-foreground">
        {new Date(event.ts).toLocaleTimeString()}
      </td>
      <td className="px-3 py-2 font-mono text-sm">{event.command}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{event.access}</td>
      <td className="px-3 py-2">
        <VerdictBadge verdict={event.verdict} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{event.code ?? "—"}</td>
      <td className="px-3 py-2 font-mono text-sm tabular-nums">
        {event.amount_inr != null ? `₹${event.amount_inr.toLocaleString("en-IN")}` : "—"}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{event.run_id ?? "—"}</td>
    </tr>
  );
}
