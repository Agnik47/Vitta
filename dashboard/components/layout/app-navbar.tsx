"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TestModeBadge } from "@/components/shared/test-mode-badge";
import { usePolledFetch } from "@/hooks/use-polling";
import { cn } from "@/lib/utils";

const HEARTBEAT_INTERVAL_MS = 5000;

export function AppNavbar() {
  // A lightweight, always-on real connectivity signal — not tied to any one
  // page's own poll (each page runs its own independent fetch loop). If the
  // API route actually stops responding, this dot actually flips; it is not
  // a decorative loop. See DESIGN.md § Layout System.
  const { ok } = usePolledFetch<unknown>("/api/mandate", HEARTBEAT_INTERVAL_MS);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6 lg:px-8">
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center justify-end gap-3">
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={ok ? "Live — data routes responding" : "Data routes unreachable"}
        >
          <span className={cn("size-1.5 rounded-full", ok ? "bg-allow" : "bg-deny")} />
          {ok ? "Live" : "Offline"}
        </span>
        <TestModeBadge />
      </div>
    </header>
  );
}
