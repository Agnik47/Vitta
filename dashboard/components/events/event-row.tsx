import type { GateEvent } from "@/lib/types";
import { VerdictBadge } from "@/components/events/verdict-badge";

export function EventRow({ event }: { event: GateEvent }) {
  return (
    <tr
      className="border-b border-border transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-muted/30 starting:-translate-y-1 starting:opacity-0"
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
