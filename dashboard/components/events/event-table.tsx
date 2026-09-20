"use client";

import { useMemo, useState } from "react";
import { Activity, CheckCircle2, OctagonX, ShieldAlert } from "lucide-react";
import type { DecisionLogEntry } from "@/lib/types";
import { CATEGORY_LABEL, EventRow, categoryOf, resultOf, type EventCategory } from "@/components/events/event-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// One scale for everything the log holds: a gate verdict or an activity outcome.
type Filter = "ALL" | "OK" | "FAIL" | "STEP_UP";
type TypeFilter = "ALL" | EventCategory;

interface StatCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  isActive: boolean;
  onClick: () => void;
}

function StatCard({ label, count, icon: Icon, colorClass, bgClass, borderClass, isActive, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-3 px-5 py-4 text-left",
        "transition-all duration-200 ease-out",
        isActive ? [bgClass, "ring-1 ring-inset", borderClass] : "hover:bg-muted/30"
      )}
    >
      <Icon className={cn("size-5 shrink-0", colorClass)} strokeWidth={1.75} />
      <div>
        <div className={cn("font-heading text-2xl font-bold tabular-nums leading-none", colorClass)}>
          {count}
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</div>
      </div>
    </button>
  );
}

export function EventTable({ events }: { events: DecisionLogEntry[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  // Counts follow the type filter, so the cards always describe what the table below is showing.
  const ofType = useMemo(() => (typeFilter === "ALL" ? events : events.filter((e) => categoryOf(e) === typeFilter)), [events, typeFilter]);

  const counts = useMemo(
    () => ({
      OK: ofType.filter((e) => resultOf(e) === "ok").length,
      FAIL: ofType.filter((e) => resultOf(e) === "fail").length,
      STEP_UP: ofType.filter((e) => resultOf(e) === "step_up").length,
    }),
    [ofType]
  );

  const typeCounts = useMemo(() => {
    const c: Record<EventCategory, number> = { gate: 0, payments: 0, mandates: 0, purchases: 0, agents: 0 };
    for (const e of events) c[categoryOf(e)] += 1;
    return c;
  }, [events]);

  const reversed = useMemo(() => [...ofType].reverse(), [ofType]);
  const visible =
    filter === "ALL"
      ? reversed
      : reversed.filter((e) => {
          const r = resultOf(e);
          return filter === "OK" ? r === "ok" : filter === "FAIL" ? r === "fail" : r === "step_up";
        });

  return (
    <div>
      {/* ── Stat cards ── */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className={cn("rounded-xl border overflow-hidden", filter === "OK" ? "border-allow/40" : "border-border")}>
          <StatCard
            label="Succeeded"
            count={counts.OK}
            icon={CheckCircle2}
            colorClass="text-allow"
            bgClass="bg-allow/5"
            borderClass="border-allow/40"
            isActive={filter === "OK"}
            onClick={() => setFilter(filter === "OK" ? "ALL" : "OK")}
          />
        </div>
        <div className={cn("rounded-xl border overflow-hidden", filter === "FAIL" ? "border-deny/40" : "border-border")}>
          <StatCard
            label="Failed or denied"
            count={counts.FAIL}
            icon={OctagonX}
            colorClass="text-deny"
            bgClass="bg-deny/5"
            borderClass="border-deny/40"
            isActive={filter === "FAIL"}
            onClick={() => setFilter(filter === "FAIL" ? "ALL" : "FAIL")}
          />
        </div>
        <div className={cn("rounded-xl border overflow-hidden", filter === "STEP_UP" ? "border-step-up/40" : "border-border")}>
          <StatCard
            label="Step-up"
            count={counts.STEP_UP}
            icon={ShieldAlert}
            colorClass="text-step-up"
            bgClass="bg-step-up/5"
            borderClass="border-step-up/40"
            isActive={filter === "STEP_UP"}
            onClick={() => setFilter(filter === "STEP_UP" ? "ALL" : "STEP_UP")}
          />
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {visible.length} event{visible.length !== 1 ? "s" : ""}
          {typeFilter !== "ALL" ? ` · ${CATEGORY_LABEL[typeFilter]}` : ""}
          {filter !== "ALL" ? ` · ${filter === "OK" ? "succeeded" : filter === "FAIL" ? "failed or denied" : "step-up"}` : ""}
        </span>
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <TabsList variant="line">
            <TabsTrigger value="ALL">All ({events.length})</TabsTrigger>
            {(Object.keys(CATEGORY_LABEL) as EventCategory[]).map((c) => (
              <TabsTrigger key={c} value={c}>
                {CATEGORY_LABEL[c]}s ({typeCounts[c]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* ── Table ── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing on record yet"
          hint="Creating a mandate, funding it, buying, or any failure of those shows up here — as does every gate decision."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Result</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Reference</th>
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
