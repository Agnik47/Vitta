"use client";

import { ScrollText } from "lucide-react";
import type { Mandate } from "@/lib/types";
import { PageHeader } from "@/components/layout/page-header";
import { MandateHero } from "@/components/mandate/mandate-hero";
import { EmptyState } from "@/components/shared/empty-state";
import { usePolledFetch } from "@/hooks/use-polling";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;
type MandateApiResponse = { mandate: Mandate | null; balance: Balance };

const POLL_INTERVAL_MS = 4000;

export default function MandatePage() {
  const { data } = usePolledFetch<MandateApiResponse>("/api/mandate", POLL_INTERVAL_MS);

  return (
    <div>
      <PageHeader
        title="Current mandate"
        description="What the agent is signed to spend, where, and against what's left in reserve."
      />

      {data === null ? (
        <div className="h-40 animate-pulse rounded-md border border-border bg-secondary/50" />
      ) : data.mandate === null ? (
        <EmptyState
          icon={ScrollText}
          title="No mandate created yet"
          hint="Run `gate mandate create` from the CLI to issue one."
        />
      ) : (
        <MandateHero mandate={data.mandate} balance={data.balance} />
      )}
    </div>
  );
}
