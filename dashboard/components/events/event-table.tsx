"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import type { GateEvent } from "@/lib/types";
import { EventRow } from "@/components/events/event-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Filter = "ALL" | "ALLOW" | "DENY" | "STEP_UP";

export function EventTable({ events }: { events: GateEvent[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(
    () => ({
      ALLOW: events.filter((e) => e.verdict === "ALLOW").length,
      DENY: events.filter((e) => e.verdict === "DENY").length,
      STEP_UP: events.filter((e) => e.verdict === "STEP_UP").length,
    }),
    [events]
  );

  const reversed = useMemo(() => [...events].reverse(), [events]);
  const visible = filter === "ALL" ? reversed : reversed.filter((e) => e.verdict === filter);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-muted-foreground">
          <span className="text-allow">{counts.ALLOW} allow</span>
          <span className="text-deny">{counts.DENY} deny</span>
          <span className="text-step-up">{counts.STEP_UP} step-up</span>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList variant="line">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="ALLOW">Allow</TabsTrigger>
            <TabsTrigger value="DENY">Deny</TabsTrigger>
            <TabsTrigger value="STEP_UP">Step-up</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Activity} title="No events yet" hint="Run a `gate` command from the CLI to see it appear here." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Command</th>
                <th className="px-3 py-2 font-medium">Access</th>
                <th className="px-3 py-2 font-medium">Verdict</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Run ID</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <EventRow key={e.event_id} event={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
