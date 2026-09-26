"use client";

import { useState } from "react";
import Link from "next/link";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { ArrowRight, ArrowUpRight, Boxes, CalendarDays, CheckCheck, CircleDollarSign, Download, HandCoins, PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useDailyRevenue, useInvoices, useStock, useTripMetrics } from "@/hooks/use-data";
import { NOW, TODAY } from "@/data/company";
import { TRUCKS } from "@/data/fleet";
import { orderTotal } from "@/lib/calc";
import { getProductSales, getRoutePerformance, isLive, isRevenue, productFamily } from "@/lib/selectors";
import { fmtDateShort, fmtDay, fmtTime, peso, pesoCompact, pct } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { CapacityBar, EmptyState, SourceBadge } from "@/components/shared/common";
import { ReceivableBadge } from "@/components/shared/status-badge";
import { TrendArea } from "@/components/charts/charts";
import { DashboardDeliveries, DashboardMetric, FleetSnapshot } from "./dashboard-panels";

const REVENUE_PERIODS = [7, 14, 30] as const;

export function DashboardView() {
  const [period, setPeriod] = useState<(typeof REVENUE_PERIODS)[number]>(30);
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const customers = useCustomerMap();
  const invoices = useInvoices();
  const stats = useCustomerStats();
  const tripMetrics = useTripMetrics();
  const stock = useStock();
  const daily = useDailyRevenue();

  const today = orders.filter((o) => o.deliveryDate === TODAY && isLive(o));
  const todaySales = sumBy(today, orderTotal);
  const deliveredOrders = today.filter((o) => o.status === "Delivered");
  const deliveredToday = sumBy(deliveredOrders, orderTotal);
  const todayTrips = trips.filter((t) => t.date === TODAY && t.status !== "Cancelled");
  const todayDeliveries = deliveries.filter((d) => todayTrips.some((t) => t.id === d.tripId));
  const pendingDeliveries = todayDeliveries.filter((d) => !["Delivered", "Failed", "Returned"].includes(d.status));
  const ar = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(invoices.filter((i) => i.daysOverdue > 0), (i) => i.balance);
  const overdueCustomers = [...stats.values()].filter((s) => s.overdue > 0).length;
  const pendingOrders = orders.filter((o) => o.status === "Pending Confirmation").length;
  const shortages = [...stock.values()].filter((s) => s.shortage > 0).length;
  const invValue = sumBy([...stock.values()], (s) => s.value);

  // Use complete calendar days so the reporting period and exported totals agree.
  const endDate = subDays(parseISO(TODAY), 1);
  const startDate = subDays(parseISO(TODAY), period);
  const start = format(startDate, "yyyy-MM-dd");
  const dailyByDate = new Map(daily.map((day) => [day.date, day]));
  const revenueRows = eachDayOfInterval({ start: startDate, end: endDate }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return dailyByDate.get(key) ?? { date: key, revenue: 0, cost: 0, orders: 0 };
  });
  const periodOrders = orders.filter((o) => o.deliveryDate >= start && o.deliveryDate < TODAY && !o.notes?.startsWith("Opening balance"));
  const revenue = sumBy(revenueRows, (d) => d.revenue);
  const cost = sumBy(revenueRows, (d) => d.cost);
  const deliveredCount = sumBy(revenueRows, (d) => d.orders);
  const margin = revenue ? (revenue - cost) / revenue : 0;
  const routes = getRoutePerformance(trips.filter((t) => t.date >= start && t.date < TODAY), tripMetrics);
  const families = new Map<string, number>();
  for (const product of getProductSales(periodOrders)) {
    const family = productFamily(product.productId);
    families.set(family, (families.get(family) ?? 0) + product.revenue);
  }
  const familyRows = [...families.entries()].sort((a, b) => b[1] - a[1]);
  const familyTotal = sumBy(familyRows, ([, value]) => value);
  const topOverdue = [...stats.entries()].filter(([, s]) => s.overdue > 0).sort((a, b) => b[1].overdue - a[1].overdue).slice(0, 4);
  const customerOrders = new Map<string, number>();
  for (const order of periodOrders.filter(isRevenue)) customerOrders.set(order.customerId, (customerOrders.get(order.customerId) ?? 0) + 1);
  const repeatCustomers = [...customerOrders.values()].filter((count) => count >= 2).length;

  function exportReport() {
    const csv = ["Date,Delivered revenue (PHP),Product cost (PHP),Delivered orders", ...revenueRows.map((day) => `${day.date},${day.revenue.toFixed(2)},${day.cost.toFixed(2)},${day.orders}`)].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradeloop-revenue-${start}-to-${format(endDate, "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Revenue report exported", { description: `${period} days of delivered sales, product costs, and order counts.` });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase"><span className="size-1.5 rounded-full bg-primary" />Your business at a glance</div>
          <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-[28px]">Operations overview</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">A clear view of your sales, deliveries, and what needs attention.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 bg-card text-xs" onClick={exportReport}><Download className="size-3.5" />Export report</Button>
          <Button asChild className="h-10 px-4 text-xs shadow-sm"><Link href="/orders/new"><Plus className="size-4" />Create order</Link></Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <nav aria-label="Overview pages" className="flex items-center gap-1 rounded-lg border bg-card p-1 text-xs font-medium">
          <Link href="/dashboard" aria-current="page" className="rounded-md bg-accent px-3.5 py-2 text-primary">Overview</Link>
          <Link href="/command-center" className="rounded-md px-3.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Command center</Link>
          <Link href="/reports" className="rounded-md px-3.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Reports</Link>
        </nav>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarDays className="size-3.5" /><span>{fmtDay(TODAY)}, {format(parseISO(TODAY), "yyyy")}</span><span className="mx-1 h-3 border-l" /><span>Demo snapshot · {fmtTime(NOW)}</span></div>
      </div>

      <section aria-label="Today's key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <DashboardMetric label="Today's booked sales" value={peso(todaySales)} icon={CircleDollarSign} featured href="/orders?date=today" detail={`${pesoCompact(deliveredToday)} delivered so far`} footnote={`${today.length} orders scheduled today`} />
        <DashboardMetric label="Orders today" value={today.length} icon={ShoppingCart} href="/orders?date=today" detail={<><span className="font-medium text-primary">{deliveredOrders.length} delivered</span> · {today.length - deliveredOrders.length} remaining</>} footnote="View today's order book" />
        <DashboardMetric label="Pending deliveries" value={pendingDeliveries.length} icon={PackageCheck} href="/deliveries" detail={`Across ${todayTrips.length} scheduled ${todayTrips.length === 1 ? "trip" : "trips"}`} footnote={`${todayDeliveries.filter((d) => d.status === "Delivered").length} of ${todayDeliveries.length} drops completed`} />
        <DashboardMetric label="Accounts receivable" value={pesoCompact(ar)} icon={HandCoins} href="/accounts-receivable" detail={<span className={overdue > 0 ? "text-danger" : "text-primary"}>{pesoCompact(overdue)} overdue</span>} footnote={`${overdueCustomers} ${overdueCustomers === 1 ? "account needs" : "accounts need"} follow-up`} />
      </section>

      <section aria-label="Needs attention" className="flex flex-col gap-3 rounded-xl border border-[#e9e5d8] bg-[#fbfaf6] px-5 py-4 xl:flex-row xl:items-center xl:gap-6">
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-[#f1ebd9] text-[#8a6d2d]"><CheckCheck className="size-3.5" /></span>Needs attention</div>
        <div className="grid flex-1 gap-3 text-xs sm:grid-cols-3">
          {[{ href: "/orders?status=pending", count: pendingOrders, label: "orders to confirm" }, { href: "/procurement", count: shortages, label: "products to replenish" }, { href: "/accounts-receivable", count: overdueCustomers, label: "overdue accounts" }].map((item) => (
            <Link key={item.href} href={item.href} className="group flex items-center gap-2 text-muted-foreground hover:text-foreground"><span className={cn("font-semibold tabular", item.count ? "text-[#8a6d2d]" : "text-primary")}>{item.count}</span>{item.label}<ArrowRight className="ml-auto size-3.5 text-muted-foreground/60 group-hover:text-primary sm:ml-1" /></Link>
          ))}
        </div>
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="flex-wrap items-center px-5 pt-5 sm:px-6">
            <div><CardTitle>Revenue overview</CardTitle><CardDescription>Delivered sales · {fmtDateShort(start)} – {fmtDateShort(format(endDate, "yyyy-MM-dd"))}</CardDescription></div>
            <div className="flex gap-1 rounded-lg bg-muted/70 p-1" role="group" aria-label="Reporting period">
              {REVENUE_PERIODS.map((days) => <button type="button" key={days} onClick={() => setPeriod(days)} aria-pressed={period === days} className={cn("min-h-8 cursor-pointer rounded-md px-3 text-[11px] font-medium transition-colors", period === days ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{days} days</button>)}
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-5">
            <div className="mb-5 flex flex-wrap items-end gap-x-5 gap-y-3 px-2 sm:gap-x-8 sm:px-1" aria-live="polite">
              <div><div className="text-[30px] leading-none font-semibold tracking-[-0.045em] tabular">{pesoCompact(revenue)}</div><div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />Total revenue</div></div>
              <div className="border-l pl-4 sm:pl-6"><div className="text-lg leading-none font-semibold tabular">{pct(margin, 1)}</div><div className="mt-2 text-[11px] text-muted-foreground">Gross margin</div></div>
              <div><div className="text-lg leading-none font-semibold tabular">{deliveredCount}</div><div className="mt-2 text-[11px] text-muted-foreground">Orders delivered</div></div>
            </div>
            <div role="img" aria-label={`Revenue chart for the last ${period} complete days. Total revenue ${peso(revenue)}, gross margin ${pct(margin, 1)}. Daily values are available through Export report.`}>
              <TrendArea data={revenueRows.map((day) => ({ date: day.date, revenue: day.revenue }))} xKey="date" series={[{ key: "revenue", name: "Delivered revenue", color: "#39866b" }]} height={240} xFormat={fmtDateShort} labelFormat={fmtDateShort} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 border-t px-1 pt-4 text-[11px] text-muted-foreground"><span>Complete days only · excludes today</span><Link href="/reports" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Explore reports <ArrowUpRight className="size-3" /></Link></div>
          </CardContent>
        </Card>
        <FleetSnapshot />
      </div>

      <DashboardDeliveries />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader className="px-5 pt-5 sm:px-6"><div><CardTitle>Top-selling products</CardTitle><CardDescription>Share of product revenue · last {period} days</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/catalog" aria-label="View product catalog"><ArrowUpRight /></Link></Button></CardHeader>
          <CardContent className="px-5 sm:px-6">
            <ul className="space-y-4 pt-1">
              {familyRows.slice(0, 5).map(([label, value], index) => (
                <li key={label} className="flex items-center gap-3"><span className="w-4 shrink-0 text-[11px] text-muted-foreground/70 tabular">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="mb-2 flex justify-between gap-3 text-xs"><span className="font-medium">{label}</span><span className="tabular">{pesoCompact(value)} <span className="ml-2 text-[10px] text-muted-foreground">{pct(familyTotal ? value / familyTotal : 0)}</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${familyTotal ? value / familyTotal * 100 : 0}%`, opacity: 1 - index * 0.13 }} /></div></div></li>
              ))}
            </ul>
            {!familyRows.length && <EmptyState title="No product sales yet" description="Delivered orders will appear here for this period." />}
            <Link href="/inventory" className="mt-5 flex items-center justify-between gap-3 border-t pt-4 text-[11px] text-muted-foreground hover:text-primary"><span className="flex items-center gap-2"><Boxes className="size-3.5" />Inventory at cost</span><span className="flex items-center gap-2 font-medium tabular">{pesoCompact(invValue)}<ArrowRight className="size-3.5" /></span></Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="px-5 pt-5 sm:px-6"><div><CardTitle>Collections to follow up</CardTitle><CardDescription>Largest overdue customer balances</CardDescription></div><span className="rounded-md bg-danger-soft px-2 py-1 text-[10px] font-medium text-danger">{overdueCustomers} overdue</span></CardHeader>
          <CardContent className="px-5 sm:px-6">
            <ul className="divide-y">
              {topOverdue.map(([id, customerStats]) => (
                <li key={id}><Link href={`/customers/${id}`} className="flex items-center gap-3 rounded-md py-3 hover:bg-muted/40"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">{customers.get(id)?.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{customers.get(id)?.name}</div><div className="mt-1 text-[10px] text-muted-foreground">{pesoCompact(customerStats.outstanding)} total outstanding</div></div><div className="shrink-0 text-right"><div className="mb-1 text-xs font-semibold tabular">{peso(customerStats.overdue)}</div><ReceivableBadge daysOverdue={customerStats.oldestOverdueDays} balance={customerStats.overdue} /></div></Link></li>
              ))}
            </ul>
            {!topOverdue.length && <EmptyState icon={CheckCheck} title="All caught up" description="There are no overdue customer balances." />}
            <Link href="/accounts-receivable" className="mt-3 flex items-center justify-between gap-2 border-t pt-4 text-[11px] font-medium text-primary">View accounts receivable<ArrowRight className="size-3.5" /></Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-wrap items-center px-5 pt-5 sm:px-6"><div><CardTitle>Route performance</CardTitle><CardDescription>Outbound sales and return loads · last {period} days</CardDescription></div><Button variant="ghost" size="sm" asChild><Link href="/reports" className="text-xs text-primary">View report <ArrowUpRight /></Link></Button></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-xs">
            <caption className="sr-only">Route revenue, costs, capacity utilization, and margin for the last {period} days.</caption>
            <thead><tr className="border-y bg-muted/40 text-[10px] tracking-[0.05em] text-muted-foreground uppercase"><th scope="col" className="px-6 py-3 text-left font-medium">Route</th><th scope="col" className="px-3 py-3 text-right font-medium">Trips</th><th scope="col" className="px-3 py-3 text-right font-medium">Revenue / value</th><th scope="col" className="px-3 py-3 text-right font-medium">Cost</th><th scope="col" className="w-36 px-4 py-3 text-left font-medium">Utilization</th><th scope="col" className="px-6 py-3 text-right font-medium">Margin</th></tr></thead>
            <tbody className="divide-y">
              {[...routes.outbound.slice(0, 4), ...routes.inbound.slice(0, 2)].map((route) => (
                <tr key={route.direction + route.key} className="hover:bg-muted/30"><th scope="row" className="px-6 py-3.5 text-left font-normal"><div className="font-medium">{route.label}</div><div className="mt-1 text-[10px] text-muted-foreground">{route.direction === "outbound" ? "Outbound delivery" : "Backhaul · expected resale value"}</div></th><td className="px-3 py-3.5 text-right tabular">{route.trips}</td><td className="px-3 py-3.5 text-right font-medium tabular">{pesoCompact(route.revenue)}</td><td className="px-3 py-3.5 text-right text-muted-foreground tabular">{pesoCompact(route.cost)}</td><td className="px-4 py-3.5"><div className="mb-1.5 text-[10px] tabular">{pct(route.utilization)}</div><CapacityBar used={route.utilization * 100} capacity={100} showNumbers={false} size="sm" /></td><td className={cn("px-6 py-3.5 text-right font-medium tabular", route.margin >= 0 ? "text-primary" : "text-danger")}>{pct(route.margin, 1)}</td></tr>
              ))}
              {!routes.outbound.length && !routes.inbound.length && <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No route activity in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <section aria-label="Business health" className="rounded-xl border bg-card px-5 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Business health</h2><span className="text-[11px] text-muted-foreground">Last {period} complete days</span></div>
        <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {[["Average order value", peso(deliveredCount ? revenue / deliveredCount : 0)], ["Revenue per truck", pesoCompact(revenue / Math.max(1, TRUCKS.length))], ["Repeat customers", pct(customerOrders.size ? repeatCustomers / customerOrders.size : 0)], ["Active customers", customerOrders.size.toLocaleString()]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1.5 text-xl font-semibold tracking-tight tabular">{value}</dd></div>)}
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-[11px] text-muted-foreground"><span>Orders by source</span>{(["Facebook Messenger", "Phone", "Repeat Order", "Customer Portal", "Salesperson", "Facebook Lead"] as const).map((source) => <span key={source} className="inline-flex items-center gap-1.5"><SourceBadge source={source} short /><span className="tabular">{periodOrders.filter((o) => isLive(o) && o.source === source).length}</span></span>)}</div>
      </section>
      <div className="flex flex-wrap justify-between gap-2 pb-1 text-[10px] text-muted-foreground"><span>TradeLoop · Lucena Fresh Trading & Logistics</span><span>All amounts in PHP · Fictional demo data</span></div>
    </div>
  );
}
