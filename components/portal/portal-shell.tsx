"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, MessageCircle, Phone, ShoppingCart, UserRound } from "lucide-react";
import { useAppStore, PORTAL_CUSTOMER_ID } from "@/lib/store";
import { COMPANY, PLATFORM } from "@/data/company";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { Logo } from "@/components/layout/brand";
import { DemoBadge } from "@/components/layout/app-shell";

const LINKS = [
  { href: "/products", label: "Products" },
  { href: "/request-quote", label: "Request Quote" },
  { href: "/my-orders", label: "My Orders" },
  { href: "/contact", label: "Contact" },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cart = useAppStore((s) => s.cart);
  const customer = useAppStore((s) => s.customers.find((c) => c.id === PORTAL_CUSTOMER_ID));
  const [open, setOpen] = React.useState(false);
  const count = cart.length;
  return (
    <div className="flex min-h-dvh flex-col bg-[oklch(0.99_0.003_200)]">
      <div className="bg-[oklch(0.25_0.04_220)] px-4 py-1.5 text-center text-[12px] text-white/85">
        Orders by Messenger <b className="text-white">{COMPANY.messenger}</b> or phone <b className="text-white">{COMPANY.mobile}</b> are welcome too — they all go to the same order desk.
      </div>
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <Link href="/" aria-label={`${PLATFORM.name} home`}>
            <Logo tone="light" />
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Portal">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={cn("rounded-md px-3 py-2 text-sm font-medium hover:bg-accent", pathname.startsWith(l.href) ? "text-primary" : "text-foreground/80")}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden lg:inline-flex">
              <DemoBadge />
            </span>
            <Button asChild variant="outline" size="sm" className="relative">
              <Link href="/order" aria-label={`Wholesale order (${count} products)`}>
                <ShoppingCart />
                <span className="hidden sm:inline">Order</span>
                {count > 0 && <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{count}</span>}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <UserRound />
                  <span className="hidden max-w-[140px] truncate sm:inline">{customer?.name ?? "Account"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  Signed in as {customer?.contacts[0].name}
                  <div className="font-normal">{customer?.name}</div>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/my-orders">My orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account">Business account</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard /> Staff workspace (demo)
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo tone="light" />
          <nav className="mt-6 grid gap-1">
            {[{ href: "/", label: "Home" }, ...LINKS, { href: "/account", label: "Business account" }, { href: "/order", label: `Wholesale order (${count})` }].map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 text-[15px] font-medium hover:bg-accent">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6">
            <DemoBadge />
          </div>
        </SheetContent>
      </Sheet>
      <main className="flex-1">{children}</main>
      <footer className="mt-16 border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid content-start gap-2">
            <Logo tone="light" />
            <p className="text-muted-foreground">{PLATFORM.tagline}</p>
            <p className="text-muted-foreground">{COMPANY.name}</p>
          </div>
          <div className="grid content-start gap-1.5">
            <div className="font-semibold">Bodega</div>
            <p className="text-muted-foreground">{COMPANY.address}</p>
            <p className="text-muted-foreground">{COMPANY.businessHours}</p>
          </div>
          <div className="grid content-start gap-1.5">
            <div className="font-semibold">Order desk</div>
            <a href={`tel:${COMPANY.mobile.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <Phone className="size-4" /> {COMPANY.mobile} · {COMPANY.phone}
            </a>
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="size-4" /> {COMPANY.messenger}
            </span>
            <span className="text-muted-foreground">{COMPANY.email}</span>
          </div>
          <div className="grid content-start gap-1.5">
            <div className="font-semibold">Serving</div>
            <p className="text-muted-foreground">Lucena & Quezon Province · Metro Manila · Cavite · Laguna · Batangas · selected Visayas & Mindanao distributors via sea-freight partner</p>
          </div>
        </div>
        <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">Demo storefront — company, customers and prices are fictional. Prices are indicative only and subject to confirmation.</div>
      </footer>
    </div>
  );
}
