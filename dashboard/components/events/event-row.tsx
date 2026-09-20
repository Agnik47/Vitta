import { CircleCheck, CircleX, Info } from "lucide-react";
import type { ActivityEvent, DecisionLogEntry } from "@/lib/types";
import { isActivityEvent } from "@/lib/types";
import { VerdictBadge } from "@/components/events/verdict-badge";
import { cn } from "@/lib/utils";

/** What kind of thing an entry is — drives the Type column and the type filter. */
export type EventCategory = "gate" | "payments" | "mandates" | "purchases" | "agents";

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  gate: "Gate decision",
  payments: "Payment",
  mandates: "Mandate",
  purchases: "Purchase",
  agents: "Agents",
};

export function categoryOf(entry: DecisionLogEntry): EventCategory {
  if (!isActivityEvent(entry)) return "gate";
  if (entry.action.startsWith("payment.")) return "payments";
  if (entry.action.startsWith("mandate.")) return "mandates";
  if (entry.action === "purchase.completed" || entry.action === "purchase.failed" || entry.action === "cart.emptied") return "purchases";
  if (entry.action === "agents.run") return "agents";
  return "gate"; // gate.run — a `gate run` that failed before it could decide
}

/** The result of an entry, on one scale: a gate verdict or an activity outcome. */
export type ResultKind = "ok" | "fail" | "step_up" | "info";

export function resultOf(entry: DecisionLogEntry): ResultKind {
  if (isActivityEvent(entry)) return entry.outcome === "SUCCESS" ? "ok" : entry.outcome === "FAILURE" ? "fail" : "info";
  return entry.verdict === "ALLOW" ? "ok" : entry.verdict === "DENY" ? "fail" : "step_up";
}

const ACTION_LABEL: Record<ActivityEvent["action"], string> = {
  "mandate.create": "Mandate created",
  "mandate.resign": "Mandate re-signed",
  "payment.order_created": "Payment order created",
  "payment.received": "Payment received",
  "payment.fund": "Funding",
  "purchase.completed": "Purchase completed",
  "purchase.failed": "Purchase failed",
  "cart.emptied": "Cart emptied",
  "gate.run": "Gate run",
  "agents.run": "Agents run",
};

const OUTCOME_STYLE = {
  SUCCESS: { icon: CircleCheck, label: "SUCCESS", className: "border-allow/30 bg-allow/10 text-allow" },
  FAILURE: { icon: CircleX, label: "FAILED", className: "border-deny/30 bg-deny/10 text-deny" },
  INFO: { icon: Info, label: "INFO", className: "border-border bg-muted/40 text-muted-foreground" },
} as const;

function OutcomeBadge({ outcome }: { outcome: ActivityEvent["outcome"] }) {
  const { icon: Icon, label, className } = OUTCOME_STYLE[outcome];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap", className)}>
      <Icon className="size-3" strokeWidth={2.25} />
      {label}
    </span>
  );
}

const ROW = "border-b border-border transition-[opacity,transform,background-color] duration-300 ease-out hover:bg-muted/30 starting:-translate-y-1 starting:opacity-0";

export function EventRow({ event }: { event: DecisionLogEntry }) {
  const time = (
    <td className="py-2 pr-3 pl-3 text-xs whitespace-nowrap text-muted-foreground">{new Date(event.ts).toLocaleTimeString()}</td>
  );
  const amount = (
    <td className="px-3 py-2 font-mono text-sm tabular-nums">{event.amount_inr != null ? `₹${event.amount_inr.toLocaleString("en-IN")}` : "—"}</td>
  );

  if (isActivityEvent(event)) {
    const reference = event.receipt_id ?? event.run_id ?? event.mandate_id ?? event.reserve_ref;
    return (
      <tr className={ROW}>
        {time}
        <td className="px-3 py-2 text-sm font-medium text-foreground">{ACTION_LABEL[event.action] ?? event.action}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{CATEGORY_LABEL[categoryOf(event)]}</td>
        <td className="px-3 py-2">
          <OutcomeBadge outcome={event.outcome} />
        </td>
        <td className="max-w-md px-3 py-2 text-xs text-muted-foreground">
          <div className="text-foreground">{event.summary}</div>
          {event.error && <div className="mt-0.5 text-deny">{event.error}</div>}
        </td>
        {amount}
        <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs text-muted-foreground" title={reference}>
          {reference ?? "—"}
        </td>
      </tr>
    );
  }

  return (
    <tr className={ROW}>
      {time}
      <td className="px-3 py-2 font-mono text-sm">{event.command}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {CATEGORY_LABEL.gate} · <span className="uppercase">{event.access}</span>
      </td>
      <td className="px-3 py-2">
        <VerdictBadge verdict={event.verdict} />
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{event.code ?? "—"}</td>
      {amount}
      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{event.run_id ?? "—"}</td>
    </tr>
  );
}
