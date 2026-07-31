"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Columns3,
  History,
  LayoutDashboard,
  Receipt as ReceiptIcon,
  ShoppingCart,
  SlidersHorizontal,
  Store,
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
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";

const SHOP_NAV = [
  { href: "/shop", label: "Search & compare", icon: Store },
  { href: "/shop/cart", label: "Cart", icon: ShoppingCart, cartBadge: true },
];

const REAL_NAV = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/events", label: "Decisions", icon: Activity },
  { href: "/receipts", label: "Proof chain", icon: ReceiptIcon },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

const CONCEPT_NAV = [
  { href: "/concept/compare", label: "Compare markets", icon: Columns3 },
  { href: "/concept/rules", label: "Policy builder", icon: SlidersHorizontal },
  { href: "/concept/timeline", label: "Activity flow", icon: History },
];

function NavLink({
  href,
  label,
  icon: Icon,
  cartBadge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  cartBadge?: boolean;
}) {
  const pathname = usePathname();
  const isActive = href === "/overview" ? pathname === "/overview" || pathname.startsWith("/overview") : pathname.startsWith(href);
  const { lines } = useCart();
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link
          href={href}
          className={cn(
            // Flat background tint on the active item — no border stripe, no
            // rounded pill. Icon picks up the seal accent when active.
            "transition-colors duration-200",
            isActive
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <Icon strokeWidth={1.75} className={isActive ? "text-seal" : undefined} />
          <span className="flex-1">{label}</span>
          {cartBadge && itemCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-seal text-[10px] font-semibold tabular-nums text-primary-foreground group-data-[collapsible=icon]:hidden">
              {itemCount}
            </span>
          ) : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}


export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3">
        {/* Logo — switches between light/dark mode and full/icon based on sidebar state */}
        <Link href="/" className="flex items-center px-1">
          {/* Expanded (Full Logo) */}
          <div className="relative h-20 w-40 group-data-[collapsible=icon]:hidden">
            <Image
              src="/logs/Vitta_LightMode_Logo.png"
              alt="Vitta Logo"
              fill
              className="object-contain object-left [.dark_&]:hidden block"
              priority
            />
            <Image
              src="/logs/Vitta_DarkMode_Logo.png"
              alt="Vitta Logo"
              fill
              className="object-contain object-left hidden [.dark_&]:block"
              priority
            />
          </div>
          
          {/* Collapsed (Icon Only) */}
          <div className="relative size-6 hidden group-data-[collapsible=icon]:block">
            <Image
              src="/logs/Vitta_LightMode_Icon.png"
              alt="Vitta Icon"
              fill
              className="object-contain [.dark_&]:hidden block"
              priority
            />
            <Image
              src="/logs/Vitta_DarkMode_icon.png"
              alt="Vitta Icon"
              fill
              className="object-contain hidden [.dark_&]:block"
              priority
            />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Shop — the primary flow: search, compare, cart, checkout, real execute */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest text-ink-faint uppercase">
            Shop
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SHOP_NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Real audit pages */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-widest text-ink-faint uppercase">
            Audit trail
          </SidebarGroupLabel>
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
