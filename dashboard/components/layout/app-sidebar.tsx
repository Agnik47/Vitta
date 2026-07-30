"use client";

import Link from "next/link";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SidebarBalanceStat } from "@/components/layout/sidebar-balance-stat";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const REAL_NAV = [
  { href: "/", label: "Mandate", icon: ScrollText },
  { href: "/events", label: "Events", icon: Activity },
  { href: "/receipts", label: "Receipts", icon: ReceiptIcon },
];

const CONCEPT_NAV = [
  { href: "/concept/compare", label: "Compare", icon: Columns3 },
  { href: "/concept/rules", label: "Rule builder", icon: SlidersHorizontal },
  { href: "/concept/timeline", label: "Timeline", icon: History },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link
          href={href}
          className={cn(
            // Sharp left-border indicator — no rounded background.
            // The 2px border is the only active signal; background tint is subtle.
            "border-l-2 pl-[calc(0.5rem-2px)] transition-colors duration-250",
            isActive
              ? "border-l-seal font-medium text-foreground"
              : "border-l-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon strokeWidth={1.75} />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** Vitta "V" mark — a simple SVG grain/coin symbol representing wealth (Sanskrit: vitta). */
function VittaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Bold V inside */}
      <path
        d="M7.5 7.5 L12 16.5 L16.5 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
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
        "flex size-7 items-center justify-center rounded-sm",
        "text-muted-foreground hover:text-foreground",
        "transition-colors duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        // Hide label in icon-collapsed sidebar state
        "group-data-[collapsible=icon]:hidden"
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

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3">
        {/* Vitta wordmark + theme toggle in the same header row */}
        <div className="flex items-center justify-between px-1">
          <Link href="/" className="flex items-center gap-2">
            <VittaMark className="size-5 shrink-0 text-seal" />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
              Vitta
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Real pages */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {REAL_NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Concept pages — visually separated */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest text-ink-faint uppercase">
            Concept preview
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONCEPT_NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-3">
        <SidebarBalanceStat />
      </SidebarFooter>
    </Sidebar>
  );
}
