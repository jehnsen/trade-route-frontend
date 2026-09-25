"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, FlaskConical, Lock, Menu, RotateCcw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";
import { NAV, FUTURE_MODULES, ROLE_META, canAccess } from "@/lib/nav";
import { useAppStore, actorFor } from "@/lib/store";
import { useInvoices } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { unassignedTruckOrders } from "@/lib/selectors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/overlays";
import { EmptyState } from "@/components/shared/common";
import { Logo } from "./brand";
import { GlobalSearch } from "./global-search";
import { NotificationsBell } from "./notifications-bell";

function useNavBadges() {
  const orders = useAppStore((s) => s.orders);
  const leads = useAppStore((s) => s.leads);
  const invoices = useInvoices();
  return React.useMemo(() => {
    const overdueCustomers = new Set(invoices.filter((i) => i.daysOverdue > 0 && i.balance > 0).map((i) => i.customerId));
    return {
      pendingOrders: orders.filter((o) => o.status === "Pending Confirmation").length,
      unassigned: unassignedTruckOrders(orders, TODAY).length + unassignedTruckOrders(orders, TOMORROW).length,
      overdue: overdueCustomers.size,
      newLeads: leads.filter((l) => l.stage === "New").length,
    };
  }, [orders, leads, invoices]);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useAppStore((s) => s.role);
  const badges = useNavBadges();
  const [futureOpen, setFutureOpen] = React.useState(pathname.startsWith("/future"));
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4 scrollbar-thin" aria-label="Main">
      {NAV.map((section) => {
        const items = section.items.filter((i) => i.roles.includes(role) || role === "owner");
        if (!items.length) return null;
        return (
          <div key={section.label}>
            <div className="px-2 pb-1 text-[10.5px] font-semibold tracking-wider text-sidebar-muted uppercase">{section.label}</div>
            <ul className="grid gap-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] font-medium transition-colors",
                        active ? "bg-sidebar-active text-white shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
                      )}
                    >
                      <item.icon className={cn("size-4 shrink-0", active ? "text-white" : "text-sidebar-muted group-hover:text-white")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {count > 0 && (
                        <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold tabular", item.badgeKey === "overdue" ? "bg-[oklch(0.56_0.2_25)] text-white" : active ? "bg-white/25 text-white" : "bg-white/10 text-sidebar-foreground")}>
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div>
        <button type="button" onClick={() => setFutureOpen((v) => !v)} className="flex w-full items-center justify-between px-2 pb-1 text-[10.5px] font-semibold tracking-wider text-sidebar-muted uppercase hover:text-white cursor-pointer" aria-expanded={futureOpen}>
          Future Modules
          <ChevronDown className={cn("size-3.5 transition-transform", futureOpen && "rotate-180")} />
        </button>
        {futureOpen && (
          <ul className="grid gap-0.5">
            {FUTURE_MODULES.map((m) => {
              const href = `/future/${m.slug}`;
              const active = pathname === href;
              return (
                <li key={m.slug}>
                  <Link href={href} onClick={onNavigate} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors", active ? "bg-sidebar-accent text-white" : "text-sidebar-muted hover:bg-sidebar-accent hover:text-white")}>
                    <m.icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{m.label}</span>
                    <span className="rounded border border-white/15 px-1 text-[9.5px] font-semibold tracking-wide uppercase">Soon</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center px-4">
        <Link href="/command-center" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <div className="mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-[11.5px] leading-snug text-sidebar-foreground">
        <div className="flex items-center gap-1.5 font-semibold text-white">
          <Sparkles className="size-3.5 text-[#9be3d9]" /> Central Order System
        </div>
        Messenger, phone, Facebook and portal orders all land here.
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-muted">Lucena Fresh Trading & Logistics · Phase 1</div>
    </div>
  );
}

export function RoleSwitcher({ compact }: { compact?: boolean }) {
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const router = useRouter();
  const pathname = usePathname();
  const meta = ROLE_META[role];
  const choose = (r: Role) => {
    setRole(r);
    const m = ROLE_META[r];
    toast.success(`Switched to ${m.label} view`, { description: m.description });
    if (r === "driver" || r === "customer") router.push(m.home);
    else if (!canAccess(r, pathname) || pathname.startsWith("/driver") || !pathname.match(/^\/(command-center|dashboard|orders|customers|leads|dispatch|trips|deliveries|backhaul|catalog|inventory|procurement|purchase-orders|suppliers|accounts-receivable|payments|expenses|trucks|drivers|reports|settings|notifications|future)/)) router.push(m.home);
  };
  const initials = actorFor(role)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-lg border bg-card px-1.5 py-1 text-left hover:bg-accent cursor-pointer" aria-label="Switch demo role">
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary text-[11px] text-white">{initials}</AvatarFallback>
          </Avatar>
          {!compact && (
            <span className="hidden pr-1 leading-tight md:block">
              <span className="block text-[13px] font-medium">{actorFor(role).replace(" (portal)", "")}</span>
              <span className="block text-[11px] text-muted-foreground">{meta.label} view</span>
            </span>
          )}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Demo account — switch role</DropdownMenuLabel>
        {(["owner", "sales", "dispatcher", "procurement", "warehouse", "accounting", "driver", "customer"] as Role[]).map((r) => {
          const m = ROLE_META[r];
          return (
            <DropdownMenuItem key={r} onSelect={() => choose(r)} className={cn(r === role && "bg-accent")}>
              <m.icon />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.label}</div>
                <div className="truncate text-xs text-muted-foreground">{m.description}</div>
              </div>
              {r === role && <Badge variant="teal">Active</Badge>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DemoBadge() {
  const reset = useAppStore((s) => s.resetDemo);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-[oklch(0.85_0.08_85)] bg-warning-soft px-2.5 py-1 text-xs font-semibold text-[oklch(0.45_0.11_65)] cursor-pointer">
          <FlaskConical className="size-3.5" />
          Demo Data
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-sm">
        <div className="font-semibold">You are viewing demo data</div>
        <p className="mt-1 text-muted-foreground">
          All customers, prices, trips and balances are fictional and generated for Lucena Fresh Trading & Logistics. The demo clock is fixed at <b>Fri, Sep 25, 2026 · 7:48 AM</b>. Changes you make are saved in this browser only.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={() => {
            reset();
            toast.success("Demo data reset", { description: "Everything is back to the 7:48 AM snapshot." });
          }}
        >
          <RotateCcw /> Reset demo data
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function RoleGate({ children }: { children: React.ReactNode }) {
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const pathname = usePathname();
  if (role === "driver" || role === "customer" || !canAccess(role, pathname)) {
    return (
      <EmptyState
        icon={Lock}
        className="mx-auto mt-10 max-w-lg bg-card"
        title={`Not available in the ${ROLE_META[role].label} view`}
        description="In the live system this page would be hidden for this role. Switch to the Owner view to explore everything."
        action={
          <Button onClick={() => setRole("owner")}>
            <Sparkles /> Switch to Owner
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block no-print">
        <SidebarBody />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 max-w-[80%] border-0 p-0 [&>button]:text-white">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-card/95 px-3 backdrop-blur sm:px-5 no-print">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted sm:max-w-md cursor-pointer"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Search</span>
              <span className="hidden sm:inline">Search orders, customers, trips, invoices…</span>
            </span>
            <kbd className="ml-auto hidden rounded border bg-card px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span className="hidden text-xs text-muted-foreground xl:inline">Fri, Sep 25, 2026 · 7:48 AM</span>
            <span className="hidden sm:inline-flex">
              <DemoBadge />
            </span>
            <NotificationsBell />
            <RoleSwitcher />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-5 lg:px-6">
          <div className="mb-3 sm:hidden">
            <DemoBadge />
          </div>
          <RoleGate>{children}</RoleGate>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

