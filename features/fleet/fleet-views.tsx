"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Fuel, Gauge, Phone, Route as RouteIcon, ShieldCheck, Timer, Truck, UserRound, Wrench } from "lucide-react";
import type { Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { TRUCKS, DRIVERS, MAINTENANCE, truckById, driverById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { routeById } from "@/data/areas";
import { fmtDate, fmtDateShort, fmtTime, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Avatar, AvatarFallback } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapacityBar, KPICard, PageHeader, Stat } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { RecordNotFound } from "@/components/shared/states";
import { Columns, TrendLines, SERIES } from "@/components/charts/charts";

function useFleetData() {
  const trips = useAppStore((s) => s.trips);
  const expenses = useAppStore((s) => s.expenses);
  const metrics = useTripMetrics();
  return { trips, expenses, metrics };
}

function truckStatus(trips: Trip[], truckId: string) {
  const t = trips.find((x) => x.truckId === truckId && x.date === TODAY);
  if (!t) return { label: "Available", trip: undefined };
  return { label: t.status === "In Transit" || t.status === "Returning" ? "On Trip" : t.status === "Loading" ? "Loading" : t.status === "Completed" ? "Available" : "Available", trip: t };
}

// ─── Trucks list ────────────────────────────────────────────────────────────
export function TrucksView() {
  const { trips, expenses, metrics } = useFleetData();
  return (
    <>
      <PageHeader title="Trucks" description="Two 10-wheeler closed vans. Capacity shown is the configured operational payload used for load planning." />
      <div className="grid gap-4 lg:grid-cols-2">
        {TRUCKS.map((t) => {
          const st = truckStatus(trips, t.id);
          const done = trips.filter((x) => x.truckId === t.id && x.status === "Completed");
          const util = done.length ? sumBy(done, (x) => metrics.get(x.id)!.outUtil) / done.length : 0;
          const ret = done.length ? sumBy(done, (x) => metrics.get(x.id)!.retUtil) / done.length : 0;
          const diesel = sumBy(expenses.filter((e) => e.truckId === t.id && e.category === "Diesel"), (e) => e.amount);
          return (
            <Card key={t.id} className="gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-xl text-white" style={{ background: t.color }}>
                    <Truck className="size-6" />
                  </span>
                  <div>
                    <Link href={`/trucks/${t.id}`} className="text-lg font-semibold hover:underline">
                      {t.code}
                    </Link>
                    <div className="text-sm text-muted-foreground">{t.name}</div>
                  </div>
                </div>
                <StatusBadge status={st.label} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Plate" value={<span className="font-mono">{t.plateNo}</span>} />
                <Stat label="Capacity" value={kg(t.capacityKg)} sub="configured payload" />
                <Stat label="Mileage" value={`${num(t.mileageKm)} km`} />
                <Stat label="Year" value={t.year} sub={t.body} />
              </div>
              {st.trip ? (
                <div className="grid gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <Link href={`/trips/${st.trip.id}`} className="font-medium hover:underline">
                      {st.trip.id}
                    </Link>
                    <span className="text-xs text-muted-foreground">{driverById(st.trip.driverId).name}</span>
                  </div>
                  <div className="text-muted-foreground">{routeById(st.trip.routeId).name}</div>
                  <CapacityBar used={metrics.get(st.trip.id)!.outboundLoadKg} capacity={t.capacityKg} label="Today's load" size="sm" />
                </div>
              ) : (
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">No trip today.</div>
              )}
              <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
                <Stat label="Trips (30 days)" value={done.length} />
                <Stat label="Avg outbound" value={pct(util)} />
                <Stat label="Avg return" value={pct(ret)} />
                <Stat label="Diesel spend" value={pesoCompact(diesel)} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Wrench className="size-3.5" /> Next PMS {fmtDate(t.nextMaintenanceDate)} or {num(t.nextMaintenanceKm)} km
                </span>
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link href={`/trucks/${t.id}`}>Truck details</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ─── Truck detail ───────────────────────────────────────────────────────────
export function TruckDetail({ id }: { id: string }) {
  const router = useRouter();
  const { trips, expenses, metrics } = useFleetData();
  const t = TRUCKS.find((x) => x.id === id);
  if (!t) return <RecordNotFound kind="Truck" id={id} backHref="/trucks" backLabel="Back to trucks" />;
  const own = trips.filter((x) => x.truckId === id).sort((a, b) => b.departure.localeCompare(a.departure));
  const done = own.filter((x) => x.status === "Completed");
  const st = truckStatus(trips, id);
  const maint = MAINTENANCE.filter((m) => m.truckId === id).sort((a, b) => b.date.localeCompare(a.date));
  const tExp = expenses.filter((e) => e.truckId === id);
  const fuel = tExp.filter((e) => e.category === "Diesel");
  const liters = sumBy(fuel, (e) => Number(e.description.split(" ")[0]) || 0);
  const km = sumBy(done, (x) => routeById(x.routeId).roundTripKm);
  const downtime = sumBy(maint.filter((m) => m.date >= "2026-08-26"), (m) => m.downtimeHours);
  const utilSeries = done
    .slice(0, 14)
    .reverse()
    .map((x) => ({ date: x.date, Outbound: Math.round(metrics.get(x.id)!.outUtil * 100), Return: Math.round(metrics.get(x.id)!.retUtil * 100) }));
  const expByCat = ["Diesel", "Toll", "Ice", "Packaging", "Driver Allowance", "Helper Allowance", "Maintenance", "Repairs"].map((c) => ({ c, v: sumBy(tExp.filter((e) => e.category === c), (e) => e.amount) }));
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Trucks", href: "/trucks" }, { label: t.code }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t.code} · {t.name} <StatusBadge status={st.label} />
          </span>
        }
        description={`${t.make} ${t.model} · ${t.body} · plate ${t.plateNo} · ${t.year}`}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard label="Mileage" value={`${num(t.mileageKm)} km`} icon={Gauge} />
        <KPICard label="Fuel efficiency" value={`${km && liters ? (km / liters).toFixed(2) : t.fuelEfficiencyKmPerL} km/L`} icon={Fuel} hint={`${num(liters)} L over ${num(km)} km (30 days)`} />
        <KPICard label="Utilization" value={pct(done.length ? sumBy(done, (x) => metrics.get(x.id)!.outUtil) / done.length : 0)} icon={Truck} hint={`return ${pct(done.length ? sumBy(done, (x) => metrics.get(x.id)!.retUtil) / done.length : 0)}`} />
        <KPICard label="Downtime (30 days)" value={`${downtime} h`} icon={Timer} hint={`${maint.filter((m) => m.date >= "2026-08-26").length} shop visits`} tone={downtime > 20 ? "warning" : "default"} />
        <KPICard label="Next maintenance" value={fmtDateShort(t.nextMaintenanceDate)} icon={CalendarClock} hint={`or at ${num(t.nextMaintenanceKm)} km (${num(t.nextMaintenanceKm - t.mileageKm)} km to go)`} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Load utilization per trip</CardTitle>
                <CardDescription>Outbound vs return, % of configured payload — last 14 completed trips</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <TrendLines data={utilSeries} xKey="date" series={[{ key: "Outbound", name: "Outbound", color: SERIES[0] }, { key: "Return", name: "Return", color: SERIES[2] }]} valueFormat={(v) => `${v}%`} xFormat={fmtDateShort} labelFormat={fmtDateShort} domain={[0, 100]} height={220} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Trips</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Trip</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Load</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Trip cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {own.slice(0, 12).map((x) => (
                  <TableRow key={x.id} className="cursor-pointer" onClick={() => router.push(`/trips/${x.id}`)}>
                    <TableCell className="font-medium whitespace-nowrap text-primary">{x.id}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{routeById(x.routeId).name}</TableCell>
                    <TableCell className="whitespace-nowrap">{driverById(x.driverId).name}</TableCell>
                    <TableCell className="text-right tabular">{pct(metrics.get(x.id)!.outUtil)}</TableCell>
                    <TableCell className="text-right tabular">{pesoCompact(metrics.get(x.id)!.revenue)}</TableCell>
                    <TableCell className="text-right tabular">{peso(metrics.get(x.id)!.tripCost)}</TableCell>
                    <TableCell>
                      <StatusBadge status={x.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Maintenance history</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Work done</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead className="text-right">Downtime</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maint.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(m.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{m.type}</TableCell>
                    <TableCell className="text-muted-foreground">{m.description}</TableCell>
                    <TableCell className="text-xs">{m.shop}</TableCell>
                    <TableCell className="text-right tabular">{num(m.odometerKm)}</TableCell>
                    <TableCell className="text-right tabular">{m.downtimeHours} h</TableCell>
                    <TableCell className="text-right tabular">{peso(m.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Current trip</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {st.trip ? (
                <>
                  <Stat label="Trip" value={<Link href={`/trips/${st.trip.id}`} className="text-primary hover:underline">{st.trip.id}</Link>} sub={routeById(st.trip.routeId).name} />
                  <Stat label="Departure" value={fmtTime(st.trip.actualDeparture ?? st.trip.departure)} sub={`expected back ${fmtTime(st.trip.expectedReturn)}`} />
                  <CapacityBar used={metrics.get(st.trip.id)!.outboundLoadKg} capacity={t.capacityKg} label="Outbound" size="sm" />
                  <CapacityBar used={metrics.get(st.trip.id)!.returnLoadKg} capacity={t.capacityKg} label="Return" size="sm" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No trip scheduled today.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assigned driver</CardTitle>
            </CardHeader>
            <CardContent>
              <DriverMini id={st.trip?.driverId ?? t.primaryDriverId} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Expenses (30 days)</CardTitle>
                <CardDescription>{peso(sumBy(tExp, (e) => e.amount))} total</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Columns data={expByCat.map((e) => ({ cat: e.c.replace(" Allowance", " allow."), Amount: e.v }))} xKey="cat" series={[{ key: "Amount", name: "Amount" }]} height={200} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" /> LTO registration
                </span>
                <span className="text-muted-foreground">until {fmtDate(t.registrationExpiry)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="size-4 text-success" /> Comprehensive insurance
                </span>
                <span className="text-muted-foreground">until {fmtDate(t.insuranceExpiry)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function DriverMini({ id }: { id: string }) {
  const d = driverById(id);
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarFallback>{d.initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <Link href={`/drivers/${d.id}`} className="font-medium hover:underline">
          {d.name}
        </Link>
        <div className="text-xs text-muted-foreground">{d.phone}</div>
      </div>
      <Button variant="ghost" size="icon-sm" asChild aria-label={`Call ${d.name}`}>
        <a href={`tel:${d.phone.replace(/\s/g, "")}`}>
          <Phone />
        </a>
      </Button>
    </div>
  );
}

// ─── Drivers ────────────────────────────────────────────────────────────────
function driverStats(trips: Trip[], metrics: ReturnType<typeof useTripMetrics>, id: string) {
  const own = trips.filter((t) => t.driverId === id);
  const done = own.filter((t) => t.status === "Completed");
  const drops = done.flatMap((t) => metrics.get(t.id)!.deliveries.filter((d) => d.completedAt && d.arrivedAt));
  const onTime = drops.filter((d) => d.arrivedAt! <= d.eta || (new Date(d.arrivedAt!).getTime() - new Date(d.eta).getTime()) / 60000 <= 15).length;
  const current = own.find((t) => t.date === TODAY) ?? own.find((t) => t.status === "Planned");
  return { own, done, drops: drops.length, onTimeRate: drops.length ? onTime / drops.length : 1, current };
}

export function DriversView() {
  const router = useRouter();
  const { trips, metrics } = useFleetData();
  return (
    <>
      <PageHeader title="Drivers" description="Licensed heavy-truck drivers (Code C/CE). Each 10-wheeler has a primary and a relief driver." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Driver</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Assigned Truck</TableHead>
              <TableHead>Current Trip</TableHead>
              <TableHead className="text-right">Completed Trips</TableHead>
              <TableHead className="text-right">On-Time Rate</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DRIVERS.map((d) => {
              const s = driverStats(trips, metrics, d.id);
              const status = s.current?.date === TODAY && s.current.status === "In Transit" ? "On Trip" : s.current?.date === TODAY ? "Available" : d.status === "Rest Day" ? "Rest Day" : "Available";
              return (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => router.push(`/drivers/${d.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{d.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.licenseRestrictions}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular">{d.phone}</TableCell>
                  <TableCell className="whitespace-nowrap">{truckById(d.assignedTruckId).code}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.current ? (
                      <Link href={`/trips/${s.current.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                        {s.current.id}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular">{s.done.length}</TableCell>
                  <TableCell className="text-right tabular">{pct(s.onTimeRate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

export function DriverProfile({ id }: { id: string }) {
  const router = useRouter();
  const { trips, metrics } = useFleetData();
  const d = DRIVERS.find((x) => x.id === id);
  if (!d) return <RecordNotFound kind="Driver" id={id} backHref="/drivers" backLabel="Back to drivers" />;
  const s = driverStats(trips, metrics, id);
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Drivers", href: "/drivers" }, { label: d.name }]}
        title={d.name}
        description={`${truckById(d.assignedTruckId).code} · hired ${fmtDate(d.hiredDate)} · ${d.address}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${d.phone.replace(/\s/g, "")}`}>
              <Phone /> {d.phone}
            </a>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Completed trips (30 days)" value={s.done.length} icon={RouteIcon} />
        <KPICard label="Drops completed" value={s.drops} icon={Truck} />
        <KPICard label="On-time rate" value={pct(s.onTimeRate)} icon={Timer} hint="arrived within 15 min of ETA" tone={s.onTimeRate >= 0.8 ? "success" : "warning"} />
        <KPICard label="Current trip" value={s.current ? s.current.id.replace("TRIP-", "") : "—"} icon={UserRound} href={s.current ? `/trips/${s.current.id}` : undefined} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Trip history</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Trip</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Drops</TableHead>
                <TableHead>Departed</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...s.own].sort((a, b) => b.departure.localeCompare(a.departure)).slice(0, 15).map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/trips/${t.id}`)}>
                  <TableCell className="font-medium whitespace-nowrap text-primary">{t.id}</TableCell>
                  <TableCell>{truckById(t.truckId).code}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{routeById(t.routeId).name}</TableCell>
                  <TableCell className="text-right tabular">{metrics.get(t.id)!.deliveries.length}</TableCell>
                  <TableCell className="whitespace-nowrap tabular">{t.actualDeparture ? `${fmtDateShort(t.date)} ${fmtTime(t.actualDeparture)}` : "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular">{t.actualReturn ? fmtTime(t.actualReturn) : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>License & contacts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Stat label="License no." value={<span className="font-mono">{d.licenseNo}</span>} sub={d.licenseRestrictions} />
            <Stat label="License expiry" value={fmtDate(d.licenseExpiry)} />
            <Stat label="Emergency contact" value={d.emergencyContact} />
            <Stat label="Primary truck" value={<Link href={`/trucks/${d.assignedTruckId}`} className="text-primary hover:underline">{truckById(d.assignedTruckId).name}</Link>} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
