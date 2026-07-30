"use client";

import { useMemo, useState } from "react";
import { Activity, CheckCircle2, OctagonX, ShieldAlert } from "lucide-react";
import type { GateEvent } from "@/lib/types";
import { EventRow } from "@/components/events/event-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "ALLOW" | "DENY" | "STEP_UP";

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
        "flex flex-1 items-center gap-3 border px-4 py-3 text-left",
        "transition-colors duration-250 ease-out",
        isActive ? [bgClass, borderClass] : "border-border bg-card hover:bg-muted/40"
      )}
    >
      <Icon className={cn("size-5 shrink-0", colorClass)} strokeWidth={1.75} />
      <div>
        <div className={cn("font-heading text-2xl font-semibold tabular-nums leading-none", colorClass)}>
          {count}
        </div>
        <div className="mt-0.5 text-[10px] tracking-widest text-ink-faint uppercase">{label}</div>
      </div>
    </button>
  );
}

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
      {/* ── Stat cards — clickable as filter shortcuts ── */}
      <div className="mb-5 grid grid-cols-3 gap-0 border border-border">
        <StatCard
          label="Allow"
          count={counts.ALLOW}
          icon={CheckCircle2}
          colorClass="text-allow"
          bgClass="bg-allow/5"
          borderClass="border-allow/40"
          isActive={filter === "ALLOW"}
          onClick={() => setFilter(filter === "ALLOW" ? "ALL" : "ALLOW")}
        />
        <div className="border-l border-r border-border">
          <StatCard
            label="Deny"
            count={counts.DENY}
            icon={OctagonX}
            colorClass="text-deny"
            bgClass="bg-deny/5"
            borderClass="border-deny/40"
            isActive={filter === "DENY"}
            onClick={() => setFilter(filter === "DENY" ? "ALL" : "DENY")}
          />
        </div>
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

      {/* ── Filter tabs ── */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {visible.length} event{visible.length !== 1 ? "s" : ""}
            {filter !== "ALL" ? ` · ${filter}` : ""}
          </span>
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

      {/* ── Table ── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No events yet"
          hint="Run a `gate` command from the CLI to see it appear here."
        />
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[10px] tracking-widest text-ink-faint uppercase">
                <th className="px-3 py-2.5 font-medium">Time</th>
                <th className="px-3 py-2.5 font-medium">Command</th>
                <th className="px-3 py-2.5 font-medium">Access</th>
                <th className="px-3 py-2.5 font-medium">Verdict</th>
                <th className="px-3 py-2.5 font-medium">Reason</th>
                <th className="px-3 py-2.5 font-medium">Amount</th>
                <th className="px-3 py-2.5 font-medium">Run ID</th>
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
