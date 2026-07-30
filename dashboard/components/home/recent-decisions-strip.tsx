import type { GateEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICT = {
  ALLOW: { dot: "bg-allow", text: "text-allow", label: "Allow" },
  DENY: { dot: "bg-deny", text: "text-deny", label: "Deny" },
  STEP_UP: { dot: "bg-step-up", text: "text-step-up", label: "Step-up" },
} as const;

function DecisionRow({ event }: { event: GateEvent }) {
  const s = VERDICT[event.verdict];
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-muted/30 transition-colors duration-200">
      {/* Verdict dot */}
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} />

      {/* Command */}
      <span className="flex-1 truncate font-mono text-sm text-foreground">
        {event.command}
      </span>

      {/* Amount */}
      {event.amount_inr != null ? (
        <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
          ₹{event.amount_inr.toLocaleString("en-IN")}
        </span>
      ) : null}

      {/* Verdict label */}
      <span className={cn("shrink-0 text-xs font-medium", s.text)}>
        {s.label}
      </span>

      {/* Time */}
      <span className="shrink-0 text-xs text-ink-faint">
        {new Date(event.ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

/**
 * Shows the last 5 gate decisions inline on the home page.
 * Same real data as the Decisions page — just a top-5 view.
 */
export function RecentDecisionsStrip({ events }: { events: GateEvent[] }) {
  const recent = [...events].reverse().slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="border border-border border-dashed px-4 py-8 text-center bg-card">
        <p className="text-sm text-muted-foreground">No policy decisions yet.</p>
        <p className="mt-1 text-xs text-ink-faint">
          Run{" "}
          <code className="font-mono text-foreground">gate run</code> from the
          CLI — decisions appear here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card">
      {recent.map((e) => (
        <DecisionRow key={e.event_id} event={e} />
      ))}
    </div>
  );
}
