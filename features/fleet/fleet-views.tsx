"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, FileCheck2, Fuel, Gauge, MapPin, Phone, Route as RouteIcon, Timer, Truck, UserRound, Wrench } from "lucide-react";
import type { Driver, Truck as TruckT } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { TRUCKS, DRIVERS, truckById, driverById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { currentOdometer, documentStatus, driverStatus, fuelEfficiencyByLog, maintenanceOutlook, minutesLate, truckLocation, truckStatus, truckTripToday } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDate, fmtDateShort, fmtDay, fmtTime, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapacityBar, EmptyState, KPICard, LineItem, PageHeader, Stat } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { TripCard } from "@/components/shared/trip-card";
import { RecordNotFound } from "@/components/shared/states";
import { Columns } from "@/components/charts/charts";

const WINDOW_START = "2026-08-26";

function useTruckFacts(truck: TruckT) {
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const documents = useAppStore((s) => s.documents);
  const metrics = useTripMetrics();
  const odo = currentOdometer(truck, trips, fuelLogs);
  const own = trips.filter((t) => t.truckId === truck.id).sort((a, b) => b.departure.localeCompare(a.departure));
  const done = own.filter((t) => t.status === "Completed");
  const logs = fuelLogs.filter((f) => f.truckId === truck.id);
  const eff = fuelEfficiencyByLog(logs);
  const effValues = logs.map((f) => eff.get(f.id)).filter((x): x is number => x !== undefined);
  const docs = documents.filter((d) => d.truckId === truck.id);
  return {
    trips,
    maintenance,
    metrics,
    odo,
    own,
    done,
    logs,
    eff,
    avgKmPerL: effValues.length ? sumBy(effValues, (x) => x) / effValues.length : undefined,
    outlook: maintenanceOutlook(truck.id, maintenance, odo),
    status: truckStatus(truck, trips, maintenance),
    trip: truckTripToday(truck.id, trips),
    docs,
    registration: docs.find((d) => d.type === "OR/CR"),
    insurance: docs.find((d) => d.type === "Comprehensive Insurance"),
  };
}

// ─── Trucks list ────────────────────────────────────────────────────────────
export function TrucksView() {
  return (
    <>
      <PageHeader title="Trucks" description="Two 10-wheeler closed vans. Capacity is the operator's configured payload for load planning, not a manufacturer rating." />
      <div className="grid gap-4 lg:grid-cols-2">
        {TRUCKS.map((t) => (
          <TruckOverviewCard key={t.id} truck={t} />
        ))}
      </div>
    </>
  );
}

function TruckOverviewCard({ truck: t }: { truck: TruckT }) {
  const f = useTruckFacts(t);
  const m = f.trip ? f.metrics.get(f.trip.id) : undefined;
  const loc = truckLocation(f.trip);
  const util = f.done.length ? sumBy(f.done, (x) => f.metrics.get(x.id)!.outUtil) / f.done.length : 0;
  const ret = f.done.length ? sumBy(f.done, (x) => f.metrics.get(x.id)!.retUtil) / f.done.length : 0;
  const pms = f.outlook.nextPms;
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl text-white" style={{ background: t.color }}>
            <Truck className="size-6" />
          </span>
          <div>
            <Link href={`/trucks/${t.id}`} className="text-lg font-semibold hover:underline">
              {t.code}
            </Link>
            <div className="text-sm text-muted-foreground">
              {t.make} {t.model} · {t.vehicleType}
            </div>
          </div>
        </div>
        <StatusBadge status={f.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Plate" value={<span className="font-mono">{t.plateNo}</span>} />
        <Stat label="Capacity" value={kg(t.capacityKg)} sub="configured payload" />
        <Stat label="Odometer" value={`${num(f.odo)} km`} />
        <Stat label="Driver" value={driverById(f.trip?.driverId ?? t.primaryDriverId).name} sub={f.trip ? "on today's trip" : "primary driver"} />
      </div>
      <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <div className="font-medium">{loc.label}</div>
            {loc.detail && <div className="text-xs text-muted-foreground">{loc.detail}</div>}
          </div>
        </div>
        {f.trip && m && (
          <>
            <Link href={`/trips/${f.trip.id}`} className="text-xs font-medium text-primary hover:underline">
              {f.trip.id} · {tripRouteLine(f.trip)}
            </Link>
            <CapacityBar used={m.outboundKg} capacity={t.capacityKg} label="Outbound" size="sm" />
            <CapacityBar used={m.returnKg} capacity={t.capacityKg} label="Return" size="sm" />
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
        <Stat label="Trips (30 days)" value={f.done.length} />
        <Stat label="Avg outbound" value={pct(util)} />
        <Stat label="Avg return" value={pct(ret)} />
        <Stat label="Fuel efficiency" value={f.avgKmPerL ? `${f.avgKmPerL.toFixed(2)} km/L` : "—"} sub="full-to-full" />
      </div>
      <div className="grid gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Wrench className="size-3.5" /> Last service
          </span>
          <span>{f.outlook.lastService ? `${f.outlook.lastService.type} · ${fmtDateShort(f.outlook.lastService.date)}` : "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <CalendarClock className="size-3.5" /> Next PMS
          </span>
          <span className={pms && pms.kmLeft < 1000 ? "font-medium text-[oklch(0.5_0.13_65)]" : ""}>{pms ? `${num(pms.dueKm)} km (${pms.kmLeft >= 0 ? `in ${num(pms.kmLeft)} km` : `${num(-pms.kmLeft)} km overdue`})${pms.dueDate ? ` or ${fmtDateShort(pms.dueDate)}` : ""}` : "—"}</span>
        </div>
        {[f.registration, f.insurance].map((d) =>
          d ? (
            <div key={d.id} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <FileCheck2 className="size-3.5" /> {d.type === "OR/CR" ? "Registration" : "Insurance"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                until {fmtDate(d.expiryDate)} <StatusBadge status={documentStatus(d).status} icon={false} className="text-[10px]" />
              </span>
            </div>
          ) : null,
        )}
        {f.outlook.overdue.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 font-medium text-danger">
            <AlertTriangle className="size-3.5" /> {f.outlook.overdue.length} overdue service: {f.outlook.overdue.map((x) => x.type).join(", ")}
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/trucks/${t.id}`}>Truck details</Link>
      </Button>
    </Card>
  );
}

// ─── Truck detail ───────────────────────────────────────────────────────────
export function TruckDetail({ id }: { id: string }) {
  const truck = TRUCKS.find((x) => x.id === id);
  if (!truck) return <RecordNotFound kind="Truck" id={id} backHref="/trucks" backLabel="Back to trucks" />;
  return <TruckDetailBody truck={truck} />;
}

function TruckDetailBody({ truck: t }: { truck: TruckT }) {
  const router = useRouter();
  const f = useTruckFacts(t);
  const maint = f.maintenance.filter((m) => m.truckId === t.id).sort((a, b) => b.date.localeCompare(a.date));
  const windowMaint = maint.filter((m) => m.status === "Completed" && m.date >= WINDOW_START);
  const dm = f.done.map((x) => f.metrics.get(x.id)!);
  const km = sumBy(dm, (m) => m.distanceKm);
  const revenue = sumBy(dm, (m) => m.revenue);
  const contribution = sumBy(dm, (m) => m.contribution);
  const chart = f.done
    .slice(0, 14)
    .reverse()
    .map((x) => ({ trip: x.id.slice(5), revenue: f.metrics.get(x.id)!.revenue, cost: f.metrics.get(x.id)!.expenseTotal }));
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Trucks", href: "/trucks" }, { label: t.code }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t.code} · <span className="font-mono">{t.plateNo}</span> <StatusBadge status={f.status} />
          </span>
        }
        description={`${t.make} ${t.model} · ${t.body} · ${t.year} · configured payload ${kg(t.capacityKg)}`}
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/maintenance">
                <Wrench /> Maintenance
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/fuel-logs">
                <Fuel /> Fuel logs
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Odometer" value={`${num(f.odo)} km`} icon={Gauge} hint={`${num(km)} km in the last 30 days`} />
        <KPICard label="Trips (30 days)" value={f.done.length} icon={RouteIcon} hint={`${pesoCompact(revenue)} freight · ${pesoCompact(contribution)} contribution`} />
        <KPICard label="Fuel efficiency" value={f.avgKmPerL ? `${f.avgKmPerL.toFixed(2)} km/L` : "—"} icon={Fuel} hint={f.avgKmPerL ? "full-to-full, logged fill-ups" : "needs two full-tank fill-ups"} />
        <KPICard label="Maintenance cost (30 days)" value={peso(sumBy(windowMaint, (m) => m.cost))} icon={Wrench} hint={`${sumBy(windowMaint, (m) => m.downtimeHours ?? 0)} h downtime`} tone={f.outlook.overdue.length ? "warning" : "default"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4">
          {f.trip ? <TripCard trip={f.trip} /> : <EmptyState icon={Truck} title="No trip today" description="Available for dispatch." className="bg-card" />}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance outlook</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {f.outlook.nextPms && (
                <LineItem label="Next PMS" value={`${num(f.outlook.nextPms.dueKm)} km · ${f.outlook.nextPms.kmLeft >= 0 ? `in ${num(f.outlook.nextPms.kmLeft)} km` : "overdue"}`} strong />
              )}
              {f.outlook.overdue.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">
                  <span>
                    Overdue: {m.type} (sched. {fmtDateShort(m.date)})
                  </span>
                  <span>{m.vendor.split(",")[0]}</span>
                </div>
              ))}
              {f.outlook.upcoming.map((m) => (
                <LineItem key={m.id} label={`${m.type} · ${fmtDateShort(m.date)}`} value={m.vendor.split(",")[0]} muted />
              ))}
              {!f.outlook.overdue.length && !f.outlook.upcoming.length && <p className="text-xs text-muted-foreground">No scheduled work.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <Link href="/documents" className="text-xs font-medium text-primary hover:underline">
                All documents
              </Link>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {f.docs.map((d) => {
                const st = documentStatus(d);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.type}</div>
                      <div className="text-xs text-muted-foreground">until {fmtDate(d.expiryDate)}</div>
                    </div>
                    <StatusBadge status={st.status} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Freight revenue vs trip expenses</CardTitle>
                <CardDescription>Last {chart.length} completed trips</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Columns data={chart} xKey="trip" series={[{ key: "revenue", name: "Freight revenue" }, { key: "cost", name: "Trip expenses", color: "var(--chart-4)" }]} height={220} />
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Recent trips</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Trip</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Km</TableHead>
                    <TableHead className="text-right">Out / Return</TableHead>
                    <TableHead className="text-right">Contribution</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.own.slice(0, 12).map((x) => {
                    const m = f.metrics.get(x.id)!;
                    return (
                      <TableRow key={x.id} className="cursor-pointer" onClick={() => router.push(`/trips/${x.id}`)}>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-medium text-primary">{x.id}</div>
                          <div className="text-xs text-muted-foreground">{fmtDay(x.date)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{driverById(x.driverId).name}</TableCell>
                        <TableCell className="text-right tabular">{num(m.distanceKm)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular">
                          {pct(m.outUtil)} / {pct(m.retUtil)}
                        </TableCell>
                        <TableCell className="text-right tabular">{peso(m.contribution)}</TableCell>
                        <TableCell>
                          <StatusBadge status={x.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Maintenance history</CardTitle>
              <Link href="/maintenance" className="text-xs font-medium text-primary hover:underline">
                Maintenance
              </Link>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maint.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(m.date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{m.type}</div>
                        <div className="max-w-[260px] truncate text-xs text-muted-foreground">{m.notes}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.vendor}</TableCell>
                      <TableCell className="text-right tabular">{num(m.odometerKm)}</TableCell>
                      <TableCell className="text-right tabular">{peso(m.cost)}</TableCell>
                      <TableCell>
                        <StatusBadge status={m.status === "Scheduled" && m.date < TODAY ? "Overdue" : m.status} />
                      </TableCell>
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

// ─── Drivers ────────────────────────────────────────────────────────────────
function useDriverFacts(d: Driver) {
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const documents = useAppStore((s) => s.documents);
  const jobs = useAppStore((s) => s.jobs);
  const own = trips.filter((t) => t.driverId === d.id).sort((a, b) => b.departure.localeCompare(a.departure));
  const done = own.filter((t) => t.status === "Completed");
  const tripIds = new Set(own.map((t) => t.id));
  const dls = deliveries.filter((x) => tripIds.has(x.tripId));
  const finished = dls.filter((x) => x.status === "Delivered" || x.status === "Failed" || x.status === "Returned");
  const delivered = finished.filter((x) => x.status === "Delivered");
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const onTime = delivered.filter((x) => {
    const j = jobMap.get(x.jobId);
    return j && x.arrivedAt && minutesLate(j.requiredBy, x.arrivedAt) <= 15;
  });
  const incidents = dls.flatMap((x) => x.issues.map((i) => ({ ...i, deliveryId: x.id, jobId: x.jobId })));
  return {
    trips,
    own,
    done,
    current: own.find((t) => ["Loading", "Ready", "Dispatched", "In Transit", "Returning"].includes(t.status)) ?? own.find((t) => t.date === TODAY),
    completionRate: finished.length ? delivered.length / finished.length : 1,
    onTimeRate: delivered.length ? onTime.length / delivered.length : 1,
    delivered: delivered.length,
    incidents: incidents.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    docs: documents.filter((x) => x.driverId === d.id),
    status: driverStatus(d, trips),
    license: documentStatus({ expiryDate: d.licenseExpiry }),
  };
}

export function DriversView() {
  return (
    <>
      <PageHeader title="Drivers" description="Crew availability, licenses and delivery performance. Driver-facing screens never show revenue or customer balances." />
      <div className="grid gap-4 md:grid-cols-2">
        {DRIVERS.map((d) => (
          <DriverCard key={d.id} driver={d} />
        ))}
      </div>
    </>
  );
}

function DriverCard({ driver: d }: { driver: Driver }) {
  const f = useDriverFacts(d);
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback className="bg-primary text-sm text-white">{d.initials}</AvatarFallback>
          </Avatar>
          <div>
            <Link href={`/drivers/${d.id}`} className="font-semibold hover:underline">
              {d.name}
            </Link>
            <div className="text-xs text-muted-foreground">
              {d.phone} · usually {truckById(d.assignedTruckId).code}
            </div>
          </div>
        </div>
        <StatusBadge status={f.status} />
      </div>
      {f.current ? (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <Link href={`/trips/${f.current.id}`} className="font-medium hover:underline">
            {f.current.id} · {truckById(f.current.truckId).code}
          </Link>
          <div className="text-xs text-muted-foreground">
            {tripRouteLine(f.current)} · {f.current.status}
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{d.unavailable.find((u) => u.from <= TODAY && u.to >= TODAY)?.reason ?? "No trip today."}</div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Trips (30 days)" value={f.done.length} />
        <Stat label="Delivery completion" value={pct(f.completionRate, 1)} />
        <Stat label="On-time" value={pct(f.onTimeRate)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          License <span className="font-mono">{d.licenseNo}</span> · until {fmtDate(d.licenseExpiry)}
        </span>
        <StatusBadge status={f.license.status} className="text-[10px]" />
      </div>
      {f.incidents.length > 0 && <div className="text-xs text-muted-foreground">{f.incidents.length} delivery issues logged in 30 days</div>}
    </Card>
  );
}

export function DriverProfile({ id }: { id: string }) {
  const d = DRIVERS.find((x) => x.id === id);
  if (!d) return <RecordNotFound kind="Driver" id={id} backHref="/drivers" backLabel="Back to drivers" />;
  return <DriverProfileBody driver={d} />;
}

function DriverProfileBody({ driver: d }: { driver: Driver }) {
  const router = useRouter();
  const f = useDriverFacts(d);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Drivers", href: "/drivers" }, { label: d.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.name} <StatusBadge status={f.status} />
          </span>
        }
        description={`${d.licenseRestrictions} · hired ${fmtDate(d.hiredDate)} · ${d.address}`}
        actions={
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${d.phone.replace(/\s/g, "")}`}>
              <Phone /> Call {d.name.split(" ")[0]}
            </a>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Trips completed (30 days)" value={f.done.length} icon={RouteIcon} />
        <KPICard label="Deliveries completed" value={f.delivered} icon={CheckCircle2} hint={`${pct(f.completionRate, 1)} completion rate`} tone="success" />
        <KPICard label="On-time arrivals" value={pct(f.onTimeRate)} icon={Timer} hint="within 15 min of the required time" />
        <KPICard label="Incidents / issues" value={f.incidents.length} icon={AlertTriangle} tone={f.incidents.length > 3 ? "warning" : "default"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Driver details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Contact" value={d.phone} />
              <Stat label="Assigned truck" value={truckById(d.assignedTruckId).code} sub={truckById(d.assignedTruckId).plateNo} />
              <Stat label="License no." value={<span className="font-mono">{d.licenseNo}</span>} sub={d.licenseRestrictions} />
              <Stat label="License expiry" value={fmtDate(d.licenseExpiry)} sub={f.license.status === "Valid" ? `${f.license.daysLeft} days left` : f.license.status} />
              <Stat label="Emergency contact" value={d.emergencyContact} className="col-span-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {d.unavailable.length === 0 ? (
                <p className="text-muted-foreground">No leave or rest days filed.</p>
              ) : (
                d.unavailable.map((u) => (
                  <LineItem key={u.from} label={u.reason} value={u.from === u.to ? fmtDateShort(u.from) : `${fmtDateShort(u.from)}–${fmtDateShort(u.to)}`} />
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <Link href="/documents" className="text-xs font-medium text-primary hover:underline">
                All documents
              </Link>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {f.docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{doc.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {doc.reference} · until {fmtDate(doc.expiryDate)}
                    </div>
                  </div>
                  <StatusBadge status={documentStatus(doc).status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-4 xl:col-span-2">
          {f.current && <TripCard trip={f.current} showFinancials={false} />}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Trip history</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Trip</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Departed</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {f.own.slice(0, 15).map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/trips/${t.id}`)}>
                      <TableCell className="font-medium whitespace-nowrap text-primary">{t.id}</TableCell>
                      <TableCell>{truckById(t.truckId).code}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{tripRouteLine(t)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular">{t.actualDeparture ? `${fmtDateShort(t.date)} ${fmtTime(t.actualDeparture)}` : "—"}</TableCell>
                      <TableCell className="tabular">{t.actualReturn ? fmtTime(t.actualReturn) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-4 text-primary" /> Recent incidents & issues
                </CardTitle>
                <CardDescription>Logged on this driver&apos;s deliveries</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {f.incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issues logged.</p>
              ) : (
                f.incidents.slice(0, 8).map((i) => (
                  <Link key={i.deliveryId + i.reportedAt} href={`/deliveries/${i.deliveryId}`} className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="font-medium">{i.type}</div>
                      <div className="truncate text-xs text-muted-foreground">{i.note}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>{i.jobId}</div>
                      <div>{fmtDateShort(i.reportedAt)}</div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
