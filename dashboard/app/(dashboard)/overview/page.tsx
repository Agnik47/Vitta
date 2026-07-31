"use client";

import Link from "next/link";
import { ArrowRight, ShieldOff, Terminal } from "lucide-react";
import type { Mandate, GateEvent } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { MandateHero } from "@/components/mandate/mandate-hero";
import { RecentDecisionsStrip } from "@/components/home/recent-decisions-strip";
import { usePolledFetch, useIncrementalPoll } from "@/hooks/use-polling";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;
type MandateApiResponse = { mandate: Mandate | null; balance: Balance };

const MANDATE_POLL_MS = 4000;
const EVENTS_POLL_MS = 2000;

/** Shown when no mandate has been created yet — a real onboarding path, not a bare empty state. */
function NoMandateState() {
  return (
    <div className="flex flex-col items-start gap-5 border border-border bg-card px-6 py-8">
      <div className="flex items-center gap-3">
        <ShieldOff className="size-7 text-ink-faint" strokeWidth={1.25} />
        <div>
          <div className="text-lg font-semibold text-foreground">No active mandate</div>
          <div className="mt-0.5 text-sm text-muted-foreground">
            The agent has no spending authority. Every transaction is blocked until a mandate is issued.
          </div>
        </div>
      </div>

      <div className="w-full bg-surface-sunken px-3 py-2.5">
        <p className="mb-1.5 text-xs text-ink-faint">Issue a mandate from the CLI:</p>
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <code className="font-mono text-sm text-foreground">gate mandate create</code>
        </div>
      </div>

      <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
        A mandate is a cryptographically signed authorization — it specifies the merchants, the spending
        cap, the per-transaction limit, and the expiry window. The gate checks every agent command
        against it before allowing any write to execute.
      </p>

      <div className="grid w-full grid-cols-1 divide-y divide-border border border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          { num: "01", label: "Issue a mandate", cmd: "gate mandate create" },
          { num: "02", label: "Run the agent", cmd: "gate run -- webcmd blinkit …" },
          { num: "03", label: "Decisions appear here", cmd: "Real-time, this dashboard" },
        ].map((s) => (
          <div key={s.num} className="px-4 py-4">
            <div className="mb-1.5 text-[10px] tracking-widest text-seal uppercase">{s.num}</div>
            <div className="text-sm font-medium text-foreground">{s.label}</div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{s.cmd}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MandatePage() {
  const { data } = usePolledFetch<MandateApiResponse>("/api/mandate", MANDATE_POLL_MS);
  const { items: events } = useIncrementalPoll<GateEvent>("/api/events", EVENTS_POLL_MS);

  const isLoading = data === null;
  const hasMandate = data?.mandate != null;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <PageHeader
          title="Current mandate"
          description="What the agent is signed to spend, where, and against what's left in reserve."
        />

        {isLoading ? (
          <div className="h-40 animate-pulse border border-border bg-muted/20" />
        ) : !hasMandate ? (
          <NoMandateState />
        ) : (
          <MandateHero mandate={data.mandate!} balance={data.balance} />
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium tracking-tight text-foreground">
            Recent decisions
          </h2>
          {events.length > 0 && (
            <Link
              href="/events"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              Full decision log
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
        <RecentDecisionsStrip events={events} />
      </section>
    </div>
  );
}
