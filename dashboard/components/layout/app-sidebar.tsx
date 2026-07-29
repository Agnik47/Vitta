"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Columns3,
  History,
  Receipt as ReceiptIcon,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
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
            "border-l-2 border-l-transparent pl-[calc(0.5rem-2px)]",
            isActive && "border-l-seal font-medium"
          )}
        >
          <Icon strokeWidth={1.75} />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3">
        <Link href="/" className="flex items-center gap-2 px-1">
          <ShieldCheck className="size-5 shrink-0 text-seal" strokeWidth={1.75} />
          <span className="font-heading text-lg font-medium tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            Mandate Gate
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {REAL_NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-ink-faint">Concept preview</SidebarGroupLabel>
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
