"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, CircleDollarSign, ClipboardList, Clock, HandCoins, Inbox, PackageCheck, PackageOpen, Truck, Undo2, Warehouse, Home, ShoppingCart, type LucideIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices, useStock, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW, NOW } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { truckById } from "@/data/fleet";
import { routeById, areaName } from "@/data/areas";
import { orderCost, orderTotal, poTotal } from "@/lib/calc";
import { buildTripStops, isLive, unassignedTruckOrders } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtTime, kg, peso, pesoCompact, pct, qty } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CapacityBar, MoneyDisplay, PageHeader } from "@/components/shared/common";
import { StatusBadge, ReceivableBadge } from "@/components/shared/status-badge";

interface FlowStep {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  href: string;
  state: "done" | "active" | "attention" | "pending";
}

export function CommandCenter() {
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const pos = useAppStore((s) => s.purchaseOrders);
  const payments = useAppStore((s) => s.payments);
  const customersList = useAppStore((s) => s.customers);
  const customers = useCustomerMap();
  const metrics = useTripMetrics();
  const stock = useStock();
  const invoices = useInvoices();
  const stats = useCustomerStats();

  const today = orders.filter((o) => o.deliveryDate === TODAY && isLive(o));
  const receivedToday = orders.filter((o) => o.createdAt.startsWith(TODAY));
  const confirmed = today.filter((o) => o.status !== "Pending Confirmation");
  const pending = orders.filter((o) => o.status === "Pending Confirmation");
  const todayTrips = trips.filter((t) => t.date === TODAY);
  const todayDeliveries = deliveries.filter((d) => todayTrips.some((t) => t.id === d.tripId));
  const delivered = todayDeliveries.filter((d) => d.status === "Delivered");
  const inTransit = todayDeliveries.filter((d) => d.status === "In Transit" || d.status === "Scheduled" || d.status === "Arrived");
  const loading = todayDeliveries.filter((d) => d.status === "Loading");
  const shortages = [...stock.values()].filter((s) => s.shortage > 0).sort((a, b) => b.shortage - a.shortage);
  const reservedKg = sumBy([...stock.values()], (s) => s.reserved * productById(s.productId).unitWeightKg);
  const todayPOs = pos.filter((p) => p.tripId && todayTrips.some((t) => t.id === p.tripId));
  const backhaulKg = sumBy(todayTrips, (t) => metrics.get(t.id)!.returnLoadKg);
  const todaySales = sumBy(today, orderTotal);
  const todayCost = sumBy(today, orderCost) + sumBy(todayTrips, (t) => metrics.get(t.id)!.tripCost);
  const expectedMargin = todaySales - todayCost;

  // Collections expected today: COD on today's orders not yet paid + credit invoices due today
  const invByOrder = new Map(invoices.map((i) => [i.orderId, i]));
  const codDue = today.filter((o) => o.paymentTerms === "COD").reduce((s, o) => s + (invByOrder.get(o.id)?.balance ?? orderTotal(o)), 0);
  const dueToday = invoices.filter((i) => i.dueDate === TODAY && i.balance > 0);
  const collectedToday = sumBy(payments.filter((p) => p.date.startsWith(TODAY)), (p) => p.amount);
  const overdueTotal = sumBy(invoices.filter((i) => i.daysOverdue > 0), (i) => i.balance);

  // Late deliveries: ETA past receiving window end
  const late = todayDeliveries
    .filter((d) => d.status !== "Delivered")
    .map((d) => {
      const o = orders.find((x) => x.id === d.orderId)!;
      const end = o.deliveryWindow?.match(/–\s*(\d{1,2}):(\d{2})\s*(AM|PM|NN)/);
      if (!end) return null;
      let h = Number(end[1]) % 12;
      if (end[3] === "PM") h += 12;
      if (end[3] === "NN") h = 12;
      const endTime = `${TODAY}T${String(h).padStart(2, "0")}:${end[2]}`;
      const etaTime = d.eta;
      return etaTime > endTime ? { d, o, lateBy: Math.round((new Date(etaTime).getTime() - new Date(endTime).getTime()) / 60000) } : null;
    })
    .filter(Boolean) as { d: (typeof todayDeliveries)[number]; o: (typeof orders)[number]; lateBy: number }[];

  const atRisk = [
    ...pending.map((o) => ({ o, reason: o.notes?.toLowerCase().includes("credit hold") ? "Credit hold — overdue balance" : "Awaiting confirmation" })),
    ...unassignedTruckOrders(orders, TOMORROW)
      .filter((o) => o.status !== "Pending Confirmation")
      .map((o) => ({ o, reason: "Not yet on a truck for tomorrow" })),
    ...late.map((l) => ({ o: l.o, reason: `ETA ${l.lateBy} min past receiving window` })),
  ].slice(0, 7);

  const flow: FlowStep[] = [
    { label: "Orders received", value: String(receivedToday.length), sub: `${today.length} booked for today`, icon: Inbox, href: "/orders?date=today", state: "done" },
    { label: "Orders confirmed", value: `${confirmed.length}/${today.length}`, sub: pending.length ? `+${pending.length} upcoming awaiting confirmation` : "all confirmed", icon: CheckCircle2, href: "/orders?status=pending", state: pending.length ? "attention" : "done" },
    { label: "Stock required", value: kg(sumBy([...stock.values()], (s) => s.demand * productById(s.productId).unitWeightKg)), sub: shortages.length ? `${shortages.length} products short (next 4 days)` : "all covered", icon: Boxes, href: "/procurement", state: shortages.length ? "attention" : "done" },
    { label: "Products reserved", value: kg(reservedKg), sub: "from bodega stock", icon: Warehouse, href: "/inventory", state: "done" },
    { label: "Trucks assigned", value: `${todayTrips.length} trucks`, sub: `${sumBy(todayTrips, (t) => metrics.get(t.id)!.deliveries.length)} drops planned`, icon: Truck, href: "/dispatch", state: "done" },
    { label: "Loading", value: `${loading.length} drops`, sub: todayTrips.filter((t) => t.status === "Loading").map((t) => truckById(t.truckId).code).join(", ") || "none", icon: PackageOpen, href: "/trips", state: loading.length ? "active" : "done" },
    { label: "Deliveries", value: `${delivered.length}/${todayDeliveries.length}`, sub: `${inTransit.length} in transit · ${late.length} at risk of late`, icon: PackageCheck, href: "/deliveries", state: late.length ? "attention" : "active" },
    { label: "Backhaul procurement", value: kg(backhaulKg), sub: `${todayPOs.length} POs · ${pesoCompact(sumBy(todayPOs, poTotal))}`, icon: ClipboardList, href: "/backhaul", state: "active" },
    { label: "Return to Lucena", value: todayTrips.map((t) => fmtTime(t.expectedReturn)).join(" / "), sub: "expected arrival", icon: Home, href: "/trips", state: "pending" },
    { label: "Collections", value: pesoCompact(collectedToday), sub: `${pesoCompact(codDue + sumBy(dueToday, (i) => i.balance))} expected today`, icon: HandCoins, href: "/accounts-receivable", state: "pending" },
  ];

  const topOverdue = [...stats.entries()].filter(([, s]) => s.overdue > 0).sort((a, b) => b[1].overdue - a[1].overdue).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Operations Command Center"
        description={
          <>
            Friday, Sep 25 · live as of <b className="text-foreground">{fmtTime(NOW)}</b> — orders, stock, trucks, backhaul and collections on one screen.
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dispatch">Dispatch Board</Link>
            </Button>
            <Button asChild>
              <Link href="/orders/new">
                <ShoppingCart /> New Order
              </Link>
            </Button>
          </>
        }
      />

      {/* Headline numbers */}
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="bg-[oklch(0.25_0.04_220)] p-4 text-white md:col-span-2">
          <div className="text-[13px] text-white/70">Today&apos;s sales (booked for delivery Sep 25)</div>
          <div className="mt-1 text-4xl font-semibold tracking-tight tabular">{peso(todaySales)}</div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-white/60">Expected margin</div>
              <div className="font-semibold tabular">{pesoCompact(expectedMargin)}</div>
              <div className="text-xs text-white/60">{pct(expectedMargin / Math.max(1, todaySales), 1)} after COGS & trip costs</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Delivered so far</div>
              <div className="font-semibold tabular">{pesoCompact(sumBy(today.filter((o) => o.status === "Delivered"), orderTotal))}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">Collected today</div>
              <div className="font-semibold tabular">{pesoCompact(collectedToday)}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[13px] text-muted-foreground">Truck capacity used today</div>
          <div className="mt-2 grid gap-3">
            {todayTrips.map((t) => {
              const m = metrics.get(t.id)!;
              return (
                <div key={t.id} className="grid gap-1">
                  <div className="flex justify-between text-xs">
                    <Link href={`/trips/${t.id}`} className="font-medium hover:underline">
                      {truckById(t.truckId).code}
                    </Link>
                    <StatusBadge status={t.status} icon={false} className="text-[10px]" />
                  </div>
                  <CapacityBar used={m.outboundLoadKg} capacity={m.capacityKg} label="Out" size="sm" />
                  <CapacityBar used={m.returnLoadKg} capacity={m.capacityKg} label="Return" size="sm" />
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[13px] text-muted-foreground">Outstanding collections</div>
          <div className="mt-1 text-2xl font-semibold tabular">{pesoCompact(sumBy(invoices, (i) => i.balance))}</div>
          <div className="text-sm font-medium text-danger">{peso(overdueTotal)} overdue</div>
          <div className="mt-2 text-xs text-muted-foreground">COD to collect on today&apos;s drops: {peso(codDue)}</div>
          <Button variant="link" size="sm" className="h-auto px-0" asChild>
            <Link href="/accounts-receivable">
              Aging report <ArrowRight />
            </Link>
          </Button>
        </Card>
      </div>

      {/* Business flow */}
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Today&apos;s business flow</CardTitle>
            <CardDescription>From Messenger and phone orders to cash in the bank — click any step to drill down</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {flow.map((s, i) => (
              <li key={s.label} className="relative">
                <Link
                  href={s.href}
                  className={cn(
                    "flex h-full flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-accent/40",
                    s.state === "attention" && "border-[oklch(0.8_0.1_75)] bg-warning-soft/60",
                    s.state === "active" && "border-primary/40 bg-accent/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] tabular">{i + 1}</span>
                      {s.label}
                    </span>
                    <s.icon className={cn("size-4", s.state === "attention" ? "text-[oklch(0.55_0.13_65)]" : s.state === "done" ? "text-[oklch(0.5_0.13_150)]" : "text-primary")} />
                  </div>
                  <div className="text-lg font-semibold tabular">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </Link>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Orders at risk */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-[oklch(0.6_0.14_65)]" /> Orders at risk
              </CardTitle>
              <CardDescription>Needs action before dispatch</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y">
              {atRisk.map(({ o, reason }, i) => (
                <li key={o.id + i}>
                  <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{customers.get(o.customerId)?.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {o.id} · {orderSummary(o)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-warning-soft px-2 py-0.5 text-right text-[11px] font-medium text-[oklch(0.45_0.11_65)]">{reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Late deliveries + live trucks */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-danger" /> Late deliveries
              </CardTitle>
              <CardDescription>ETA beyond the customer&apos;s receiving window</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {late.length === 0 ? (
              <p className="text-sm text-muted-foreground">All drops are on schedule.</p>
            ) : (
              late.map(({ d, o, lateBy }) => (
                <Link key={d.id} href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger-soft/50 p-3 hover:bg-danger-soft">
                  <div>
                    <div className="text-sm font-medium">{customers.get(o.customerId)?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Receiving {o.deliveryWindow} · ETA {fmtTime(d.eta)}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-danger tabular">+{lateBy}m</span>
                </Link>
              ))
            )}
            <div className="grid gap-2 border-t pt-3">
              {todayTrips.map((t) => {
                const m = metrics.get(t.id)!;
                const next = buildTripStops(t, m, customersList).find((s) => s.status === "current");
                return (
                  <Link key={t.id} href={`/trips/${t.id}`} className="flex items-center gap-3 rounded-md p-1.5 text-sm hover:bg-muted/40">
                    <Truck className="size-4 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {truckById(t.truckId).code} · {routeById(t.routeId).name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.status === "Loading" ? `Loading at bodega · departs ${fmtTime(t.departure)}` : next ? `Next: ${next.label} · ETA ${fmtTime(next.eta)}` : "Returning"} · {m.delivered}/{m.deliveries.length} delivered
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Inventory shortages */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" /> Inventory shortages
              </CardTitle>
              <CardDescription>Confirmed demand − bodega stock − incoming POs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/procurement">
                Procure <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {shortages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shortages — all confirmed orders are covered.</p>
            ) : (
              shortages.slice(0, 6).map((s) => {
                const p = productById(s.productId);
                return (
                  <div key={s.productId} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                    <div>
                      <div className="font-medium">{productLabel(p)}</div>
                      <div className="text-xs text-muted-foreground">
                        Demand {qty(s.demand, p.unit)} · stock {qty(s.onHand - s.damaged, p.unit)} · incoming {qty(s.incoming, p.unit)}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold text-danger tabular">−{qty(s.shortage, p.unit)}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {/* Procurement / backhaul */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Undo2 className="size-4 text-[var(--chart-3)]" /> Backhaul procurement today
              </CardTitle>
              <CardDescription>Return-leg pickups hauled back to Lucena for local distribution</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backhaul">
                Backhaul planner <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {todayTrips.map((t) => {
              const m = metrics.get(t.id)!;
              const unused = m.capacityKg - m.returnLoadKg;
              return (
                <div key={t.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{truckById(t.truckId).code}</span>
                    <span className="text-xs text-muted-foreground">
                      {pesoCompact(m.procurementValue)} · {m.pos.length} POs
                    </span>
                  </div>
                  {m.pos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        {p.id} · {areaName(p.pickupAreaId)}
                      </span>
                      <StatusBadge status={p.status} icon={false} />
                    </div>
                  ))}
                  <CapacityBar used={m.returnLoadKg} capacity={m.capacityKg} label="Return load" size="sm" />
                  {unused > 1000 && (
                    <div className="rounded-md bg-accent/60 px-2.5 py-1.5 text-xs">
                      <b>{kg(unused)}</b> unused return capacity — <Link href="/backhaul" className="font-medium text-primary hover:underline">fill it</Link>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Collections */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="size-4 text-primary" /> Top overdue accounts
              </CardTitle>
              <CardDescription>Call before releasing new credit orders</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y">
              {topOverdue.map(([id, s]) => (
                <li key={id}>
                  <Link href={`/customers/${id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0 truncate text-sm font-medium">{customers.get(id)?.name}</div>
                    <div className="grid justify-items-end gap-0.5">
                      <MoneyDisplay amount={s.overdue} className="text-sm font-semibold text-danger" />
                      <ReceivableBadge daysOverdue={s.oldestOverdueDays} balance={s.overdue} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
