"use client";

import * as React from "react";
import { BarChart3, Download } from "lucide-react";
import { toast } from "sonner";
import type { AreaId } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices, useTripMetrics } from "@/hooks/use-data";
import { DRIVERS, TRUCKS, truckById } from "@/data/fleet";
import { areaName, routeById } from "@/data/areas";
import { agingBucket } from "@/lib/calc";
import { fuelEfficiencyByLog, jobTotal, minutesLate } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDateShort, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { cn, downloadCsv, groupBy, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/common";
import { Columns, RankedBars, TrendLines, SERIES } from "@/components/charts/charts";
import { LEAD_SOURCES, STAGES } from "@/features/leads/leads-view";
import { BUCKETS } from "@/features/finance/receivables-view";
import { EXPENSE_CATEGORIES } from "@/features/finance/add-expense-dialog";

type Row = (string | number)[];
type Group = "Profitability" | "Fleet & Utilization" | "Operations" | "Finance" | "Growth";
interface Report {
  key: string;
  title: string;
  question: string;
  group: Group;
}

const REPORTS: Report[] = [
  { key: "trip", title: "Trip Profitability", question: "What does each trip contribute after trip expenses?", group: "Profitability" },
  { key: "revTrip", title: "Revenue by Trip", question: "Which trips carried the most freight revenue?", group: "Profitability" },
  { key: "revRoute", title: "Revenue by Route", question: "Which routes earn the most per trip?", group: "Profitability" },
  { key: "revCustomer", title: "Revenue by Customer", question: "Who are our biggest shippers, and how concentrated is revenue?", group: "Profitability" },
  { key: "customer", title: "Customer Revenue", question: "How much has each account billed, lifetime and this month?", group: "Profitability" },
  { key: "truck", title: "Truck Utilization", question: "How full are the trucks leaving Lucena?", group: "Fleet & Utilization" },
  { key: "backhaul", title: "Backhaul Utilization", question: "How much of the return leg do we use, and with what cargo?", group: "Fleet & Utilization" },
  { key: "empty", title: "Empty Capacity", question: "How much paid capacity drives around empty?", group: "Fleet & Utilization" },
  { key: "fuel", title: "Fuel Cost", question: "What do we spend on diesel, and how efficient are the trucks?", group: "Fleet & Utilization" },
  { key: "maint", title: "Truck Maintenance Cost", question: "What does each truck cost to keep on the road?", group: "Fleet & Utilization" },
  { key: "expenses", title: "Trip Expenses", question: "Where does trip money go?", group: "Operations" },
  { key: "delivery", title: "Delivery Performance", question: "Are we delivering on time and in full?", group: "Operations" },
  { key: "driver", title: "Driver Trip History", question: "How many trips and drops has each driver handled?", group: "Operations" },
  { key: "ar", title: "Receivables Aging", question: "How much freight is owed, and how old is it?", group: "Finance" },
  { key: "leads", title: "Lead Conversion", question: "Which lead sources turn into shipping customers?", group: "Growth" },
];
const GROUPS: Group[] = ["Profitability", "Fleet & Utilization", "Operations", "Finance", "Growth"];
const WINDOW_START = "2026-08-26";

export function ReportsView() {
  const [active, setActive] = React.useState("trip");
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const deliveries = useAppStore((s) => s.deliveries);
  const expenses = useAppStore((s) => s.expenses);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const maintenance = useAppStore((s) => s.maintenance);
  const leads = useAppStore((s) => s.leads);
  const customers = useCustomerMap();
  const stats = useCustomerStats();
  const metrics = useTripMetrics();
  const invoices = useInvoices();
  const report = REPORTS.find((r) => r.key === active)!;

  const completed = trips.filter((t) => t.status === "Completed").sort((a, b) => a.departure.localeCompare(b.departure));
  const cm = (id: string) => metrics.get(id)!;
  const totalRevenue = sumBy(completed, (t) => cm(t.id).revenue);

  let body: React.ReactNode = null;
  let table: { head: string[]; rows: Row[]; align?: ("r" | "l")[] } = { head: [], rows: [] };

  switch (active) {
    case "trip": {
      const recent = completed.slice(-20);
      body = <Columns data={recent.map((t) => ({ trip: t.id.slice(5), Revenue: cm(t.id).revenue, Expenses: cm(t.id).expenseTotal, Contribution: cm(t.id).contribution }))} xKey="trip" series={[{ key: "Revenue", name: "Freight revenue" }, { key: "Expenses", name: "Trip expenses", color: SERIES[3] }, { key: "Contribution", name: "Contribution", color: SERIES[2] }]} height={280} />;
      table = {
        head: ["Trip", "Date", "Truck", "Route", "Revenue", "Expenses", "Contribution", "Margin", "Cost / km"],
        rows: [...completed].reverse().map((t) => [t.id, fmtDateShort(t.date), truckById(t.truckId).code, tripRouteLine(t), peso(cm(t.id).revenue), peso(cm(t.id).expenseTotal), peso(cm(t.id).contribution), pct(cm(t.id).contribution / Math.max(1, cm(t.id).revenue), 1), peso(cm(t.id).costPerKm, true)]),
        align: ["l", "l", "l", "l", "r", "r", "r", "r", "r"],
      };
      break;
    }
    case "revTrip": {
      const sorted = [...completed].sort((a, b) => cm(b.id).revenue - cm(a.id).revenue);
      body = <RankedBars data={sorted.slice(0, 10).map((t) => ({ label: t.id, value: cm(t.id).revenue, sub: `${truckById(t.truckId).code} · ${fmtDateShort(t.date)}` }))} valueFormat={pesoCompact} />;
      table = { head: ["Trip", "Truck", "Jobs", "Kg hauled", "Freight", "Additional", "Revenue / kg"], rows: sorted.map((t) => [t.id, truckById(t.truckId).code, cm(t.id).jobs.length, kg(cm(t.id).outboundKg + cm(t.id).returnKg), peso(cm(t.id).freightRevenue), peso(cm(t.id).additionalCharges), peso(cm(t.id).revenue / Math.max(1, cm(t.id).outboundKg + cm(t.id).returnKg), true)]), align: ["l", "l", "r", "r", "r", "r", "r"] };
      break;
    }
    case "revRoute": {
      const rows = Object.entries(groupBy(completed, (t) => t.routeId)).map(([rid, list]) => ({ route: routeById(rid), n: list.length, revenue: sumBy(list, (t) => cm(t.id).revenue), exp: sumBy(list, (t) => cm(t.id).expenseTotal), out: sumBy(list, (t) => cm(t.id).outUtil) / list.length, ret: sumBy(list, (t) => cm(t.id).retUtil) / list.length }));
      rows.sort((a, b) => b.revenue / b.n - a.revenue / a.n);
      body = <RankedBars data={rows.map((r) => ({ label: r.route.name, value: r.revenue / r.n, sub: `${r.n} trips` }))} valueFormat={pesoCompact} />;
      table = { head: ["Route", "Trips", "Revenue", "Revenue / trip", "Contribution / trip", "Avg outbound", "Avg return"], rows: rows.map((r) => [r.route.name, r.n, peso(r.revenue), peso(r.revenue / r.n), peso((r.revenue - r.exp) / r.n), pct(r.out), pct(r.ret)]), align: ["l", "r", "r", "r", "r", "r", "r"] };
      break;
    }
    case "revCustomer": {
      const list = [...stats.entries()].filter(([, s]) => s.windowRevenue > 0).sort((a, b) => b[1].windowRevenue - a[1].windowRevenue);
      const total = sumBy(list, ([, s]) => s.windowRevenue);
      const top5 = sumBy(list.slice(0, 5), ([, s]) => s.windowRevenue) / Math.max(1, total);
      body = (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Top 5 shippers account for <b className="text-foreground">{pct(top5)}</b> of freight revenue in the last 30 days.
          </p>
          <RankedBars data={list.slice(0, 10).map(([id, s]) => ({ label: customers.get(id)!.name, value: s.windowRevenue, sub: customers.get(id)!.type }))} valueFormat={pesoCompact} />
        </div>
      );
      table = { head: ["Customer", "Type", "Jobs", "Kg shipped", "Freight (30 days)", "Share", "Avg job"], rows: list.map(([id, s]) => [customers.get(id)!.name, customers.get(id)!.type, s.jobs, kg(s.kgShipped), peso(s.windowRevenue), pct(s.windowRevenue / Math.max(1, total), 1), peso(s.avgJob)]), align: ["l", "l", "r", "r", "r", "r", "r"] };
      break;
    }
    case "customer": {
      const list = [...stats.entries()].filter(([, s]) => s.lifetimeRevenue > 0).sort((a, b) => b[1].lifetimeRevenue - a[1].lifetimeRevenue);
      body = <RankedBars data={list.slice(0, 10).map(([id, s]) => ({ label: customers.get(id)!.name, value: s.lifetimeRevenue, sub: `since ${customers.get(id)!.customerSince.slice(0, 7)}` }))} valueFormat={pesoCompact} color={SERIES[1]} />;
      table = { head: ["Customer", "Customer since", "Lifetime freight", "Last 30 days", "Outstanding", "Overdue"], rows: list.map(([id, s]) => [customers.get(id)!.name, customers.get(id)!.customerSince, peso(s.lifetimeRevenue), peso(s.windowRevenue), peso(s.outstanding), peso(s.overdue)]), align: ["l", "l", "r", "r", "r", "r"] };
      break;
    }
    case "truck": {
      const dates = [...new Set(completed.map((t) => t.date))];
      const series = dates.map((d) => {
        const row: Record<string, unknown> = { date: d };
        for (const truck of TRUCKS) {
          const t = completed.find((x) => x.date === d && x.truckId === truck.id);
          if (t) row[truck.id] = Math.round(cm(t.id).outUtil * 100);
        }
        return row;
      });
      body = <TrendLines data={series} xKey="date" series={TRUCKS.map((t) => ({ key: t.id, name: t.code, color: t.color }))} valueFormat={(v) => `${v}%`} xFormat={fmtDateShort} labelFormat={fmtDateShort} domain={[0, 110]} height={260} />;
      table = {
        head: ["Truck", "Trips", "Km", "Avg outbound", "Avg return", "Revenue / km", "Contribution / trip"],
        rows: TRUCKS.map((truck) => {
          const list = completed.filter((t) => t.truckId === truck.id);
          const km = sumBy(list, (t) => cm(t.id).distanceKm);
          return [truck.code, list.length, num(km), pct(sumBy(list, (t) => cm(t.id).outUtil) / Math.max(1, list.length)), pct(sumBy(list, (t) => cm(t.id).retUtil) / Math.max(1, list.length)), peso(sumBy(list, (t) => cm(t.id).revenue) / Math.max(1, km), true), peso(sumBy(list, (t) => cm(t.id).contribution) / Math.max(1, list.length))];
        }),
        align: ["l", "r", "r", "r", "r", "r", "r"],
      };
      break;
    }
    case "backhaul": {
      const byDay = Object.entries(groupBy(completed, (t) => t.date)).map(([date, list]) => ({ date, paid: sumBy(list, (t) => cm(t.id).paidReturnKg), company: sumBy(list, (t) => cm(t.id).companyReturnKg) }));
      body = <Columns data={byDay} xKey="date" stacked series={[{ key: "paid", name: "Paid backhaul (kg)" }, { key: "company", name: "Company-owned (kg)", color: SERIES[2] }]} valueFormat={(v) => `${num(v / 1000)}t`} xFormat={fmtDateShort} labelFormat={fmtDateShort} height={260} />;
      table = {
        head: ["Trip", "Return lane", "Return kg", "Paid kg", "Company kg", "Utilization", "Paid backhaul freight", "Company cargo value"],
        rows: [...completed].reverse().map((t) => [t.id, `${routeById(t.routeId).returnAreas.map(areaName).join(" / ")} → Lucena`, kg(cm(t.id).returnKg), kg(cm(t.id).paidReturnKg), kg(cm(t.id).companyReturnKg), pct(cm(t.id).retUtil), peso(sumBy(cm(t.id).jobs.filter((j) => j.leg === "return"), jobTotal)), peso(cm(t.id).companyCargoValue)]),
        align: ["l", "l", "r", "r", "r", "r", "r", "r"],
      };
      break;
    }
    case "empty": {
      const rows = completed.map((t) => ({ t, out: Math.max(0, cm(t.id).capacityKg - cm(t.id).outboundKg), ret: Math.max(0, cm(t.id).capacityKg - cm(t.id).returnKg) }));
      const byDay = Object.entries(groupBy(rows, (r) => r.t.date)).map(([date, list]) => ({ date, out: sumBy(list, (r) => r.out), ret: sumBy(list, (r) => r.ret) }));
      const totalEmptyKm = sumBy(completed, (t) => cm(t.id).emptyKm);
      body = (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Unused payload across completed trips: <b className="text-foreground">{kg(sumBy(rows, (r) => r.out))}</b> outbound and <b className="text-foreground">{kg(sumBy(rows, (r) => r.ret))}</b> on return legs. {num(totalEmptyKm)} km driven with a completely empty van.
          </p>
          <Columns data={byDay} xKey="date" series={[{ key: "out", name: "Empty outbound (kg)" }, { key: "ret", name: "Empty return (kg)", color: SERIES[3] }]} valueFormat={(v) => `${num(v / 1000)}t`} xFormat={fmtDateShort} labelFormat={fmtDateShort} height={240} />
        </div>
      );
      table = { head: ["Trip", "Truck", "Empty outbound", "Empty return", "Empty km"], rows: [...rows].reverse().map((r) => [r.t.id, truckById(r.t.truckId).code, kg(r.out), kg(r.ret), num(cm(r.t.id).emptyKm)]), align: ["l", "l", "r", "r", "r"] };
      break;
    }
    case "fuel": {
      const eff = fuelEfficiencyByLog(fuelLogs);
      const inWin = fuelLogs.filter((f) => f.date >= WINDOW_START);
      const byDay = Object.entries(groupBy(inWin, (f) => f.date.slice(0, 10))).map(([date, list]) => ({ date, cost: sumBy(list, (f) => f.totalCost) })).sort((a, b) => a.date.localeCompare(b.date));
      body = <Columns data={byDay} xKey="date" series={[{ key: "cost", name: "Diesel cost" }]} xFormat={fmtDateShort} labelFormat={fmtDateShort} height={240} />;
      table = {
        head: ["Truck", "Fill-ups", "Litres", "Diesel cost", "Avg ₱/L", "Avg km/L", "Fuel cost / trip"],
        rows: TRUCKS.map((truck) => {
          const list = inWin.filter((f) => f.truckId === truck.id);
          const effs = list.map((f) => eff.get(f.id)).filter((x): x is number => x !== undefined);
          const tripsFueled = new Set(list.map((f) => f.tripId).filter(Boolean)).size;
          return [truck.code, list.length, num(sumBy(list, (f) => f.liters)), peso(sumBy(list, (f) => f.totalCost)), (sumBy(list, (f) => f.totalCost) / Math.max(1, sumBy(list, (f) => f.liters))).toFixed(2), effs.length ? (sumBy(effs, (x) => x) / effs.length).toFixed(2) : "—", peso(sumBy(list, (f) => f.totalCost) / Math.max(1, tripsFueled))];
        }),
        align: ["l", "r", "r", "r", "r", "r", "r"],
      };
      break;
    }
    case "maint": {
      const done = maintenance.filter((m) => m.status === "Completed");
      const byType = Object.entries(groupBy(done, (m) => m.type)).map(([label, list]) => ({ label, value: sumBy(list, (m) => m.cost) })).sort((a, b) => b.value - a.value);
      body = (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium">By truck (all recorded work)</div>
            <RankedBars data={TRUCKS.map((t) => ({ label: t.code, value: sumBy(done.filter((m) => m.truckId === t.id), (m) => m.cost), sub: `${done.filter((m) => m.truckId === t.id).length} jobs` }))} valueFormat={pesoCompact} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">By type</div>
            <RankedBars data={byType} valueFormat={pesoCompact} color={SERIES[3]} />
          </div>
        </div>
      );
      table = { head: ["Date", "Truck", "Type", "Vendor", "Odometer", "Cost", "Downtime"], rows: [...done].sort((a, b) => b.date.localeCompare(a.date)).map((m) => [m.date, truckById(m.truckId).code, m.type, m.vendor, num(m.odometerKm), peso(m.cost), `${m.downtimeHours ?? 0} h`]), align: ["l", "l", "l", "l", "r", "r", "r"] };
      break;
    }
    case "expenses": {
      const inWin = expenses.filter((e) => e.date >= WINDOW_START && e.tripId);
      const total = sumBy(inWin, (e) => e.amount);
      const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumBy(inWin.filter((e) => e.category === c), (e) => e.amount) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
      body = <RankedBars data={byCat} valueFormat={pesoCompact} />;
      table = { head: ["Category", "Amount", "Share", "Avg per completed trip"], rows: byCat.map((c) => [c.label, peso(c.value), pct(c.value / Math.max(1, total), 1), peso(c.value / Math.max(1, completed.length))]), align: ["l", "r", "r", "r"] };
      break;
    }
    case "delivery": {
      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      const done = deliveries.filter((d) => d.status === "Delivered" || d.status === "Failed" || d.status === "Returned");
      const delivered = done.filter((d) => d.status === "Delivered");
      const onTime = delivered.filter((d) => d.arrivedAt && minutesLate(jobMap.get(d.jobId)!.requiredBy, d.arrivedAt) <= 15);
      const issues = Object.entries(groupBy(deliveries.flatMap((d) => d.issues), (i) => i.type)).map(([label, list]) => ({ label, value: list.length })).sort((a, b) => b.value - a.value);
      const byArea = Object.entries(groupBy(delivered, (d) => jobMap.get(d.jobId)!.dropoff.areaId)).map(([a, list]) => ({ area: areaName(a as AreaId), n: list.length, onTime: list.filter((d) => onTime.includes(d)).length, issues: list.filter((d) => d.issues.length).length }));
      body = (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Deliveries completed" value={pct(delivered.length / Math.max(1, done.length), 1)} sub={`${delivered.length} of ${done.length}`} />
            <Metric label="On time (≤15 min)" value={pct(onTime.length / Math.max(1, delivered.length))} sub={`${onTime.length} drops`} />
            <Metric label="With POD photos" value={pct(delivered.filter((d) => (d.pod?.photoCount ?? 0) > 0).length / Math.max(1, delivered.length))} />
            <Metric label="Issues logged" value={String(sumBy(deliveries, (d) => d.issues.length))} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Issues by type</div>
            <RankedBars data={issues} valueFormat={(v) => `${v}`} color={SERIES[3]} />
          </div>
        </div>
      );
      table = { head: ["Destination area", "Delivered", "On time", "On-time rate", "With issues"], rows: byArea.sort((a, b) => b.n - a.n).map((r) => [r.area, r.n, r.onTime, pct(r.onTime / Math.max(1, r.n)), r.issues]), align: ["l", "r", "r", "r", "r"] };
      break;
    }
    case "driver": {
      const jobMap = new Map(jobs.map((j) => [j.id, j]));
      const rows = DRIVERS.map((d) => {
        const own = completed.filter((t) => t.driverId === d.id);
        const dls = deliveries.filter((x) => own.some((t) => t.id === x.tripId) && x.status === "Delivered");
        const onTime = dls.filter((x) => x.arrivedAt && minutesLate(jobMap.get(x.jobId)!.requiredBy, x.arrivedAt) <= 15).length;
        return { d, trips: own.length, km: sumBy(own, (t) => cm(t.id).distanceKm), drops: dls.length, onTime, issues: sumBy(deliveries.filter((x) => own.some((t) => t.id === x.tripId)), (x) => x.issues.length), last: own[own.length - 1] };
      });
      body = <RankedBars data={rows.map((r) => ({ label: r.d.name, value: r.trips, sub: `${num(r.km)} km` }))} valueFormat={(v) => `${v} trips`} />;
      table = { head: ["Driver", "Trips", "Km driven", "Drops delivered", "On-time rate", "Issues", "Last trip"], rows: rows.map((r) => [r.d.name, r.trips, num(r.km), r.drops, pct(r.onTime / Math.max(1, r.drops)), r.issues, r.last ? `${r.last.id} (${truckById(r.last.truckId).code})` : "—"]), align: ["l", "r", "r", "r", "r", "r", "l"] };
      break;
    }
    case "ar": {
      const open = invoices.filter((i) => i.balance > 0);
      const byBucket = BUCKETS.map((b) => ({ ...b, value: sumBy(open.filter((i) => agingBucket(i.daysOverdue) === b.key), (i) => i.balance) }));
      body = <RankedBars data={byBucket.map((b) => ({ label: b.label, value: b.value }))} valueFormat={pesoCompact} colorBy={(_, i) => byBucket[i].color} />;
      const list = [...stats.entries()].filter(([, s]) => s.outstanding > 0).sort((a, b) => b[1].outstanding - a[1].outstanding);
      table = { head: ["Customer", "Terms", "Current", "1–7", "8–30", "31–60", "60+", "Total"], rows: list.map(([id, s]) => [customers.get(id)!.name, customers.get(id)!.paymentTerms, peso(s.aging.current), peso(s.aging.d1_7), peso(s.aging.d8_30), peso(s.aging.d31_60), peso(s.aging.d60p), peso(s.outstanding)]), align: ["l", "l", "r", "r", "r", "r", "r", "r"] };
      break;
    }
    case "leads": {
      const bySource = LEAD_SOURCES.map((s) => {
        const l = leads.filter((x) => x.source === s);
        const won = l.filter((x) => x.stage === "Won").length;
        const closed = l.filter((x) => x.stage === "Won" || x.stage === "Lost").length;
        return { s, n: l.length, won, closed, rate: closed ? won / closed : 0, pipeline: sumBy(l.filter((x) => x.stage !== "Won" && x.stage !== "Lost"), (x) => x.potentialMonthlyValue) };
      }).filter((x) => x.n > 0);
      body = (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm font-medium">Leads by stage</div>
            <RankedBars data={STAGES.map((st) => ({ label: st, value: leads.filter((l) => l.stage === st).length }))} valueFormat={(v) => `${v}`} />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">Open pipeline by source (₱/month freight)</div>
            <RankedBars data={bySource.map((x) => ({ label: x.s, value: x.pipeline }))} valueFormat={pesoCompact} color={SERIES[2]} />
          </div>
        </div>
      );
      table = { head: ["Source", "Leads", "Won", "Closed", "Win rate", "Open pipeline / month"], rows: bySource.map((x) => [x.s, x.n, x.won, x.closed, x.closed ? pct(x.rate) : "—", peso(x.pipeline)]), align: ["l", "r", "r", "r", "r", "r"] };
      break;
    }
  }

  return (
    <>
      <PageHeader title="Reports" description={`Logistics reports computed from the same jobs, trips, deliveries, expenses, fuel logs and payments you see elsewhere · ${completed.length} completed trips, ${pesoCompact(totalRevenue)} freight revenue since go-live.`} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="content-start p-2">
          {GROUPS.map((g) => (
            <div key={g} className="mb-2">
              <div className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g}</div>
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <button key={r.key} type="button" onClick={() => setActive(r.key)} className={cn("flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", active === r.key ? "bg-accent font-medium text-primary" : "hover:bg-muted")} aria-pressed={active === r.key}>
                  <BarChart3 className="size-4 shrink-0 opacity-60" />
                  {r.title}
                </button>
              ))}
            </div>
          ))}
        </Card>
        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.question} · since go-live, Aug 26 – Sep 24, 2026</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadCsv(`tradeloop-${report.key}.csv`, [table.head, ...table.rows]);
                  toast.success(`${report.title} exported`);
                }}
              >
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

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
