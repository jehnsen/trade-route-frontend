"use client";

import Link from "next/link";
import { ArrowRight, Boxes, CircleDollarSign, Gauge, HandCoins, PackageCheck, Route, ShoppingCart, Truck, Undo2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useDailyRevenue, useInvoices, useProductSales, useRoutePerformance, useStock, useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { areaName } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { orderTotal } from "@/lib/calc";
import { isLive, productFamily } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDateShort, fmtTime, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { KPICard, MoneyDisplay, PageHeader, SourceBadge, CapacityBar } from "@/components/shared/common";
import { StatusBadge, ReceivableBadge } from "@/components/shared/status-badge";
import { TruckStatusCard } from "@/components/shared/trip-card";
import { Columns, RankedBars, SERIES } from "@/components/charts/charts";

export function DashboardView() {
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const leads = useAppStore((s) => s.leads);
  const customers = useCustomerMap();
  const invoices = useInvoices();
  const stats = useCustomerStats();
  const tripMetrics = useTripMetrics();
  const stock = useStock();
  const daily = useDailyRevenue();
  const productSales = useProductSales();
  const routes = useRoutePerformance();

  const today = orders.filter((o) => o.deliveryDate === TODAY && isLive(o));
  const todaySales = sumBy(today, orderTotal);
  const deliveredToday = sumBy(today.filter((o) => o.status === "Delivered"), orderTotal);
  const todayTrips = trips.filter((t) => t.date === TODAY);
  const activeTrips = trips.filter((t) => ["In Transit", "Loading", "Returning"].includes(t.status));
  const pendingDeliveries = deliveries.filter((d) => todayTrips.some((t) => t.id === d.tripId) && d.status !== "Delivered");
  const ar = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(invoices.filter((i) => i.daysOverdue > 0), (i) => i.balance);
  const invValue = sumBy([...stock.values()], (s) => s.value);
  const outUtil = todayTrips.length ? sumBy(todayTrips, (t) => tripMetrics.get(t.id)!.outUtil) / todayTrips.length : 0;
  const retUtil = todayTrips.length ? sumBy(todayTrips, (t) => tripMetrics.get(t.id)!.retUtil) / todayTrips.length : 0;

  // Same weekday last week, for context
  const lastWeek = daily.find((d) => d.date === "2026-09-18");

  const last30 = daily.filter((d) => d.date < TODAY).slice(-26);
  const revenue30 = sumBy(last30, (d) => d.revenue);
  const cost30 = sumBy(last30, (d) => d.cost);
  const orders30 = sumBy(last30, (d) => d.orders);
  const week = sumBy(last30.slice(-6), (d) => d.revenue);

  const families = new Map<string, number>();
  for (const p of productSales) families.set(productFamily(p.productId), (families.get(productFamily(p.productId)) ?? 0) + p.revenue);
  const familyRows = [...families.entries()].sort((a, b) => b[1] - a[1]);
  const topFamilies = familyRows.slice(0, 7).map(([label, value]) => ({ label, value }));
  const otherFamilies = sumBy(familyRows.slice(7), ([, v]) => v);
  if (otherFamilies) topFamilies.push({ label: "Other products", value: otherFamilies });

  const topOverdue = [...stats.entries()]
    .filter(([, s]) => s.overdue > 0)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .slice(0, 6);

  const repeatCustomers = [...stats.values()].filter((s) => s.orders >= 2).length;
  const activeCustomers = [...stats.values()].filter((s) => s.orders >= 1).length;
  const leadConv = leads.filter((l) => l.stage === "Won").length / Math.max(1, leads.filter((l) => l.stage === "Won" || l.stage === "Lost").length);

  const deliveryRows = today
    .filter((o) => o.tripId && todayTrips.some((t) => t.id === o.tripId))
    .map((o) => ({ o, d: deliveries.find((x) => x.orderId === o.id) }))
    .sort((a, b) => (a.d?.eta ?? "").localeCompare(b.d?.eta ?? ""));

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description={
          <>
            Friday, September 25, 2026 · <span className="text-foreground">2 trucks out</span> · all orders from Messenger, phone, Facebook and the portal in one place
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/command-center">
                <Gauge /> Command Center
              </Link>
            </Button>
            <Button asChild>
              <Link href="/orders/new">
                <ShoppingCart /> New Order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Today's Sales" value={<MoneyDisplay amount={todaySales} />} icon={CircleDollarSign} delta={lastWeek ? todaySales / lastWeek.revenue - 1 : undefined} hint={<>vs last Friday · {pesoCompact(deliveredToday)} delivered so far</>} href="/orders?date=today" />
        <KPICard label="Orders Today" value={today.length} icon={ShoppingCart} hint={`${today.filter((o) => o.status === "Delivered").length} delivered · ${orders.filter((o) => o.status === "Pending Confirmation").length} awaiting confirmation`} href="/orders?date=today" />
        <KPICard label="Pending Deliveries" value={pendingDeliveries.length} icon={PackageCheck} hint={`across ${todayTrips.length} trips today`} href="/deliveries" tone={pendingDeliveries.length > 10 ? "warning" : "default"} />
        <KPICard label="Active Trips" value={activeTrips.length} icon={Route} hint={activeTrips.map((t) => `${truckById(t.truckId).code}: ${t.status}`).join(" · ")} href="/trips" />
        <KPICard label="Accounts Receivable" value={<MoneyDisplay amount={ar} />} icon={HandCoins} hint={<span className="text-danger">{peso(overdue)} overdue</span>} href="/accounts-receivable" tone="danger" />
        <KPICard label="Inventory Value" value={<MoneyDisplay amount={invValue} />} icon={Boxes} hint="Lucena bodega, at cost" href="/inventory" />
        <KPICard label="Outbound Truck Utilization" value={pct(outUtil)} icon={Truck} hint="today's trips, by load weight" href="/trips" tone="success" />
        <KPICard label="Return Load Utilization" value={pct(retUtil)} icon={Undo2} hint="planned backhaul on today's trips" href="/backhaul" tone={retUtil < 0.5 ? "warning" : "success"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Today&apos;s Deliveries</CardTitle>
              <CardDescription>Truck drops for Friday, Sep 25 — sorted by ETA</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deliveries">
                All deliveries <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2 sm:px-0">
            <ul className="divide-y">
              {deliveryRows.map(({ o, d }) => {
                const c = customers.get(o.customerId)!;
                const trip = trips.find((t) => t.id === o.tripId)!;
                return (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-muted/40 sm:grid-cols-[150px_1fr_110px_110px_130px] sm:px-5">
                      <div className="text-[13px] font-medium">
                        {o.id}
                        <div className="text-xs font-normal text-muted-foreground">ETA {d ? fmtTime(d.eta) : "—"}</div>
                      </div>
                      <div className="order-first col-span-2 min-w-0 sm:order-none sm:col-span-1">
                        <div className="truncate text-sm font-medium">{c.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {areaName(c.areaId)} · {orderSummary(o)}
                        </div>
                      </div>
                      <MoneyDisplay amount={orderTotal(o)} className="text-sm font-medium sm:text-right" />
                      <div className="hidden text-xs text-muted-foreground sm:block">{truckById(trip.truckId).code}</div>
                      <div className="justify-self-end">{d && <StatusBadge status={d.status} />}</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          {["TRK-01", "TRK-02"].map((id) => (
            <TruckStatusCard key={id} truckId={id} trip={todayTrips.find((t) => t.truckId === id)} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue — last 30 days</CardTitle>
              <CardDescription>
                Delivered sales per operating day · {pesoCompact(revenue30)} total · gross margin {pct((revenue30 - cost30) / revenue30, 1)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns
              data={last30.map((d) => ({ date: d.date, Revenue: d.revenue, "Product cost": d.cost }))}
              xKey="date"
              series={[{ key: "Revenue", name: "Revenue" }]}
              xFormat={(l) => fmtDateShort(l)}
              labelFormat={(l) => fmtDateShort(l)}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Product sales distribution</CardTitle>
              <CardDescription>Revenue by product family, last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RankedBars data={topFamilies} valueFormat={pesoCompact} colorBy={(label) => (["Red Onion", "Garlic", "Ginger", "White Onion", "Niyog", "Saba", "Kamote", "Other products"].includes(label) ? SERIES[2] : SERIES[0])} />
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: SERIES[0] }} /> Seafood
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: SERIES[2] }} /> Agricultural
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Route performance</CardTitle>
              <CardDescription>Last 30 days · outbound sales legs and backhaul return legs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/reports">
                Reports <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 sm:px-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium sm:px-5">Route</th>
                  <th className="px-2 py-2 text-right font-medium">Trips</th>
                  <th className="px-2 py-2 text-right font-medium">Revenue / value</th>
                  <th className="px-2 py-2 text-right font-medium">Cost</th>
                  <th className="w-32 px-2 py-2 text-left font-medium">Utilization</th>
                  <th className="px-4 py-2 text-right font-medium sm:px-5">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...routes.outbound.slice(0, 5), ...routes.inbound.slice(0, 3)].map((r) => (
                  <tr key={r.direction + r.key}>
                    <td className="px-4 py-2 sm:px-5">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.direction === "outbound" ? "Outbound sales" : "Backhaul (resale value vs purchase)"}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular">{r.trips}</td>
                    <td className="px-2 py-2 text-right tabular">{pesoCompact(r.revenue)}</td>
                    <td className="px-2 py-2 text-right tabular text-muted-foreground">{pesoCompact(r.cost)}</td>
                    <td className="px-2 py-2">
                      <CapacityBar used={r.utilization * 100} capacity={100} showNumbers={false} size="sm" />
                      <div className="mt-0.5 text-xs tabular text-muted-foreground">{pct(r.utilization)}</div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular sm:px-5">{pct(r.margin, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Outstanding receivables</CardTitle>
              <CardDescription>Customers with overdue balances</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts-receivable">
                Aging <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y">
              {topOverdue.map(([id, s]) => (
                <li key={id}>
                  <Link href={`/customers/${id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{customers.get(id)?.name}</div>
                      <div className="text-xs text-muted-foreground">Total outstanding {peso(s.outstanding)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-danger tabular">{peso(s.overdue)}</div>
                      <ReceivableBadge daysOverdue={s.oldestOverdueDays} balance={s.overdue} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Business health — last 30 days</CardTitle>
            <CardDescription>Since TradeLoop go-live on Aug 26, 2026</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
            {[
              ["Monthly revenue", pesoCompact(revenue30)],
              ["Weekly revenue", pesoCompact(week)],
              ["Gross margin", pct((revenue30 - cost30) / revenue30, 1)],
              ["Avg. order value", peso(revenue30 / Math.max(1, orders30))],
              ["Revenue per truck", pesoCompact(revenue30 / 2)],
              ["Lead conversion", pct(leadConv)],
              ["Repeat customers", pct(repeatCustomers / Math.max(1, activeCustomers))],
              ["Orders delivered", orders30.toLocaleString()],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            Order sources this month:
            {(["Facebook Messenger", "Phone", "Repeat Order", "Customer Portal", "Salesperson", "Facebook Lead"] as const).map((src) => (
              <span key={src} className="inline-flex items-center gap-1">
                <SourceBadge source={src} short /> <span className="tabular">{orders.filter((o) => o.source === src && o.deliveryDate >= "2026-08-26").length}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
