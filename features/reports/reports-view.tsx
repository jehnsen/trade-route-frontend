"use client";

import * as React from "react";
import { BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useDailyRevenue, useInvoices, useProductSales, useRoutePerformance, useTripMetrics } from "@/hooks/use-data";
import { TRUCKS, truckById } from "@/data/fleet";
import { areaById, routeById } from "@/data/areas";
import { productById, productLabel } from "@/data/products";
import { SUPPLIERS } from "@/data/suppliers";
import { agingBucket, orderBilledAmount, poKg, poTotal } from "@/lib/calc";
import { isRevenue, productFamily } from "@/lib/selectors";
import { fmtDateShort, kg, peso, pesoCompact, pct } from "@/lib/format";
import { cn, downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/common";
import { Columns, RankedBars, TrendLines, SERIES } from "@/components/charts/charts";
import { LEAD_SOURCES, STAGES } from "@/features/leads/leads-view";
import { BUCKETS } from "@/features/finance/receivables-view";

type Row = (string | number)[];
interface Report {
  key: string;
  title: string;
  question: string;
  group: "Sales" | "Logistics" | "Procurement" | "Finance" | "Growth";
}

const REPORTS: Report[] = [
  { key: "date", title: "Sales by Date", question: "How are daily sales trending?", group: "Sales" },
  { key: "product", title: "Sales by Product", question: "Which products bring in the most revenue?", group: "Sales" },
  { key: "customer", title: "Sales by Customer", question: "Who are our biggest buyers, and how concentrated is revenue?", group: "Sales" },
  { key: "area", title: "Sales by Area", question: "Which delivery areas matter most?", group: "Sales" },
  { key: "route", title: "Revenue by Route", question: "Which truck routes earn the most per trip?", group: "Logistics" },
  { key: "trip", title: "Trip Profitability", question: "What does each trip contribute after product cost and trip expenses?", group: "Logistics" },
  { key: "truck", title: "Truck Utilization", question: "How full are the trucks leaving Lucena?", group: "Logistics" },
  { key: "backhaul", title: "Backhaul Utilization", question: "How much of the return leg do we use?", group: "Logistics" },
  { key: "spend", title: "Procurement Spending", question: "Where does our purchasing money go?", group: "Procurement" },
  { key: "supplier", title: "Supplier Performance", question: "Which suppliers are reliable and well-priced?", group: "Procurement" },
  { key: "ar", title: "Accounts Receivable", question: "How much is owed, and how old is it?", group: "Finance" },
  { key: "growth", title: "Customer Growth", question: "How fast is the customer base growing?", group: "Growth" },
  { key: "leads", title: "Facebook Lead Conversion", question: "Which lead sources turn into customers?", group: "Growth" },
];

export function ReportsView() {
  const [active, setActive] = React.useState("date");
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const pos = useAppStore((s) => s.purchaseOrders);
  const leads = useAppStore((s) => s.leads);
  const customersList = useAppStore((s) => s.customers);
  const customers = useCustomerMap();
  const daily = useDailyRevenue();
  const productSales = useProductSales();
  const stats = useCustomerStats();
  const routes = useRoutePerformance();
  const metrics = useTripMetrics();
  const invoices = useInvoices();
  const report = REPORTS.find((r) => r.key === active)!;

  const completed = trips.filter((t) => t.status === "Completed");
  const revenue30 = sumBy(daily.filter((d) => d.date < "2026-09-25"), (d) => d.revenue);

  let body: React.ReactNode = null;
  let table: { head: string[]; rows: Row[]; align?: ("r" | "l")[] } = { head: [], rows: [] };

  switch (active) {
    case "date": {
      const d = daily.filter((x) => x.date < "2026-09-25");
      body = <Columns data={d.map((x) => ({ date: x.date, Revenue: x.revenue }))} xKey="date" series={[{ key: "Revenue", name: "Revenue" }]} xFormat={fmtDateShort} labelFormat={fmtDateShort} height={280} />;
      table = { head: ["Date", "Orders", "Revenue", "Product cost", "Gross margin"], rows: [...d].reverse().map((x) => [fmtDateShort(x.date), x.orders, peso(x.revenue), peso(x.cost), pct((x.revenue - x.cost) / x.revenue, 1)]), align: ["l", "r", "r", "r", "r"] };
      break;
    }
    case "product": {
      const fam = new Map<string, number>();
      for (const p of productSales) fam.set(productFamily(p.productId), (fam.get(productFamily(p.productId)) ?? 0) + p.revenue);
      body = <RankedBars data={[...fam.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} valueFormat={pesoCompact} />;
      table = { head: ["Product", "SKU", "Quantity", "Revenue", "Share"], rows: productSales.map((p) => [productLabel(productById(p.productId)), productById(p.productId).sku, `${Math.round(p.quantity).toLocaleString()} ${productById(p.productId).unit === "pc" ? "pcs" : "kg"}`, peso(p.revenue), pct(p.revenue / revenue30, 1)]), align: ["l", "l", "r", "r", "r"] };
      break;
    }
    case "customer": {
      const list = [...stats.entries()].filter(([, s]) => s.windowSales > 0).sort((a, b) => b[1].windowSales - a[1].windowSales);
      const top5 = sumBy(list.slice(0, 5), ([, s]) => s.windowSales) / Math.max(1, sumBy(list, ([, s]) => s.windowSales));
      body = (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Top 5 customers account for <b className="text-foreground">{pct(top5)}</b> of sales in the last 30 days.
          </p>
          <RankedBars data={list.slice(0, 10).map(([id, s]) => ({ label: customers.get(id)!.name, value: s.windowSales, sub: customers.get(id)!.type }))} valueFormat={pesoCompact} />
        </div>
      );
      table = { head: ["Customer", "Type", "Orders", "Sales (30 days)", "Avg order", "Outstanding"], rows: list.map(([id, s]) => [customers.get(id)!.name, customers.get(id)!.type, s.orders, peso(s.windowSales), peso(s.avgOrder), peso(s.outstanding)]), align: ["l", "l", "r", "r", "r", "r"] };
      break;
    }
    case "area": {
      const m = new Map<string, number>();
      for (const o of orders) if (isRevenue(o)) { const a = areaById(customers.get(o.customerId)!.areaId); m.set(a.name, (m.get(a.name) ?? 0) + orderBilledAmount(o)); }
      const rows = [...m.entries()].sort((a, b) => b[1] - a[1]);
      body = <RankedBars data={rows.slice(0, 12).map(([label, value]) => ({ label, value, sub: areaById([...customersList].find((c) => areaById(c.areaId).name === label)!.areaId).region }))} valueFormat={pesoCompact} />;
      table = { head: ["Area", "Revenue", "Share"], rows: rows.map(([a, v]) => [a, peso(v), pct(v / revenue30, 1)]), align: ["l", "r", "r"] };
      break;
    }
    case "route": {
      body = <RankedBars data={routes.outbound.map((r) => ({ label: r.label, value: r.revenue / r.trips, sub: `${r.trips} trips` }))} valueFormat={pesoCompact} />;
      table = { head: ["Route", "Trips", "Revenue", "Revenue / trip", "Cost", "Utilization", "Margin"], rows: routes.outbound.map((r) => [r.label, r.trips, peso(r.revenue), peso(r.revenue / r.trips), peso(r.cost), pct(r.utilization), pct(r.margin, 1)]), align: ["l", "r", "r", "r", "r", "r", "r"] };
      break;
    }
    case "trip": {
      const rows = completed.map((t) => ({ t, m: metrics.get(t.id)! })).sort((a, b) => b.t.departure.localeCompare(a.t.departure));
      body = <Columns data={[...rows].reverse().slice(-20).map(({ t, m }) => ({ trip: t.id.replace("TRIP-", ""), Contribution: m.contribution }))} xKey="trip" series={[{ key: "Contribution", name: "Contribution" }]} height={260} />;
      table = { head: ["Trip", "Truck", "Route", "Revenue", "Product cost", "Trip cost", "Contribution", "Margin"], rows: rows.map(({ t, m }) => [t.id, truckById(t.truckId).code, routeById(t.routeId).name, peso(m.revenue), peso(m.cogs), peso(m.tripCost), peso(m.contribution), pct(m.contribution / Math.max(1, m.revenue), 1)]), align: ["l", "l", "l", "r", "r", "r", "r", "r"] };
      break;
    }
    case "truck":
    case "backhaul": {
      const key = active === "truck" ? "outUtil" : "retUtil";
      const days = [...new Set(completed.map((t) => t.date))].sort();
      const data = days.map((d) => {
        const row: Record<string, string | number> = { date: d };
        for (const tr of TRUCKS) {
          const t = completed.find((x) => x.date === d && x.truckId === tr.id);
          if (t) row[tr.code] = Math.round(metrics.get(t.id)![key] * 100);
        }
        return row;
      });
      body = <TrendLines data={data} xKey="date" series={TRUCKS.map((t, i) => ({ key: t.code, name: t.code, color: SERIES[i] }))} valueFormat={(v) => `${v}%`} xFormat={fmtDateShort} labelFormat={fmtDateShort} domain={[0, 100]} height={280} />;
      table = {
        head: ["Truck", "Trips", "Average", "Best", "Lowest", active === "truck" ? "Avg load" : "Avg return load"],
        rows: TRUCKS.map((tr) => {
          const own = completed.filter((t) => t.truckId === tr.id).map((t) => metrics.get(t.id)!);
          const vals = own.map((m) => m[key]);
          return [tr.code, own.length, pct(sumBy(vals, (v) => v) / Math.max(1, vals.length)), pct(Math.max(...vals)), pct(Math.min(...vals)), kg(sumBy(own, (m) => (active === "truck" ? m.outboundLoadKg : m.returnLoadKg)) / Math.max(1, own.length))];
        }),
        align: ["l", "r", "r", "r", "r", "r"],
      };
      break;
    }
    case "spend": {
      const valid = pos.filter((p) => p.status !== "Cancelled" && p.status !== "Draft");
      const bySup = SUPPLIERS.map((s) => ({ s, v: sumBy(valid.filter((p) => p.supplierId === s.id), poTotal), kg: sumBy(valid.filter((p) => p.supplierId === s.id), poKg) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
      const backhaul = sumBy(valid.filter((p) => p.tripId), poTotal);
      body = (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            {pesoCompact(sumBy(valid, poTotal))} purchased · {pesoCompact(backhaul)} ({pct(backhaul / Math.max(1, sumBy(valid, poTotal)))}) hauled on our own return legs.
          </p>
          <RankedBars data={bySup.slice(0, 10).map((x) => ({ label: x.s.name, value: x.v, sub: x.s.type }))} valueFormat={pesoCompact} />
        </div>
      );
      table = { head: ["Supplier", "Type", "POs", "Volume", "Spend"], rows: bySup.map((x) => [x.s.name, x.s.type, valid.filter((p) => p.supplierId === x.s.id).length, kg(x.kg), peso(x.v)]), align: ["l", "l", "r", "r", "r"] };
      break;
    }
    case "supplier": {
      const valid = pos.filter((p) => p.status !== "Cancelled" && p.status !== "Draft");
      const rows = SUPPLIERS.map((s) => {
        const own = valid.filter((p) => p.supplierId === s.id);
        const partial = own.filter((p) => p.status === "Partially Received").length;
        const k = sumBy(own, poKg);
        return { s, own, partial, avg: k ? sumBy(own, poTotal) / k : 0 };
      }).filter((r) => r.own.length);
      body = <RankedBars data={rows.sort((a, b) => b.s.reliability - a.s.reliability).map((r) => ({ label: r.s.name, value: r.s.reliability, sub: `${r.own.length} POs` }))} valueFormat={(v) => `${v}%`} />;
      table = { head: ["Supplier", "POs", "Short deliveries", "Avg price/kg", "Reliability"], rows: rows.map((r) => [r.s.name, r.own.length, r.partial, peso(r.avg), `${r.s.reliability}%`]), align: ["l", "r", "r", "r", "r"] };
      break;
    }
    case "ar": {
      const open = invoices.filter((i) => i.balance > 0);
      const total = sumBy(open, (i) => i.balance);
      body = <RankedBars data={BUCKETS.map((b) => ({ label: b.label, value: sumBy(open.filter((i) => agingBucket(i.daysOverdue) === b.key), (i) => i.balance) }))} valueFormat={pesoCompact} colorBy={(l) => BUCKETS.find((b) => b.label === l)!.color} />;
      table = { head: ["Bucket", "Invoices", "Balance", "Share"], rows: BUCKETS.map((b) => { const inv = open.filter((i) => agingBucket(i.daysOverdue) === b.key); return [b.label, inv.length, peso(sumBy(inv, (i) => i.balance)), pct(sumBy(inv, (i) => i.balance) / total)]; }), align: ["l", "r", "r", "r"] };
      break;
    }
    case "growth": {
      const quarters = ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3"];
      const q = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
      const data = quarters.map((qq) => ({ quarter: qq.replace("-", " "), Customers: customersList.filter((c) => q(c.customerSince) <= qq).length, New: customersList.filter((c) => q(c.customerSince) === qq).length }));
      body = <TrendLines data={data} xKey="quarter" series={[{ key: "Customers", name: "Active accounts" }]} height={260} />;
      table = { head: ["Quarter", "New accounts", "Total accounts"], rows: [...data].reverse().map((d) => [d.quarter, d.New, d.Customers]), align: ["l", "r", "r"] };
      break;
    }
    case "leads": {
      const bySource = LEAD_SOURCES.map((s) => {
        const l = leads.filter((x) => x.source === s);
        const won = l.filter((x) => x.stage === "Won").length;
        const closed = l.filter((x) => x.stage === "Won" || x.stage === "Lost").length;
        return { s, n: l.length, won, closed, rate: closed ? won / closed : 0, pipeline: sumBy(l.filter((x) => x.stage !== "Won" && x.stage !== "Lost"), (x) => x.potentialWeeklyValue) };
      }).filter((x) => x.n);
      body = (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium">Pipeline funnel</div>
            <RankedBars data={STAGES.map((st) => ({ label: st, value: leads.filter((l) => l.stage === st).length }))} valueFormat={(v) => `${v} leads`} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Open pipeline by source (₱/week)</div>
            <RankedBars data={bySource.map((x) => ({ label: x.s, value: x.pipeline }))} valueFormat={pesoCompact} color={SERIES[2]} />
          </div>
        </div>
      );
      table = { head: ["Source", "Leads", "Won", "Closed", "Win rate", "Open pipeline / week"], rows: bySource.map((x) => [x.s, x.n, x.won, x.closed, x.closed ? pct(x.rate) : "—", peso(x.pipeline)]), align: ["l", "r", "r", "r", "r", "r"] };
      break;
    }
  }

  return (
    <>
      <PageHeader title="Reports" description="Every report is computed from the same orders, trips, POs, invoices and payments you see elsewhere — no separate spreadsheets." />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="content-start p-2">
          {(["Sales", "Logistics", "Procurement", "Finance", "Growth"] as const).map((g) => (
            <div key={g} className="mb-2">
              <div className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</div>
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <button key={r.key} type="button" onClick={() => setActive(r.key)} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer", active === r.key ? "bg-accent font-medium text-primary" : "hover:bg-muted")}>
                  <BarChart3 className="size-4 shrink-0 opacity-60" />
                  {r.title}
                </button>
              ))}
            </div>
          ))}
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.question} · since go-live, Aug 26 – Sep 24, 2026</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => { downloadCsv(`freshroute-${report.key}.csv`, [table.head, ...table.rows]); toast.success(`${report.title} exported`); }}>
                <Download /> Export CSV
              </Button>
            </CardHeader>
            <CardContent>{body}</CardContent>
          </Card>
          <Card className="overflow-hidden">
            <div className="max-h-[480px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {table.head.map((h, i) => (
                      <TableHead key={h} className={table.align?.[i] === "r" ? "text-right" : ""}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.rows.map((r, i) => (
                    <TableRow key={i}>
                      {r.map((c, j) => (
                        <TableCell key={j} className={cn(table.align?.[j] === "r" && "text-right tabular", j === 0 && "font-medium")}>
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
