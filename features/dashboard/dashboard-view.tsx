"use client";

import { useState } from "react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Download,
  Gauge,
  HandCoins,
  ShoppingCart,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  useCustomerMap,
  useDailyRevenue,
  useSalesCustomerStats,
  useSalesInvoices,
  useStock,
} from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { areaName } from "@/data/areas";
import { orderTotal } from "@/lib/calc";
import { getProductSales, isLive, productFamily } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDateShort, peso, pesoCompact, pct } from "@/lib/format";
import { cn, downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import {
  EmptyState,
  MoneyDisplay,
  PageHeader,
  SourceBadge,
} from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { Columns, RankedBars } from "@/components/charts/charts";
import { DashboardMetric } from "./dashboard-panels";

/** Trading module (Phase 2 preview): product sales, stock value and sales receivables. */
export function DashboardView() {
  const [period, setPeriod] = useState(30);
  const orders = useAppStore((s) => s.orders);
  const customers = useCustomerMap();
  const invoices = useSalesInvoices();
  const stats = useSalesCustomerStats();
  const stock = useStock();
  const daily = useDailyRevenue();

  const today = orders.filter((o) => o.deliveryDate === TODAY && isLive(o));
  const todaySales = sumBy(today, orderTotal);
  const ar = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(
    invoices.filter((i) => i.daysOverdue > 0),
    (i) => i.balance,
  );
  const invValue = sumBy([...stock.values()], (s) => s.value);
  const start = format(subDays(parseISO(TODAY), period), "yyyy-MM-dd");
  const dailyMap = new Map(daily.map((day) => [day.date, day]));
  const last30 = eachDayOfInterval({
    start: parseISO(start),
    end: subDays(parseISO(TODAY), 1),
  }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    return dailyMap.get(key) ?? { date: key, revenue: 0, cost: 0, orders: 0 };
  });
  const productSales = getProductSales(
    orders.filter(
      (order) =>
        order.deliveryDate >= start &&
        order.deliveryDate < TODAY &&
        !order.notes?.startsWith("Opening balance"),
    ),
  );
  const revenue30 = sumBy(last30, (d) => d.revenue);
  const cost30 = sumBy(last30, (d) => d.cost);
  const orders30 = sumBy(last30, (d) => d.orders);

  const families = new Map<string, number>();
  for (const product of productSales) {
    const family = productFamily(product.productId);
    families.set(family, (families.get(family) ?? 0) + product.revenue);
  }
  const familyRows = [...families.entries()].sort((a, b) => b[1] - a[1]);
  const topFamilies = familyRows
    .slice(0, 7)
    .map(([label, value]) => ({ label, value }));
  const topOverdue = [...stats.entries()]
    .filter(([, s]) => s.overdue > 0)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .slice(0, 6);

  return (
    <div className="ops-enter">
      <div className="ops-eyebrow mb-2">
        Commerce workspace · Trading preview
      </div>
      <PageHeader
        title="Trading Dashboard"
        description="Your sales, stock and customer balances. All in one view."
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
        <DashboardMetric
          label="Today's product sales"
          value={pesoCompact(todaySales)}
          icon={CircleDollarSign}
          detail={`${today.length} scheduled sales orders`}
          footnote="View today's orders"
          href="/orders?date=today"
          featured
        />
        <DashboardMetric
          label="Sales orders today"
          value={String(today.length).padStart(2, "0")}
          icon={ShoppingCart}
          detail={`${orders.filter((o) => o.status === "Pending Confirmation").length} awaiting confirmation`}
          footnote="Manage sales orders"
          href="/orders?date=today"
        />
        <DashboardMetric
          label="Sales receivables"
          value={pesoCompact(ar)}
          icon={HandCoins}
          detail={
            <span className="text-danger">{pesoCompact(overdue)} overdue</span>
          }
          footnote="Review customer balances"
          href="/customers"
        />
        <DashboardMetric
          label="Inventory value"
          value={pesoCompact(invValue)}
          icon={Boxes}
          detail="Lucena warehouse · valued at cost"
          footnote="Explore inventory"
          href="/inventory"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Sales performance</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {fmtDateShort(start)} –{" "}
            {fmtDateShort(format(subDays(parseISO(TODAY), 1), "yyyy-MM-dd"))} ·
            completed calendar days
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex rounded-lg border bg-white p-1"
            role="group"
            aria-label="Sales reporting period"
          >
            {[7, 14, 30].map((days) => (
              <button
                type="button"
                key={days}
                aria-pressed={period === days}
                onClick={() => setPeriod(days)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-[11px]",
                  period === days
                    ? "bg-accent font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {days} days
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Export sales performance"
            onClick={() =>
              downloadCsv(`tradeloop-sales-${period}-days.csv`, [
                ["Date", "Revenue PHP", "Cost PHP", "Orders"],
                ...last30.map((day) => [
                  day.date,
                  day.revenue,
                  day.cost,
                  day.orders,
                ]),
              ])
            }
          >
            <Download />
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Product sales — last {period} days</CardTitle>
              <CardDescription>
                {pesoCompact(revenue30)} · gross margin{" "}
                {pct((revenue30 - cost30) / Math.max(1, revenue30), 1)} ·{" "}
                {orders30} orders
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns
              data={last30.map((d) => ({ date: d.date, Revenue: d.revenue }))}
              xKey="date"
              series={[{ key: "Revenue", name: "Sales", color: "#76975e" }]}
              xFormat={fmtDateShort}
              labelFormat={fmtDateShort}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sales by product family</CardTitle>
              <CardDescription>
                Last {period} days · before order discounts
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RankedBars
              data={topFamilies}
              valueFormat={pesoCompact}
              colorBy={(label) =>
                [
                  "Red Onion",
                  "Garlic",
                  "Ginger",
                  "White Onion",
                  "Niyog",
                  "Saba",
                  "Kamote",
                ].includes(label)
                  ? "#a8be89"
                  : "#668ab7"
              }
            />
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
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 sm:px-5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {customers.get(o.customerId)?.name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {o.id} ·{" "}
                          {areaName(customers.get(o.customerId)!.areaId)} ·{" "}
                          {orderSummary(o)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <MoneyDisplay
                          amount={orderTotal(o)}
                          className="text-sm font-medium"
                        />
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
                <li
                  key={id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {customers.get(id)?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Outstanding {peso(s.outstanding)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-danger tabular">
                      {peso(s.overdue)}
                    </div>
                    <ReceivableBadge
                      daysOverdue={s.oldestOverdueDays}
                      balance={s.overdue}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t px-4 pt-3 text-xs text-muted-foreground sm:px-5">
              Order sources this month:
              {(
                [
                  "Facebook Messenger",
                  "Phone",
                  "Repeat Order",
                  "Customer Portal",
                  "Salesperson",
                  "Facebook Lead",
                ] as const
              ).map((src) => (
                <span key={src} className="inline-flex items-center gap-1">
                  <SourceBadge source={src} short />{" "}
                  <span className="tabular">
                    {
                      orders.filter(
                        (o) =>
                          o.source === src && o.deliveryDate >= "2026-08-26",
                      ).length
                    }
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
