"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import gsap from "gsap";
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
  { href: "/", label: "Overview", icon: LayoutDashboard },
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
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const { lines } = useCart();
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);

  const linkRef = useRef<HTMLAnchorElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (isActive) return;
    gsap.to(iconRef.current, { scale: 1.1, duration: 0.2, ease: "power1.out" });
    gsap.to(textRef.current, { x: 3, duration: 0.2, ease: "power1.out" });
  };

  const handleMouseLeave = () => {
    if (isActive) return;
    gsap.to(iconRef.current, { scale: 1, duration: 0.2, ease: "power1.inOut" });
    gsap.to(textRef.current, { x: 0, duration: 0.2, ease: "power1.inOut" });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link
          ref={linkRef}
          href={href}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "transition-colors duration-200 rounded-xl",
            isActive
              ? "bg-accent font-medium text-foreground"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          )}
        >
          <div ref={iconRef as any} className="shrink-0 flex items-center justify-center">
            <Icon strokeWidth={1.75} className={isActive ? "text-seal" : undefined} />
          </div>
          <span ref={textRef} className="flex-1">{label}</span>
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

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-2 py-3">
        {/* Vitta wordmark — theme toggle now lives in the navbar */}
        <Link href="/" className="flex items-center gap-2 px-1">
          <VittaMark className="size-5 shrink-0 text-seal" />
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
            Vitta
          </span>
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
