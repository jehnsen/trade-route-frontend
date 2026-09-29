"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, MapPin, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { areaName, routeById } from "@/data/areas";
import { driverById, truckById } from "@/data/fleet";
import { orderTotal } from "@/lib/calc";
import { isLive } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtTime, pct, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CapacityBar, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

export function DashboardMetric({ label, value, detail, icon: Icon, href, featured, footnote }: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: LucideIcon;
  href: string;
  featured?: boolean;
  footnote: ReactNode;
}) {
  return (
    <Link href={href} className={cn("dashboard-metric group flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-card hover:border-primary/40", featured && "border-[#21604e] bg-[#21604e] text-white hover:border-[#398068]")}>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs font-medium", featured ? "text-white/80" : "text-muted-foreground")}>{label}</span>
          <Icon className={cn("size-[18px]", featured ? "text-[#bce1cc]" : "text-primary/70")} strokeWidth={1.7} />
        </div>
        <div className="mt-4 text-[21px] leading-none font-semibold tracking-[-0.045em] tabular sm:text-[30px]">{value}</div>
        <div className={cn("mt-3 text-[11px] leading-relaxed", featured ? "text-white/75" : "text-muted-foreground")}>{detail}</div>
      </div>
      <div className={cn("flex items-center justify-between gap-2 border-t px-4 py-3 text-[11px] font-medium sm:px-5", featured ? "border-white/10 bg-black/5 text-white/85" : "border-border/70 bg-muted/25 text-muted-foreground")}>
        <span>{footnote}</span><ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}

export function FleetSnapshot() {
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const todayTrips = trips.filter((trip) => trip.date === TODAY && trip.status !== "Cancelled");
  const active = todayTrips.filter((trip) => ["In Transit", "Loading", "Returning"].includes(trip.status));

  return (
    <Card>
      <CardHeader className="px-5 pt-5 sm:px-6">
        <div><CardTitle>Fleet overview</CardTitle><CardDescription>{active.length} active {active.length === 1 ? "trip" : "trips"} today</CardDescription></div>
        <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><Truck className="size-[18px]" strokeWidth={1.7} /></span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-5 sm:px-6">
        <div className="flex-1 divide-y">
          {todayTrips.map((trip) => {
            const truck = truckById(trip.truckId);
            const m = metrics.get(trip.id);
            if (!m) return null;
            return (
              <div key={trip.id} className="py-4 first:pt-2">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/trips/${trip.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-primary"><span className="size-2 rounded-full" style={{ background: truck.color }} />{truck.code}<ArrowUpRight className="size-3.5 text-muted-foreground" /></Link>
                  <StatusBadge status={trip.status} icon={false} />
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3 shrink-0" /><span className="truncate">{routeById(trip.routeId).name}</span></div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-muted-foreground">Outbound / return load</span><span className="font-medium tabular">{pct(m.outUtil)} <span className="px-1 text-muted-foreground">/</span> {pct(m.retUtil)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <CapacityBar used={m.outboundLoadKg} capacity={m.capacityKg} label={`${truck.code} outbound capacity`} showNumbers={false} size="sm" className="[&>div:first-child:not([role])]:sr-only" />
                  <CapacityBar used={m.returnLoadKg} capacity={m.capacityKg} label={`${truck.code} return capacity`} showNumbers={false} size="sm" className="[&>div:first-child:not([role])]:sr-only" />
                </div>
                <div className="mt-2.5 flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{driverById(trip.driverId).name}</span><span>{m.delivered}/{m.deliveries.length} drops delivered</span></div>
              </div>
            );
          })}
          {!todayTrips.length && <EmptyState icon={Truck} title="No trips scheduled" description="Plan the next route from the dispatch board." />}
        </div>
        <Link href="/dispatch" className="mt-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-medium text-primary transition-colors hover:bg-accent">Open dispatch board <ArrowRight className="size-3.5" /></Link>
      </CardContent>
    </Card>
  );
}

const DELIVERY_FILTERS = ["All deliveries", "In progress", "Delivered", "Exceptions"] as const;
const PAGE_SIZE = 5;

export function DashboardDeliveries() {
  const [filter, setFilter] = useState<(typeof DELIVERY_FILTERS)[number]>("All deliveries");
  const [page, setPage] = useState(0);
  const orders = useAppStore((s) => s.orders);
  const deliveries = useAppStore((s) => s.deliveries);
  const customers = useCustomerMap();
  const deliveriesByOrder = new Map(deliveries.map((delivery) => [delivery.orderId, delivery]));
  const rows = orders.filter((order) => order.deliveryDate === TODAY && isLive(order) && deliveriesByOrder.has(order.id))
    .map((order) => ({ order, delivery: deliveriesByOrder.get(order.id)!, customer: customers.get(order.customerId) }))
    .sort((a, b) => a.delivery.eta.localeCompare(b.delivery.eta));
  const filtered = rows.filter(({ delivery }) => {
    if (filter === "Delivered") return delivery.status === "Delivered";
    if (filter === "Exceptions") return delivery.status === "Failed" || delivery.status === "Returned";
    if (filter === "In progress") return !["Delivered", "Failed", "Returned"].includes(delivery.status);
    return true;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex-wrap items-center px-5 pt-5 sm:px-6">
        <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary"><PackageCheck className="size-[18px]" strokeWidth={1.7} /></span><div><CardTitle>Today&apos;s deliveries <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{rows.length}</span></CardTitle><CardDescription>Every stop, organized by arrival time.</CardDescription></div></div>
        <Button variant="ghost" size="sm" asChild><Link href="/deliveries" className="text-xs text-primary">View all deliveries <ArrowUpRight /></Link></Button>
      </CardHeader>
      <div className="flex flex-wrap gap-1 px-5 pb-4 sm:px-6" role="group" aria-label="Filter today's deliveries">
        {DELIVERY_FILTERS.map((value) => <button type="button" key={value} aria-pressed={value === filter} onClick={() => { setFilter(value); setPage(0); }} className={cn("min-h-9 cursor-pointer rounded-lg px-3 text-xs font-medium transition-colors", value === filter ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted")}>{value}</button>)}
      </div>
      <div className="hidden grid-cols-[1.8fr_1fr_0.7fr_1fr_24px] gap-4 border-y bg-muted/40 px-6 py-2.5 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase md:grid" aria-hidden="true"><span>Customer / order</span><span>Delivery area</span><span>Arrival</span><span>Status / amount</span><span /></div>
      <ul className="divide-y" aria-live="polite">
        {visible.map(({ order, delivery, customer }) => (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-muted/40 md:grid-cols-[1.8fr_1fr_0.7fr_1fr_24px] md:px-6">
              <div className="min-w-0"><div className="truncate text-[13px] font-medium group-hover:text-primary">{customer?.name ?? "Customer"}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{order.id} <span className="px-1 text-border">|</span> {orderSummary(order)}</div></div>
              <div className="hidden text-xs text-muted-foreground md:block">{customer ? areaName(customer.areaId) : "—"}</div>
              <div className="flex items-center gap-1.5 text-xs tabular"><Clock3 className="size-3 text-muted-foreground md:hidden" />{fmtTime(delivery.eta)}</div>
              <div className="flex items-center justify-between gap-3 md:block"><StatusBadge status={delivery.status} icon={false} /><div className="text-[11px] text-muted-foreground tabular md:mt-1.5">{peso(orderTotal(order))}</div></div>
              <ArrowUpRight className="size-4 justify-self-end text-muted-foreground/60 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
      {!filtered.length && <div className="px-5 pb-5 pt-3 sm:px-6"><EmptyState icon={PackageCheck} title={filter === "Exceptions" ? "No delivery exceptions" : "No deliveries to show"} description={filter === "Exceptions" ? "No failed or returned deliveries today." : "Try another status to see today's scheduled deliveries."} /></div>}
      <div className="flex items-center justify-between gap-3 border-t px-5 py-3 sm:px-6">
        <p className="text-[11px] text-muted-foreground" role="status">{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} deliveries` : "0 deliveries"}</p>
        <div className="flex items-center gap-1"><Button variant="outline" size="icon" className="size-8" aria-label="Previous deliveries" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" /></Button><span className="px-2 text-[11px] text-muted-foreground tabular">{currentPage + 1} / {pageCount}</span><Button variant="outline" size="icon" className="size-8" aria-label="Next deliveries" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-3.5" /></Button></div>
      </div>
    </Card>
  );
}
