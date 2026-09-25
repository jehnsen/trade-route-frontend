"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LayoutDashboard, MapPin, Menu, MessageCircle, Phone, ShoppingBag, UserRound } from "lucide-react";
import { useAppStore, PORTAL_CUSTOMER_ID } from "@/lib/store";
import { COMPANY, PLATFORM } from "@/data/company";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { Logo } from "@/components/layout/brand";
import { DemoBadge } from "@/components/layout/app-shell";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Our products" },
  { href: "/#delivery", label: "How we deliver" },
  { href: "/contact", label: "Contact us" },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cart = useAppStore((s) => s.cart);
  const customer = useAppStore((s) => s.customers.find((c) => c.id === PORTAL_CUSTOMER_ID));
  const [open, setOpen] = React.useState(false);
  const count = cart.length;
  return (
    <div className="portal flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-50 -translate-y-24 rounded-lg bg-white px-4 py-3 text-sm font-medium text-[#254632] shadow-lg focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="border-b border-[#e5e9df] bg-[#eef2e8] text-[#5c6d53]">
        <div className="portal-container flex min-h-8 items-center justify-center gap-4 py-2 text-[10px] sm:justify-between">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3" /> From Lucena, Quezon to your business.
          </span>
          <div className="hidden items-center gap-5 sm:flex">
            <span>Wholesale trading & logistics, connected.</span>
            <a
              href={`tel:${COMPANY.mobile.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1.5 font-medium hover:text-[#28422e]"
            >
              <Phone className="size-3" /> {COMPANY.mobile}
            </a>
          </div>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-[#e3e7de] bg-[#fafbf7]/95 backdrop-blur-xl">
        <div className="portal-container flex h-[78px] items-center gap-3">
          <Link href="/" aria-label={`${PLATFORM.name} home`} className="shrink-0">
            <Logo tone="light" storefront />
          </Link>
          <nav className="mx-auto hidden items-center gap-5 lg:flex xl:gap-7" aria-label="Main navigation">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "page" : undefined}
                className={cn(
                  "relative py-7 text-xs font-medium transition-colors hover:text-[#264b35]",
                  (link.href === "/" ? pathname === "/" : pathname.startsWith(link.href))
                    ? "text-[#264b35] after:absolute after:inset-x-0 after:bottom-4 after:h-0.5 after:rounded-full after:bg-[#78916a]"
                    : "text-[#63715e]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3 lg:ml-0">
            <Button asChild variant="ghost" size="icon" className="relative">
              <Link href="/order" aria-label={`Wholesale order (${count} products)`}>
                <ShoppingBag className="size-[18px]" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#31573e] text-[9px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Business account menu">
                  <UserRound className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  Signed in as {customer?.contacts[0]?.name}
                  <div className="mt-1 text-xs font-normal text-muted-foreground">{customer?.name}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/my-orders">My orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account">Business account</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/request-quote">Request a wholesale quote</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard /> Staff workspace (demo)
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="hidden h-10 gap-4 rounded-lg px-4 text-xs sm:inline-flex">
              <Link href="/request-quote">
                Get a quote <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
          </div>
        </div>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="portal w-80 p-6">
          <SheetTitle className="sr-only">TradeLoop menu</SheetTitle>
          <SheetDescription className="sr-only">Explore products, delivery information and your business account.</SheetDescription>
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo tone="light" storefront />
          </Link>
          <nav aria-label="Mobile navigation" className="mt-8 grid gap-1">
            {[
              ...LINKS,
              { href: "/request-quote", label: "Request a quote" },
              { href: "/my-orders", label: "My orders" },
              { href: "/account", label: "Business account" },
              { href: "/order", label: `Wholesale order (${count})` },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium hover:bg-accent"
              >
                {link.label}
                <ArrowUpRight className="size-3.5 text-[#86967b]" />
              </Link>
            ))}
          </nav>
          <div className="mt-8 border-t pt-5">
            <p className="text-xs leading-6 text-muted-foreground">
              Your wholesale order desk
              <br />
              {COMPANY.businessHours}
            </p>
            <a href={`tel:${COMPANY.mobile.replace(/\s/g, "")}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
              <Phone className="size-4" />
              {COMPANY.mobile}
            </a>
          </div>
        </SheetContent>
      </Sheet>
      <main id="main-content" tabIndex={-1} className={cn("flex-1 outline-none", pathname !== "/" && "pb-12")}>
        {children}
      </main>
      <footer className="bg-[#112e2c] text-[#b6c8bc]">
        <div className="portal-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="TradeLoop home">
              <Logo storefront />
            </Link>
            <p className="mt-5 max-w-[235px] text-xs leading-6">
              Fresh seafood. Quality produce.
              <br />A better-connected wholesale business.
            </p>
            <p className="mt-4 text-[10px] text-[#839d8c]">{COMPANY.name}</p>
          </div>
          <div>
            <h2 className="mb-5 text-[11px] font-semibold text-white">Explore TradeLoop</h2>
            <div className="grid gap-3 text-xs">
              {[
                { href: "/products?category=seafood", label: "Fresh seafood" },
                { href: "/products?category=produce", label: "Agricultural produce" },
                { href: "/#delivery", label: "Our delivery network" },
                { href: "/request-quote", label: "Wholesale quotes" },
                { href: "/my-orders", label: "Track your orders" },
              ].map((link) => (
                <Link key={link.href} href={link.href} className="w-fit transition-colors hover:text-white">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="mb-5 text-[11px] font-semibold text-white">Let’s talk business</h2>
            <div className="grid gap-3.5 text-xs">
              <a href={`tel:${COMPANY.mobile.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="size-3.5" />
                {COMPANY.mobile}
              </a>
              <a
                href={`https://${COMPANY.messenger}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-white"
              >
                <MessageCircle className="size-3.5" />
                Message us on Facebook
                <ArrowUpRight className="size-3" />
              </a>
              <a href={`mailto:${COMPANY.email}`} className="hover:text-white">
                {COMPANY.email}
              </a>
              <p className="mt-1 text-[10px] text-[#839d8c]">{COMPANY.businessHours}</p>
            </div>
          </div>
          <div>
            <h2 className="mb-5 text-[11px] font-semibold text-white">Find us in Lucena</h2>
            <p className="text-xs leading-6">{COMPANY.address}</p>
            <Link href="/contact" className="mt-4 inline-flex items-center gap-2 text-xs text-[#c8e6b1] hover:text-white">
              Visit our bodega <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="portal-container flex flex-wrap items-center justify-between gap-4 py-5 text-[10px] text-[#839d8c]">
            <p>TradeLoop · Rooted in Quezon. Connected by trade.</p>
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="hover:text-white">
                Staff workspace
              </Link>
              <DemoBadge />
            </div>
          </div>
          <p className="portal-container pb-5 text-[9px] leading-5 text-[#839d8c]">
            Demo storefront. Company, customers and prices are fictional. Prices are indicative and subject to confirmation.
          </p>
        </div>
      </footer>
    </div>
  );
}
