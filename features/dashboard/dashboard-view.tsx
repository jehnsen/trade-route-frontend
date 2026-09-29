"use client";

import Link from "next/link";
import { ArrowRight, Boxes, CircleDollarSign, Gauge, HandCoins, ShoppingCart } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useDailyRevenue, useProductSales, useSalesCustomerStats, useSalesInvoices, useStock } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { areaName } from "@/data/areas";
import { orderTotal } from "@/lib/calc";
import { isLive, productFamily } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDateShort, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState, KPICard, MoneyDisplay, PageHeader, SourceBadge } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { Columns, RankedBars, SERIES } from "@/components/charts/charts";

/** Trading module (Phase 2 preview): product sales, stock value and sales receivables. */
export function DashboardView() {
  const orders = useAppStore((s) => s.orders);
  const customers = useCustomerMap();
  const invoices = useSalesInvoices();
  const stats = useSalesCustomerStats();
  const stock = useStock();
  const daily = useDailyRevenue();
  const productSales = useProductSales();

  const today = orders.filter((o) => o.deliveryDate === TODAY && isLive(o));
  const todaySales = sumBy(today, orderTotal);
  const lastWeek = daily.find((d) => d.date === "2026-09-18");
  const ar = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(invoices.filter((i) => i.daysOverdue > 0), (i) => i.balance);
  const invValue = sumBy([...stock.values()], (s) => s.value);
  const last30 = daily.filter((d) => d.date < TODAY).slice(-26);
  const revenue30 = sumBy(last30, (d) => d.revenue);
  const cost30 = sumBy(last30, (d) => d.cost);
  const orders30 = sumBy(last30, (d) => d.orders);

  const families = new Map<string, number>();
  for (const p of productSales) families.set(productFamily(p.productId), (families.get(productFamily(p.productId)) ?? 0) + p.revenue);
  const familyRows = [...families.entries()].sort((a, b) => b[1] - a[1]);
  const topFamilies = familyRows.slice(0, 7).map(([label, value]) => ({ label, value }));
  const topOverdue = [...stats.entries()].filter(([, s]) => s.overdue > 0).sort((a, b) => b[1].overdue - a[1].overdue).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Trading Dashboard"
        description="Phase 2 preview — product sales, stock and sales receivables. Freight operations live in the Command Center."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/command-center">
                <Gauge /> Command Center
              </Link>
            </Button>
            <Button asChild>
              <Link href="/orders/new">
                <ShoppingCart /> New sales order
              </Link>
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Today's product sales" value={<MoneyDisplay amount={todaySales} />} icon={CircleDollarSign} delta={lastWeek ? todaySales / lastWeek.revenue - 1 : undefined} hint="vs last Friday" href="/orders?date=today" />
        <KPICard label="Sales orders today" value={today.length} icon={ShoppingCart} hint={`${orders.filter((o) => o.status === "Pending Confirmation").length} awaiting confirmation`} href="/orders?date=today" />
        <KPICard label="Sales receivables" value={<MoneyDisplay amount={ar} />} icon={HandCoins} hint={<span className="text-danger">{peso(overdue)} overdue</span>} tone="danger" />
        <KPICard label="Inventory value" value={<MoneyDisplay amount={invValue} />} icon={Boxes} hint="Lucena bodega, at cost" href="/inventory" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Product sales — last 30 days</CardTitle>
              <CardDescription>
                {pesoCompact(revenue30)} · gross margin {pct((revenue30 - cost30) / Math.max(1, revenue30), 1)} · {orders30} orders
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns data={last30.map((d) => ({ date: d.date, Revenue: d.revenue }))} xKey="date" series={[{ key: "Revenue", name: "Sales" }]} xFormat={fmtDateShort} labelFormat={fmtDateShort} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales by product family</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RankedBars data={topFamilies} valueFormat={pesoCompact} colorBy={(label) => (["Red Onion", "Garlic", "Ginger", "White Onion", "Niyog", "Saba", "Kamote"].includes(label) ? SERIES[2] : SERIES[0])} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Today&apos;s sales orders</CardTitle>
              <CardDescription>Friday, Sep 25</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders?date=today">
                All orders <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            {today.length === 0 ? (
              <EmptyState className="mx-5" title="No sales orders for today." />
            ) : (
              <ul className="divide-y">
                {today.map((o) => (
                  <li key={o.id}>
                    <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{customers.get(o.customerId)?.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {o.id} · {areaName(customers.get(o.customerId)!.areaId)} · {orderSummary(o)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <MoneyDisplay amount={orderTotal(o)} className="text-sm font-medium" />
                        <StatusBadge status={o.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Overdue sales balances</CardTitle>
              <CardDescription>Product sales invoices (SI-…)</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y">
              {topOverdue.map(([id, s]) => (
                <li key={id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{customers.get(id)?.name}</div>
                    <div className="text-xs text-muted-foreground">Outstanding {peso(s.outstanding)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-danger tabular">{peso(s.overdue)}</div>
                    <ReceivableBadge daysOverdue={s.oldestOverdueDays} balance={s.overdue} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t px-4 pt-3 text-xs text-muted-foreground sm:px-5">
              Order sources this month:
              {(["Facebook Messenger", "Phone", "Repeat Order", "Customer Portal", "Salesperson", "Facebook Lead"] as const).map((src) => (
                <span key={src} className="inline-flex items-center gap-1">
                  <SourceBadge source={src} short /> <span className="tabular">{orders.filter((o) => o.source === src && o.deliveryDate >= "2026-08-26").length}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
