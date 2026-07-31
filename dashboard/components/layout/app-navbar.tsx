"use client";

import { usePathname } from "next/navigation";
import {
  Activity,
  Columns3,
  History,
  Moon,
  Receipt as ReceiptIcon,
  ScrollText,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { TestModeBadge } from "@/components/shared/test-mode-badge";
import { useTheme } from "@/components/theme-provider";
import { usePolledFetch } from "@/hooks/use-polling";
import { cn } from "@/lib/utils";

const HEARTBEAT_INTERVAL_MS = 5000;

const ROUTE_META: Record<string, { label: string; icon: React.ElementType }> = {
  "/": { label: "Vitta", icon: ScrollText },
  "/events": { label: "Events", icon: Activity },
  "/receipts": { label: "Receipts", icon: ReceiptIcon },
  "/concept/compare": { label: "Compare", icon: Columns3 },
  "/concept/rules": { label: "Rule builder", icon: SlidersHorizontal },
  "/concept/timeline": { label: "Timeline", icon: History },
};

function CurrentPageBreadcrumb() {
  const pathname = usePathname();
  const meta = ROUTE_META[pathname] ?? ROUTE_META["/"];
  const Icon = meta.icon;

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-2 font-medium text-foreground">
            <Icon className="size-4 shrink-0 text-seal" strokeWidth={1.75} />
            <span className="truncate">{meta.label}</span>
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-8 items-center justify-center rounded-sm border border-border",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        "transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
      )}
    >
      {isDark ? (
        <Sun className="size-3.5" strokeWidth={1.75} />
      ) : (
        <Moon className="size-3.5" strokeWidth={1.75} />
      )}
      <span className="sr-only">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

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
      <CurrentPageBreadcrumb />

      <div className="flex flex-1 items-center justify-end gap-3">
        {/* Live connectivity indicator */}
        <span
          className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"
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

        <Separator orientation="vertical" className="hidden h-5 sm:block" />

        <ThemeToggle />
      </div>
    </header>
  );
}
