"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Download,
  FileWarning,
  Gauge,
  HandCoins,
  PackageCheck,
  Plus,
  Timer,
  Truck,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  useCustomerMap,
  useCustomerStats,
  useInvoices,
  useTripMetrics,
} from "@/hooks/use-data";
import { NOW, TODAY, TOMORROW } from "@/data/company";
import { TRUCKS, truckById } from "@/data/fleet";
import {
  DELIVERY_DONE,
  currentOdometer,
  documentStatus,
  maintenanceOutlook,
  tripWarnings,
  truckStatus,
  unassignedJobs,
} from "@/lib/logistics";
import { fmtDay, fmtTime, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { cn, downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives";
import { MoneyDisplay } from "@/components/shared/common";
import { ReceivableBadge } from "@/components/shared/status-badge";
import {
  FleetRoutes,
  FreightDeliveries,
  FreightPerformance,
} from "./operations-panels";

interface Alert {
  icon: LucideIcon;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export function CommandCenter() {
  const [allAlerts, setAllAlerts] = useState(false);
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const deliveries = useAppStore((s) => s.deliveries);
  const expenses = useAppStore((s) => s.expenses);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const payments = useAppStore((s) => s.payments);
  const customers = useCustomerMap();
  const metrics = useTripMetrics();
  const invoices = useInvoices();
  const stats = useCustomerStats();

  const truckStates = TRUCKS.map((t) => ({
    truck: t,
    status: truckStatus(t, trips, maintenance),
  }));
  const activeTrucks = truckStates.filter(
    (s) => s.status === "On Trip" || s.status === "Loading",
  ).length;
  const availableTrucks = truckStates.filter(
    (s) => s.status === "Available" || s.status === "Assigned",
  ).length;
  const todayTrips = trips.filter(
    (t) => t.date === TODAY && t.status !== "Cancelled",
  );
  const todayM = todayTrips.map((t) => metrics.get(t.id)!);
  const todayDeliveries = deliveries
    .filter((d) => todayTrips.some((t) => t.id === d.tripId))
    .sort((a, b) => a.eta.localeCompare(b.eta));
  const delivered = todayDeliveries.filter((d) => d.status === "Delivered");
  const awaiting = unassignedJobs(jobs).filter(
    (j) => j.pickupAt.slice(0, 10) <= TOMORROW,
  );
  const todayRevenue = sumBy(todayM, (m) => m.revenue);
  const todayExpenses = sumBy(
    expenses.filter((e) => e.date === TODAY),
    (e) => e.amount,
  );
  const outstanding = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(
    invoices.filter((i) => i.daysOverdue > 0),
    (i) => i.balance,
  );
  const collectedToday = sumBy(
    payments.filter((p) => p.date.startsWith(TODAY)),
    (p) => p.amount,
  );

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const delayed = todayDeliveries
    .filter((d) => !DELIVERY_DONE.includes(d.status))
    .map((d) => ({ d, job: jobMap.get(d.jobId)! }))
    .filter(({ d, job }) => job && d.eta > job.requiredBy)
    .map(({ d, job }) => ({
      d,
      job,
      lateBy: Math.round(
        (Date.parse(d.eta) - Date.parse(job.requiredBy)) / 60000,
      ),
    }));

  const alerts: Alert[] = [];
  for (const t of trips.filter(
    (x) =>
      (x.date === TODAY || x.date === TOMORROW) &&
      x.status !== "Cancelled" &&
      x.status !== "Completed",
  )) {
    for (const w of tripWarnings(
      t,
      metrics.get(t.id),
      trips,
      maintenance,
      documents,
    ))
      alerts.push({
        icon:
          w.kind === "capacity"
            ? Gauge
            : w.kind === "document"
              ? FileWarning
              : w.kind === "maintenance"
                ? Wrench
                : AlertTriangle,
        tone:
          w.kind === "capacity" || w.kind === "document" ? "danger" : "warning",
        title: `${truckById(t.truckId).code} · ${t.id}`,
        detail: w.message,
        href: `/trips/${t.id}`,
      });
  }
  for (const { d, job, lateBy } of delayed)
    alerts.push({
      icon: Clock,
      tone: "danger",
      title: `Late delivery risk — ${customers.get(job.customerId)?.name}`,
      detail: `ETA ${fmtTime(d.eta)} is ${lateBy} min after the ${fmtTime(job.requiredBy)} receiving cut-off`,
      href: `/deliveries/${d.id}`,
    });
  for (const t of todayTrips.filter((x) => x.status !== "Completed")) {
    const m = metrics.get(t.id)!;
    if (m.outUtil < 0.6 && ["Planned", "Loading", "Ready"].includes(t.status))
      alerts.push({
        icon: Truck,
        tone: "warning",
        title: `${truckById(t.truckId).code} underutilized`,
        detail: `Outbound only ${pct(m.outUtil)} of payload — ${kg(m.capacityKg - m.outboundKg)} still free before ${fmtTime(t.departure)} departure`,
        href: "/dispatch",
      });
  }
  for (const truck of TRUCKS) {
    const o = maintenanceOutlook(
      truck.id,
      maintenance,
      currentOdometer(truck, trips, fuelLogs),
    );
    if (o.nextPms && o.nextPms.kmLeft < 1500)
      alerts.push({
        icon: Wrench,
        tone: "warning",
        title: `${truck.code} PMS due`,
        detail:
          o.nextPms.kmLeft >= 0
            ? `Due in ${num(o.nextPms.kmLeft)} km (at ${num(o.nextPms.dueKm)} km)`
            : `Overdue by ${num(-o.nextPms.kmLeft)} km`,
        href: "/maintenance",
      });
    for (const m of o.overdue)
      alerts.push({
        icon: Wrench,
        tone: "danger",
        title: `${truck.code} maintenance overdue`,
        detail: `${m.type} was scheduled ${fmtDay(m.date)}`,
        href: "/maintenance",
      });
  }
  for (const d of documents.filter(
    (x) => documentStatus(x).status !== "Valid",
  )) {
    const st = documentStatus(d);
    alerts.push({
      icon: FileWarning,
      tone: st.status === "Expired" ? "danger" : "warning",
      title: `${d.type} ${st.status === "Expired" ? "expired" : "expiring"}`,
      detail: `${d.truckId ? truckById(d.truckId).code : "Driver"} · ${st.daysLeft < 0 ? `${-st.daysLeft} days ago` : `in ${st.daysLeft} days`}`,
      href: "/documents",
    });
  }

  const topOverdue = [...stats.entries()]
    .filter(([, s]) => s.overdue > 0)
    .sort((a, b) => b[1].overdue - a[1].overdue)
    .slice(0, 5);

  const sortedAlerts = [...alerts].sort(
    (a, b) => Number(b.tone === "danger") - Number(a.tone === "danger"),
  );
  const exportOverview = () =>
    downloadCsv(`tradeloop-operations-${TODAY}.csv`, [
      [
        "Date",
        "Trip",
        "Truck",
        "Status",
        "Outbound kg",
        "Return kg",
        "Revenue PHP",
        "Costs incl. estimated diesel PHP",
        "Contribution PHP",
      ],
      ...todayTrips.map((trip) => {
        const m = metrics.get(trip.id)!;
        return [
          TODAY,
          trip.id,
          truckById(trip.truckId).code,
          trip.status,
          m.outboundKg,
          m.returnKg,
          m.revenue,
          m.expenseTotal + m.estimatedDiesel,
          m.contribution,
        ];
      }),
    ]);

  return (
    <div className="ops-enter space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="ops-eyebrow mb-2 flex items-center gap-2">
            <span className="h-px w-5 bg-[#82986c]" /> Your operations, at a
            glance
          </div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.045em] sm:text-[32px]">
            Let&apos;s keep things moving
            <span className="text-[#7a965e]">.</span>
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            A clear view of your fleet, deliveries and the day ahead.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportOverview}>
            <Download /> Export overview
          </Button>
          <Button
            asChild
            className="bg-[#c9ecaa] text-[#213323] shadow-none hover:bg-[#b9df96]"
          >
            <Link href="/jobs/new">
              <Plus /> Create shipment
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-lg border bg-white p-2">
            <CalendarDays className="size-3.5 text-muted-foreground" />
          </span>
          <span className="font-medium">Friday, 25 September 2026</span>
          <span className="hidden text-muted-foreground sm:inline">
            · Today&apos;s overview
          </span>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[#82986c]" />
          Demo snapshot · {fmtTime(NOW)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {[
          {
            label: "Fleet on the move",
            value: String(activeTrucks).padStart(2, "0"),
            suffix: `/ ${TRUCKS.length} trucks`,
            icon: Truck,
            detail: `${availableTrucks} available for dispatch`,
            href: "/trucks",
            color: "bg-[#eef2e8] text-[#65834c]",
            featured: true,
          },
          {
            label: "Deliveries today",
            value: String(todayDeliveries.length).padStart(2, "0"),
            suffix: "deliveries",
            icon: PackageCheck,
            detail: `${delivered.length} delivered · ${delayed.length} at risk`,
            href: "/deliveries",
            color: "bg-[#edf2fb] text-[#5a7fb1]",
          },
          {
            label: "Awaiting dispatch",
            value: String(awaiting.length).padStart(2, "0"),
            suffix: "shipments",
            icon: Timer,
            detail: `${kg(sumBy(awaiting, (j) => j.weightKg))} ready to assign`,
            href: "/dispatch",
            color: "bg-[#faf0e4] text-[#b8864c]",
          },
          {
            label: "Freight revenue",
            value: pesoCompact(todayRevenue),
            suffix: "",
            icon: CircleDollarSign,
            detail: `${todayM.reduce((s, m) => s + m.jobs.length, 0)} jobs on today's trips`,
            href: "/reports",
            color: "bg-[#f0edf7] text-[#8b73a5]",
          },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "ops-metric group flex flex-col p-4 sm:p-5",
              item.featured && "!border-[#d7e5c9] !bg-[#edf3e5]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                {item.label}
              </span>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  item.color,
                )}
              >
                <item.icon className="size-4" strokeWidth={1.7} />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-2">
              <span className="text-[29px] font-semibold tracking-[-0.045em] tabular sm:text-[34px]">
                {item.value}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {item.suffix}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-3 text-[10px] text-muted-foreground">
              <span>{item.detail}</span>
              <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <FleetRoutes />
        <Card className="overflow-hidden">
          <CardHeader className="items-center px-5 pt-5 sm:px-6">
            <div>
              <CardTitle className="flex items-center gap-2">
                Needs attention{" "}
                <span className="rounded-md bg-[#fff1e3] px-2 py-0.5 text-[11px] text-[#a06935]">
                  {alerts.length}
                </span>
              </CardTitle>
              <CardDescription>
                A little action. A smoother day.
              </CardDescription>
            </div>
            <span className="flex size-8 items-center justify-center rounded-full border">
              <AlertTriangle className="size-4 text-[#b58a55]" />
            </span>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <div
              className={cn(
                "divide-y",
                allAlerts && "max-h-[440px] overflow-y-auto",
              )}
            >
              {sortedAlerts
                .slice(0, allAlerts ? undefined : 3)
                .map((alert, index) => (
                  <Link
                    key={`${alert.title}-${index}`}
                    href={alert.href}
                    className="group flex gap-3 py-4 first:pt-1"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        alert.tone === "danger"
                          ? "bg-[#fbedea] text-[#bd695a]"
                          : "bg-[#faf1e6] text-[#b3864b]",
                      )}
                    >
                      <alert.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs leading-relaxed font-semibold group-hover:text-primary">
                        {alert.title}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {alert.detail}
                      </p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                        Review details <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              {!alerts.length && (
                <div className="py-8 text-center">
                  <CheckCheck className="mx-auto mb-3 size-7 text-success" />
                  <p className="text-sm font-medium">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No operational alerts to review.
                  </p>
                </div>
              )}
            </div>
            {alerts.length > 3 && (
              <button
                type="button"
                aria-expanded={allAlerts}
                onClick={() => setAllAlerts(!allAlerts)}
                className="mt-2 flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border text-[11px] font-medium hover:bg-muted"
              >
                {allAlerts
                  ? "Show priority alerts"
                  : `View all ${alerts.length} alerts`}
                <ChevronDown
                  className={cn("size-3.5", allAlerts && "rotate-180")}
                />
              </button>
            )}
            <Link
              href="/dispatch"
              className="mt-4 flex items-center gap-3 rounded-xl bg-[#f3f5ee] p-3.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#748a59]">
                <Truck className="size-4" />
              </span>
              <div className="flex-1">
                <div className="text-[11px] font-semibold">
                  Keep your next trip on track
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {awaiting.length} shipments awaiting assignment
                </div>
              </div>
              <ArrowRight className="size-4 text-[#748a59]" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <FreightDeliveries />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <FreightPerformance />
        <Card>
          <CardHeader className="items-center px-5 pt-5 sm:px-6">
            <div>
              <CardTitle>Collections overview</CardTitle>
              <CardDescription>Keep cash flow moving, too.</CardDescription>
            </div>
            <HandCoins className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl bg-muted/50 p-4">
              <div>
                <div className="text-[10px] text-muted-foreground">
                  Outstanding
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight tabular">
                  {pesoCompact(outstanding)}
                </div>
              </div>
              <div className="border-l pl-4">
                <div className="text-[10px] text-muted-foreground">
                  Overdue balance
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-[#b76e57] tabular">
                  {pesoCompact(overdue)}
                </div>
              </div>
            </div>
            <div className="ops-eyebrow mt-5 mb-2">Follow up next</div>
            <ul className="divide-y">
              {topOverdue.slice(0, 3).map(([id, stat]) => (
                <li key={id}>
                  <Link
                    href={`/customers/${id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:text-primary"
                  >
                    <span className="truncate text-xs font-medium">
                      {customers.get(id)?.name}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <MoneyDisplay
                        amount={stat.overdue}
                        className="text-xs font-semibold"
                      />
                      <ReceivableBadge
                        daysOverdue={stat.oldestOverdueDays}
                        balance={stat.overdue}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {!topOverdue.length && (
              <p className="py-5 text-xs text-muted-foreground">
                No overdue accounts. You&apos;re up to date.
              </p>
            )}
            <Link
              href="/accounts-receivable"
              className="mt-3 flex items-center justify-between border-t pt-4 text-[11px] font-medium"
            >
              Manage receivables <ArrowUpRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[10px] text-muted-foreground">
        <span>
          Lucena Fresh Trading & Logistics <span className="px-2">/</span>{" "}
          Operations workspace
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/expenses"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <Wallet className="size-3.5" />
            {peso(todayExpenses)} expenses logged today
          </Link>
          <Link
            href="/payments"
            className="flex items-center gap-1.5 hover:text-foreground"
          >
            <CheckCheck className="size-3.5" />
            {peso(collectedToday)} collected today
          </Link>
        </div>
      </div>
    </div>
  );
}
