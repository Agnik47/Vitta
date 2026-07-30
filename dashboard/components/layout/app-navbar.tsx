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
  // API route actually stops responding, this dot actually flips.
  const { ok } = usePolledFetch<unknown>("/api/mandate", HEARTBEAT_INTERVAL_MS);

  return (
    <header
      className={cn(
        // Fixed to top so it stays visible when content scrolls.
        // z-40 keeps it above page content but below popovers/modals.
        "sticky top-0 z-40",
        "flex h-14 shrink-0 items-center gap-3",
        "border-b border-border bg-background/95 backdrop-blur-sm",
        "px-4 sm:px-6 lg:px-8",
        // Smooth background transition for theme switch
        "transition-colors duration-300 ease-out"
      )}
    >
      <SidebarTrigger className="-ml-1.5" />
      <Separator orientation="vertical" className="h-5" />

      <div className="flex flex-1 items-center justify-end gap-3">
        {/* Live connectivity indicator */}
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={ok ? "Live — data routes responding" : "Data routes unreachable"}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              ok ? "bg-allow animate-pulse-dot" : "bg-deny"
            )}
          />
          {ok ? "Live" : "Offline"}
        </span>

        <TestModeBadge />
      </div>
    </header>
  );
}
