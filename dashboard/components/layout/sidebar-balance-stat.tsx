"use client";

import { Wallet } from "lucide-react";
import { usePolledFetch } from "@/hooks/use-polling";
import type { Mandate } from "@/lib/types";

type Balance = { available: true; balanceInr: number } | { available: false; reason: string } | null;
type MandateApiResponse = { mandate: Mandate | null; balance: Balance };

const POLL_INTERVAL_MS = 4000;

/**
 * Always-visible reserve balance, pinned to the sidebar footer — real Prava
 * data, no need to navigate to "/" just to see it. See DESIGN.md § Layout
 * System.
 */
export function SidebarBalanceStat() {
  const { data } = usePolledFetch<MandateApiResponse>("/api/mandate", POLL_INTERVAL_MS);

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Wallet className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
        <div className="text-[10px] tracking-wide text-ink-faint uppercase">Reserve</div>
        <div className="truncate font-mono text-sm tabular-nums text-foreground">
          {data?.balance?.available ? `₹${data.balance.balanceInr.toLocaleString("en-IN")}` : "—"}
        </div>
      </div>
    </div>
  );
}
