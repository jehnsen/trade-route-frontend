"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleDollarSign, ClipboardList, Clock, FileWarning, Gauge, HandCoins, PackageCheck, Plus, Receipt, Route as RouteIcon, Timer, Truck, Undo2, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices, useTripMetrics } from "@/hooks/use-data";
import { NOW, TODAY, TOMORROW } from "@/data/company";
import { TRUCKS, truckById } from "@/data/fleet";
import { ACTIVE_TRIP_STATUSES, DELIVERY_DONE, currentOdometer, documentStatus, maintenanceOutlook, tripProgress, tripWarnings, truckStatus, unassignedJobs } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CapacityBar, KPICard, MoneyDisplay, PageHeader } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { TruckStatusCard } from "@/components/shared/trip-card";

interface Alert {
  icon: LucideIcon;
  tone: "danger" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
}

export function CommandCenter() {
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

  const truckStates = TRUCKS.map((t) => ({ truck: t, status: truckStatus(t, trips, maintenance) }));
  const activeTrucks = truckStates.filter((s) => s.status === "On Trip" || s.status === "Loading").length;
  const availableTrucks = truckStates.filter((s) => s.status === "Available" || s.status === "Assigned").length;
  const activeTrips = trips.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status));
  const todayTrips = trips.filter((t) => t.date === TODAY && t.status !== "Cancelled");
  const todayM = todayTrips.map((t) => metrics.get(t.id)!);
  const todayDeliveries = deliveries.filter((d) => todayTrips.some((t) => t.id === d.tripId)).sort((a, b) => a.eta.localeCompare(b.eta));
  const delivered = todayDeliveries.filter((d) => d.status === "Delivered");
  const awaiting = unassignedJobs(jobs).filter((j) => j.pickupAt.slice(0, 10) <= TOMORROW);
  const outUtil = sumBy(todayM, (m) => m.outboundKg) / Math.max(1, sumBy(todayM, (m) => m.capacityKg));
  const retUtil = sumBy(todayM, (m) => m.returnKg) / Math.max(1, sumBy(todayM, (m) => m.capacityKg));
  const todayRevenue = sumBy(todayM, (m) => m.revenue);
  const todayExpenses = sumBy(expenses.filter((e) => e.date === TODAY), (e) => e.amount);
  const outstanding = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(invoices.filter((i) => i.daysOverdue > 0), (i) => i.balance);
  const collectedToday = sumBy(payments.filter((p) => p.date.startsWith(TODAY)), (p) => p.amount);

  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const delayed = todayDeliveries
    .filter((d) => !DELIVERY_DONE.includes(d.status))
    .map((d) => ({ d, job: jobMap.get(d.jobId)! }))
    .filter(({ d, job }) => job && d.eta > job.requiredBy)
    .map(({ d, job }) => ({ d, job, lateBy: Math.round((Date.parse(d.eta) - Date.parse(job.requiredBy)) / 60000) }));

  const alerts: Alert[] = [];
  for (const t of trips.filter((x) => (x.date === TODAY || x.date === TOMORROW) && x.status !== "Cancelled" && x.status !== "Completed")) {
    for (const w of tripWarnings(t, metrics.get(t.id), trips, maintenance, documents)) alerts.push({ icon: w.kind === "capacity" ? Gauge : w.kind === "document" ? FileWarning : w.kind === "maintenance" ? Wrench : AlertTriangle, tone: w.kind === "capacity" || w.kind === "document" ? "danger" : "warning", title: `${truckById(t.truckId).code} · ${t.id}`, detail: w.message, href: `/trips/${t.id}` });
  }
  for (const { d, job, lateBy } of delayed) alerts.push({ icon: Clock, tone: "danger", title: `Late delivery risk — ${customers.get(job.customerId)?.name}`, detail: `ETA ${fmtTime(d.eta)} is ${lateBy} min after the ${fmtTime(job.requiredBy)} receiving cut-off`, href: `/deliveries/${d.id}` });
  for (const t of todayTrips.filter((x) => x.status !== "Completed")) {
    const m = metrics.get(t.id)!;
    if (m.outUtil < 0.6 && ["Planned", "Loading", "Ready"].includes(t.status)) alerts.push({ icon: Truck, tone: "warning", title: `${truckById(t.truckId).code} underutilized`, detail: `Outbound only ${pct(m.outUtil)} of payload — ${kg(m.capacityKg - m.outboundKg)} still free before ${fmtTime(t.departure)} departure`, href: "/dispatch" });
  }
  for (const truck of TRUCKS) {
    const o = maintenanceOutlook(truck.id, maintenance, currentOdometer(truck, trips, fuelLogs));
    if (o.nextPms && o.nextPms.kmLeft < 1500) alerts.push({ icon: Wrench, tone: "warning", title: `${truck.code} PMS due`, detail: o.nextPms.kmLeft >= 0 ? `Due in ${num(o.nextPms.kmLeft)} km (at ${num(o.nextPms.dueKm)} km)` : `Overdue by ${num(-o.nextPms.kmLeft)} km`, href: "/maintenance" });
    for (const m of o.overdue) alerts.push({ icon: Wrench, tone: "danger", title: `${truck.code} maintenance overdue`, detail: `${m.type} was scheduled ${fmtDay(m.date)}`, href: "/maintenance" });
  }
  for (const d of documents.filter((x) => documentStatus(x).status !== "Valid")) {
    const st = documentStatus(d);
    alerts.push({ icon: FileWarning, tone: st.status === "Expired" ? "danger" : "warning", title: `${d.type} ${st.status === "Expired" ? "expired" : "expiring"}`, detail: `${d.truckId ? truckById(d.truckId).code : "Driver"} · ${st.daysLeft < 0 ? `${-st.daysLeft} days ago` : `in ${st.daysLeft} days`}`, href: "/documents" });
  }

  const topOverdue = [...stats.entries()].filter(([, s]) => s.overdue > 0).sort((a, b) => b[1].overdue - a[1].overdue).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Command center"
        description={
          <>
            Friday, Sep 25 · live as of <b className="text-foreground">{fmtTime(NOW)}</b> — where the trucks are, what they carry, what&apos;s late, what&apos;s empty and who owes us.
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dispatch">Dispatch</Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                <Plus /> New job
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Active trucks" value={`${activeTrucks} of ${TRUCKS.length}`} icon={Truck} hint={truckStates.map((s) => `${s.truck.code}: ${s.status}`).join(" · ")} href="/trucks" />
        <KPICard label="Available trucks" value={availableTrucks} icon={Truck} hint={availableTrucks ? "ready for a trip" : "both trucks committed"} tone={availableTrucks ? "success" : "default"} href="/dispatch" />
        <KPICard label="Active trips" value={activeTrips.length} icon={RouteIcon} hint={activeTrips.map((t) => `${truckById(t.truckId).code} ${t.status.toLowerCase()}`).join(" · ") || "none on the road"} href="/trips" />
        <KPICard label="Deliveries today" value={`${delivered.length}/${todayDeliveries.length}`} icon={PackageCheck} hint={`${delayed.length} at risk of being late`} tone={delayed.length ? "warning" : "success"} href="/deliveries" />
        <KPICard label="Jobs awaiting dispatch" value={awaiting.length} icon={Timer} hint={`${kg(sumBy(awaiting, (j) => j.weightKg))} today & tomorrow`} tone={awaiting.length ? "warning" : "success"} href="/dispatch" />
        <KPICard label="Outbound utilization" value={pct(outUtil)} icon={Gauge} hint="today's trips, gross kg vs payload" href="/loads" />
        <KPICard label="Return utilization" value={pct(retUtil)} icon={Undo2} hint={`${kg(sumBy(todayM, (m) => Math.max(0, m.capacityKg - m.returnKg)))} empty on the way home`} tone={retUtil < 0.5 ? "warning" : "success"} href="/backhaul" />
        <KPICard label="Today's freight revenue" value={pesoCompact(todayRevenue)} icon={ClipboardList} hint={`${todayM.reduce((s, m) => s + m.jobs.length, 0)} jobs on today's trips`} />
        <KPICard label="Today's trip expenses" value={pesoCompact(todayExpenses)} icon={Wallet} hint="logged so far (diesel logged on return)" href="/expenses" />
        <KPICard label="Outstanding receivables" value={pesoCompact(outstanding)} icon={HandCoins} hint={`${pesoCompact(overdue)} overdue · ${pesoCompact(collectedToday)} collected today`} tone={overdue ? "danger" : "default"} href="/accounts-receivable" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {TRUCKS.map((t) => (
          <TruckStatusCard key={t.id} truck={t} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Active trips & trip P&amp;L</CardTitle>
              <CardDescription>What each trip earns and costs · contribution includes estimated diesel until the fill-up is logged</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/trips">
                All trips <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium sm:px-5">Trip</th>
                    <th className="px-2 py-2 font-medium">Progress</th>
                    <th className="px-2 py-2 font-medium">Load</th>
                    <th className="px-2 py-2 text-right font-medium">Revenue</th>
                    <th className="px-2 py-2 text-right font-medium">Cost</th>
                    <th className="px-4 py-2 text-right font-medium sm:px-5">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {trips
                    .filter((t) => (t.date === TODAY || t.date === TOMORROW || ACTIVE_TRIP_STATUSES.includes(t.status)) && t.status !== "Cancelled")
                    .sort((a, b) => a.departure.localeCompare(b.departure))
                    .map((t) => {
                      const m = metrics.get(t.id)!;
                      const p = tripProgress(t);
                      return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2.5 sm:px-5">
                            <Link href={`/trips/${t.id}`} className="font-medium text-primary hover:underline">
                              {truckById(t.truckId).code} · {t.id}
                            </Link>
                            <div className="max-w-[260px] truncate text-xs text-muted-foreground">{tripRouteLine(t)}</div>
                          </td>
                          <td className="px-2 py-2.5">
                            <StatusBadge status={t.status} className="text-[10px]" />
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {p.next ? `next: ${p.next.location.name.slice(0, 26)}` : t.status === "Completed" ? "closed" : "—"}
                            </div>
                          </td>
                          <td className="w-40 px-2 py-2.5">
                            <CapacityBar used={m.outboundKg} capacity={m.capacityKg} showNumbers={false} size="sm" />
                            <div className="mt-1 text-[11px] text-muted-foreground tabular">
                              out {pct(m.outUtil)} · ret {pct(m.retUtil)}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-right tabular">{pesoCompact(m.revenue)}</td>
                          <td className="px-2 py-2.5 text-right text-muted-foreground tabular">{pesoCompact(m.expenseTotal + m.estimatedDiesel)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[oklch(0.45_0.13_150)] tabular sm:px-5">{pesoCompact(m.contribution)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-[oklch(0.6_0.14_65)]" /> Needs attention
              </CardTitle>
              <CardDescription>Capacity, delays, maintenance and documents</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid max-h-[420px] gap-2 overflow-y-auto">
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">All clear — no operational alerts.</p>}
            {alerts.map((a, i) => (
              <Link
                key={a.title + a.detail + i}
                href={a.href}
                className={cn("flex items-start gap-2.5 rounded-lg border p-2.5 text-sm transition-colors", a.tone === "danger" ? "border-danger/25 bg-danger-soft/50 hover:bg-danger-soft" : a.tone === "warning" ? "border-[oklch(0.85_0.08_85)] bg-warning-soft/50 hover:bg-warning-soft" : "hover:bg-muted/40")}
              >
                <a.icon className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-danger" : "text-[oklch(0.55_0.13_65)]")} />
                <div className="min-w-0">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.detail}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="size-4 text-primary" /> Today&apos;s deliveries
              </CardTitle>
              <CardDescription>
                {delivered.length} of {todayDeliveries.length} delivered
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deliveries">
                All <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid max-h-[380px] gap-1.5 overflow-y-auto">
            {todayDeliveries.length === 0 && <p className="text-sm text-muted-foreground">No deliveries scheduled today.</p>}
            {todayDeliveries.map((d) => {
              const job = jobMap.get(d.jobId);
              const late = delayed.some((x) => x.d.id === d.id);
              return (
                <Link key={d.id} href={`/deliveries/${d.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{customers.get(d.customerId)?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {truckById(trips.find((t) => t.id === d.tripId)!.truckId).code} · {job?.cargoDescription} · {d.arrivedAt ? `arrived ${fmtTime(d.arrivedAt)}` : `ETA ${fmtTime(d.eta)}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {late && <span className="rounded bg-danger-soft px-1 text-[10px] font-medium text-danger">late</span>}
                    <StatusBadge status={d.status} icon={false} className="text-[10px]" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Timer className="size-4 text-[oklch(0.55_0.13_65)]" /> Unassigned jobs
              </CardTitle>
              <CardDescription>Confirmed bookings not yet on a truck (today & tomorrow)</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dispatch">
                Dispatch <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid max-h-[380px] gap-1.5 overflow-y-auto">
            {awaiting.length === 0 && <p className="text-sm text-muted-foreground">Every confirmed job is on a trip.</p>}
            {awaiting.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="truncate font-medium">{customers.get(j.customerId)?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {j.id} · {fmtDay(j.pickupAt)} · {j.leg === "return" ? `backhaul from ${j.pickup.name}` : j.dropoff.name}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium tabular">{kg(j.weightKg)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="size-4 text-primary" /> Overdue collections
              </CardTitle>
              <CardDescription>
                {peso(overdue)} overdue of {peso(outstanding)} outstanding
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/accounts-receivable">
                Aging <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <ul className="divide-y">
              {topOverdue.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">No overdue receivables.</li>}
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
            <div className="flex items-center gap-2 border-t px-4 pt-3 text-xs text-muted-foreground sm:px-5">
              <Receipt className="size-3.5" /> {peso(collectedToday)} collected so far today
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
