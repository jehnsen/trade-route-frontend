"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CornerDownLeft, Flag, Fuel, MapPin, PackageCheck, PackagePlus, Phone, Play, Plus, Printer, Truck, UserRound, Warehouse, XCircle, type LucideIcon } from "lucide-react";
import type { Delivery, StopType, Trip, TripStop } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useInvoiceMap, useTripMetrics } from "@/hooks/use-data";
import { routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { helperById } from "@/data/company";
import { DEMO_DIESEL_PRICE, DELIVERY_DONE, jobPaymentStatus, jobTotal, minutesLate, tripProgress, tripWarnings, type TripMetrics } from "@/lib/logistics";
import { loadsSummary, tripRouteLine } from "@/lib/domain";
import { fmtDateTime, fmtDay, fmtTime, kg, num, peso, pct } from "@/lib/format";
import { cn, groupBy, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator } from "@/components/ui/primitives";
import { Field, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapacityBar, EmptyState, LineItem, PageHeader, Stat, Timeline, type TimelineItem } from "@/components/shared/common";
import { LegBadge, LoadTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import { PodCard } from "@/components/shared/pod";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecordNotFound } from "@/components/shared/states";
import { AddExpenseDialog } from "@/features/finance/add-expense-dialog";
import { FuelLogDialog } from "@/features/fleet/fuel-log-dialog";
import { CargoManifestCard } from "@/features/loads/loads-view";
import { PodDialog, ReportIssueDialog } from "@/features/deliveries/delivery-dialogs";

const STOP_ICON: Record<StopType, LucideIcon> = { Pickup: PackagePlus, Delivery: MapPin, "Backhaul Pickup": CornerDownLeft, Fuel, Port: Truck, Warehouse, Other: Flag };

export function TripDetail({ id }: { id: string }) {
  const trip = useAppStore((s) => s.trips.find((t) => t.id === id));
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const setTripStatus = useAppStore((s) => s.setTripStatus);
  const m = useTripMetrics().get(id);
  const [dialog, setDialog] = React.useState<"expense" | "fuel" | "close" | null>(null);

  if (!trip || !m) return <RecordNotFound kind="Trip" id={id} backHref="/trips" backLabel="Back to trips" />;

  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const warnings = tripWarnings(trip, m, trips, maintenance, documents);
  const pods = m.deliveries.filter((d) => d.pod);
  const openDeliveries = m.deliveries.filter((d) => !DELIVERY_DONE.includes(d.status));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Trips", href: "/trips" }, { label: trip.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {trip.id} <StatusBadge status={trip.status} />
          </span>
        }
        description={`${fmtDay(trip.date)} · ${truck.code} (${truck.plateNo}) · ${driver.name} · ${tripRouteLine(trip)}`}
        actions={
          <>
            {trip.status === "Planned" && (
              <Button size="sm" variant="outline" onClick={() => void act(() => setTripStatus(trip.id, "Loading"), () => toast.success(`Loading started for ${trip.id}`))}>
                <PackagePlus /> Start loading
              </Button>
            )}
            {trip.status === "Loading" && (
              <Button size="sm" variant="outline" onClick={() => void act(() => setTripStatus(trip.id, "Ready"), () => toast.success(`${trip.id} loaded and ready`))}>
                <PackageCheck /> Loading complete
              </Button>
            )}
            {(trip.status === "Planned" || trip.status === "Loading" || trip.status === "Ready") && (
              <ConfirmDialog
                trigger={
                  <Button size="sm">
                    <Play /> Dispatch — truck departed
                  </Button>
                }
                title={`Dispatch ${trip.id}?`}
                description={`${m.jobs.filter((j) => j.leg === "outbound").length} outbound jobs (${kg(m.outboundKg)}) will be marked In Transit. Outbound cargo is locked after departure.`}
                confirmLabel="Mark departed"
                onConfirm={() => void act(() => setTripStatus(trip.id, "Dispatched"), () => toast.success(`${truck.code} departed Lucena`, { description: `${trip.id} is on the road.` }))}
              />
            )}
            {(trip.status === "Dispatched" || trip.status === "In Transit" || trip.status === "Returning") && (
              <Button size="sm" onClick={() => setDialog("close")}>
                <Flag /> Close trip — back in Lucena
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDialog("fuel")}>
              <Fuel /> Log fuel
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("expense")}>
              <Plus /> Add expense
            </Button>
            {(trip.status === "Planned" || trip.status === "Loading" || trip.status === "Ready") && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/dispatch">
                  <Truck /> Assign cargo
                </Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer /> Print manifest
            </Button>
            {trip.status === "Planned" && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" className="text-danger">
                    <XCircle /> Cancel trip
                  </Button>
                }
                title={`Cancel ${trip.id}?`}
                description="All jobs go back to Awaiting Dispatch and the stops are cleared."
                confirmLabel="Cancel trip"
                destructive
                onConfirm={() => void act(() => setTripStatus(trip.id, "Cancelled"), () => toast(`${trip.id} cancelled`))}
              />
            )}
          </>
        }
      />
      {trip.notes && <div className="mb-3 rounded-lg border border-[oklch(0.85_0.08_85)] bg-warning-soft px-4 py-2.5 text-sm">{trip.notes}</div>}
      {warnings.length > 0 && (
        <ul className="mb-4 grid gap-1.5">
          {warnings.map((w) => (
            <li key={w.message} className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger-soft px-4 py-2 text-sm font-medium text-danger" role="alert">
              <AlertTriangle className="size-4" /> {w.message}
            </li>
          ))}
        </ul>
      )}

      <Tabs defaultValue="overview">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="stops">Route & Stops ({trip.stops.length})</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({m.jobs.length})</TabsTrigger>
            <TabsTrigger value="manifest">Cargo Manifest</TabsTrigger>
            <TabsTrigger value="deliveries">Deliveries ({m.deliveryCount})</TabsTrigger>
            <TabsTrigger value="backhaul">Backhaul</TabsTrigger>
            <TabsTrigger value="expenses">Expenses ({m.expenses.length})</TabsTrigger>
            <TabsTrigger value="pod">Proof of Delivery ({pods.length})</TabsTrigger>
            <TabsTrigger value="financials">Trip Financials</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <Overview trip={trip} m={m} openDeliveries={openDeliveries.length} />
        </TabsContent>
        <TabsContent value="stops" className="mt-4">
          <StopsTab trip={trip} m={m} />
        </TabsContent>
        <TabsContent value="jobs" className="mt-4">
          <JobsTab m={m} />
        </TabsContent>
        <TabsContent value="manifest" className="mt-4 grid gap-4 lg:grid-cols-2">
          <CargoManifestCard title="Outbound manifest" description="Loaded at Lucena for delivery" loads={m.outboundLoads} capacity={m.capacityKg} empty="No outbound cargo assigned yet." />
          <CargoManifestCard title="Return manifest" description="Backhaul picked up on the way home" loads={m.returnLoads} capacity={m.capacityKg} empty="No return cargo yet — see Backhaul." />
        </TabsContent>
        <TabsContent value="deliveries" className="mt-4">
          <DeliveriesTab trip={trip} m={m} />
        </TabsContent>
        <TabsContent value="backhaul" className="mt-4">
          <BackhaulTab trip={trip} m={m} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab m={m} onAdd={() => setDialog("expense")} onFuel={() => setDialog("fuel")} />
        </TabsContent>
        <TabsContent value="pod" className="mt-4">
          <PodTab m={m} />
        </TabsContent>
        <TabsContent value="financials" className="mt-4">
          <FinancialsTab m={m} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab trip={trip} m={m} />
        </TabsContent>
      </Tabs>

      <AddExpenseDialog open={dialog === "expense"} onOpenChange={(v) => setDialog(v ? "expense" : null)} tripId={trip.id} />
      {dialog === "fuel" && <FuelLogDialog open onOpenChange={(v) => !v && setDialog(null)} tripId={trip.id} />}
      {dialog === "close" && <CloseTripDialog trip={trip} m={m} openDeliveries={openDeliveries.length} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}

function Overview({ trip, m, openDeliveries }: { trip: Trip; m: TripMetrics; openDeliveries: number }) {
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const route = routeById(trip.routeId);
  const progress = tripProgress(trip);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Route</CardTitle>
          <span className="text-xs text-muted-foreground">{route.name}</span>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="font-medium">{tripRouteLine(trip)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Departure" value={fmtTime(trip.actualDeparture ?? trip.departure)} sub={trip.actualDeparture ? `planned ${fmtTime(trip.departure)}` : "planned"} />
            <Stat label={trip.actualReturn ? "Actual return" : "Expected return"} value={fmtTime(trip.actualReturn ?? trip.expectedReturn)} sub={trip.actualReturn ? `planned ${fmtTime(trip.expectedReturn)}` : undefined} />
            <Stat label="Distance" value={`${num(m.distanceKm)} km`} sub={m.distanceIsActual ? "from odometer" : "planned round trip"} />
            <Stat label="Odometer" value={trip.odometerStart ? `${num(trip.odometerStart)}` : "—"} sub={trip.odometerEnd ? `end ${num(trip.odometerEnd)}` : trip.odometerStart ? "start" : "recorded at dispatch"} />
            <Stat label="Stops" value={`${progress.done} of ${progress.total} done`} sub={progress.next ? `next: ${progress.next.location.name}` : undefined} className="col-span-2" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Truck & crew</CardTitle>
          <Link href={`/trucks/${truck.id}`} className="text-xs font-medium text-primary hover:underline">
            Truck profile
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <Truck className="size-5" />
            </span>
            <div>
              <div className="font-medium">
                {truck.code} · {truck.plateNo}
              </div>
              <div className="text-xs text-muted-foreground">
                {truck.name} · payload {kg(truck.capacityKg)}
              </div>
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <Link href={`/drivers/${driver.id}`} className="font-medium hover:underline">
                  {driver.name}
                </Link>
                <div className="text-xs text-muted-foreground">Driver · {driver.phone}</div>
              </div>
            </div>
            <Button variant="outline" size="icon-sm" asChild>
              <a href={`tel:${driver.phone.replace(/\s/g, "")}`} aria-label={`Call ${driver.name}`}>
                <Phone />
              </a>
            </Button>
          </div>
          {trip.helperIds.map((h) => (
            <div key={h} className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <div>{helperById(h)?.name}</div>
                <div className="text-xs text-muted-foreground">Helper · {helperById(h)?.phone}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Load & capacity</CardTitle>
            <CardDescription>Configured payload {kg(m.capacityKg)} · gross weights</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label="Outbound" />
          <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Unused return capacity" value={kg(Math.max(0, m.capacityKg - m.returnKg))} />
            <Stat label="Loaded / empty km" value={`${num(m.loadedKm)} / ${num(m.emptyKm)}`} />
            <Stat label="Deliveries" value={`${m.delivered} of ${m.deliveryCount}`} sub={openDeliveries ? `${openDeliveries} open` : "all done"} />
            <Stat label="Contribution" value={peso(m.contribution)} sub={m.dieselLogged ? "logged costs" : "incl. est. diesel"} />
          </div>
          {m.retUtil < 0.6 && trip.status !== "Completed" && trip.status !== "Cancelled" && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/backhaul">Find backhaul for {kg(m.capacityKg - m.returnKg)}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StopsTab({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const markArrived = useAppStore((s) => s.markStopArrived);
  const completeStop = useAppStore((s) => s.completeStop);
  const customers = useCustomerMap();
  const departed = !!trip.actualDeparture && trip.status !== "Completed";
  const loadMap = new Map(m.loads.map((l) => [l.id, l]));
  const weight = (ids: string[]) => sumBy(ids.map((i) => loadMap.get(i)).filter((l): l is NonNullable<typeof l> => !!l), (l) => l.weightKg);
  if (!trip.stops.length) return <EmptyState title="No stops yet" description="Assign jobs on the Dispatch board to build the route." />;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Route & stops</CardTitle>
          <CardDescription>Planned vs actual times · delivery stops are completed from the Deliveries tab or the driver app</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-0">
          {trip.stops.map((s, i) => {
            const Icon = STOP_ICON[s.type];
            const late = s.actualArrival ? minutesLate(s.plannedArrival, s.actualArrival) : 0;
            const loaded = s.loaded.map((x) => loadMap.get(x)).filter((l): l is NonNullable<typeof l> => !!l);
            const unloaded = s.unloaded.map((x) => loadMap.get(x)).filter((l): l is NonNullable<typeof l> => !!l);
            const isDrop = s.type === "Delivery" || (s.type === "Port" && s.unloaded.length > 0);
            return (
              <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0">
                {i < trip.stops.length - 1 && <span className={cn("absolute top-8 left-[15px] h-[calc(100%-1.5rem)] w-0.5", s.status === "Completed" ? "bg-primary/50" : "bg-border")} aria-hidden />}
                <span
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                    s.status === "Completed" && "border-primary bg-primary text-white",
                    s.status === "Arrived" && "border-primary bg-card text-primary ring-4 ring-primary/15",
                    s.status === "Pending" && "border-border bg-card text-muted-foreground",
                    s.status === "Skipped" && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {s.status === "Completed" && s.type !== "Warehouse" ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </span>
                <div className="grid min-w-0 flex-1 gap-1 lg:grid-cols-[1fr_auto] lg:gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        {s.seq}. {s.type}
                      </span>
                      <StatusBadge status={s.status} icon={false} className="text-[10px]" />
                      {late > 20 && <span className="rounded bg-danger-soft px-1.5 text-[11px] font-medium text-danger">+{late} min</span>}
                    </div>
                    <div className="font-medium">
                      {s.customerId ? (
                        <Link href={`/customers/${s.customerId}`} className="hover:underline">
                          {s.location.name}
                        </Link>
                      ) : (
                        s.location.name
                      )}
                    </div>
                    {s.location.address && <div className="text-xs text-muted-foreground">{s.location.address}</div>}
                    {s.contactName && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {s.contactName} · {s.contactPhone}
                      </div>
                    )}
                    {loaded.length > 0 && (
                      <div className="mt-1 text-xs">
                        <span className="font-medium text-[oklch(0.45_0.13_150)]">Load {kg(weight(s.loaded))}:</span> <span className="text-muted-foreground">{loadsSummary(loaded, 3)}</span>
                      </div>
                    )}
                    {unloaded.length > 0 && (
                      <div className="text-xs">
                        <span className="font-medium text-primary">Unload {kg(weight(s.unloaded))}:</span> <span className="text-muted-foreground">{loadsSummary(unloaded, 3)}</span>
                        {s.customerId && unloaded[0]?.jobId && <span className="text-muted-foreground"> · {customers.get(s.customerId)?.name === s.location.name ? "" : customers.get(s.customerId)?.name}</span>}
                      </div>
                    )}
                    {s.notes && <div className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-xs">{s.notes}</div>}
                  </div>
                  <div className="flex flex-wrap items-start gap-3 text-xs tabular lg:justify-end">
                    <div className="lg:text-right">
                      <div className="text-muted-foreground">Arrival</div>
                      <div className="font-medium">{s.actualArrival ? fmtTime(s.actualArrival) : "—"}</div>
                      <div className="text-muted-foreground">plan {fmtTime(s.plannedArrival)}</div>
                    </div>
                    <div className="lg:text-right">
                      <div className="text-muted-foreground">Departure</div>
                      <div className="font-medium">{s.actualDeparture ? fmtTime(s.actualDeparture) : "—"}</div>
                      <div className="text-muted-foreground">plan {fmtTime(s.plannedDeparture)}</div>
                    </div>
                    {departed && !isDrop && s.status !== "Completed" && i > 0 && (
                      <div className="flex gap-1">
                        {s.status === "Pending" && (
                          <Button size="sm" variant="outline" onClick={() => void act(() => markArrived(trip.id, s.id), () => toast.success(`Arrived at ${s.location.name}`))}>
                            Arrived
                          </Button>
                        )}
                        <Button size="sm" onClick={() => void act(() => completeStop(trip.id, s.id), () => toast.success(s.type === "Backhaul Pickup" ? `Backhaul loaded at ${s.location.name}` : `${s.location.name} done`))}>
                          {s.type === "Backhaul Pickup" ? "Loaded" : s.type === "Warehouse" ? "Unloaded" : "Done"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function JobsTab({ m }: { m: TripMetrics }) {
  const customers = useCustomerMap();
  const invoiceMap = useInvoiceMap();
  if (!m.jobs.length) return <EmptyState title="No jobs on this trip" description="Assign jobs on the Dispatch board." />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Job</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Leg</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Freight</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <Link href={`/jobs/${j.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
                    {j.id}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{customers.get(j.customerId)?.name}</div>
                  <div className="text-xs text-muted-foreground">{j.dropoff.name}</div>
                </TableCell>
                <TableCell>
                  <LegBadge leg={j.leg} />
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{j.cargoDescription}</TableCell>
                <TableCell className="text-right tabular">{kg(j.weightKg)}</TableCell>
                <TableCell className="text-right tabular">{peso(jobTotal(j))}</TableCell>
                <TableCell>
                  <StatusBadge status={jobPaymentStatus(j, invoiceMap.get(j.id))} icon={false} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={j.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4}>Total</TableCell>
              <TableCell className="text-right tabular">{kg(sumBy(m.jobs, (j) => j.weightKg))}</TableCell>
              <TableCell className="text-right tabular">{peso(m.revenue)}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </Card>
  );
}

function DeliveriesTab({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const customers = useCustomerMap();
  const markArrived = useAppStore((s) => s.markArrived);
  const [pod, setPod] = React.useState<Delivery | null>(null);
  const [issue, setIssue] = React.useState<Delivery | null>(null);
  const active = !!trip.actualDeparture && trip.status !== "Completed";
  if (!m.deliveries.length) return <EmptyState title="No deliveries on this trip" />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Delivery</TableHead>
              <TableHead>Consignee</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead>Arrived</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.deliveries.map((d) => {
              const job = m.jobs.find((j) => j.id === d.jobId);
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <Link href={`/deliveries/${d.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
                      {d.id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{customers.get(d.customerId)?.name}</div>
                    <div className="text-xs text-muted-foreground">{job?.dropoff.name}</div>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {job?.cargoDescription} · {kg(job?.weightKg ?? 0)}
                  </TableCell>
                  <TableCell className="tabular">{fmtTime(d.eta)}</TableCell>
                  <TableCell className="tabular">{d.arrivedAt ? fmtTime(d.arrivedAt) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={d.status} />
                      {d.issues.length > 0 && <AlertTriangle className="size-3.5 text-[oklch(0.6_0.14_65)]" aria-label={`${d.issues.length} issue(s)`} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {active && !DELIVERY_DONE.includes(d.status) ? (
                      <div className="flex justify-end gap-1">
                        {d.status !== "Arrived" && (
                          <Button size="sm" variant="outline" onClick={() => void act(() => markArrived(d.id), () => toast.success(`Arrived — ${customers.get(d.customerId)?.name}`))}>
                            Arrived
                          </Button>
                        )}
                        <Button size="sm" variant="success" onClick={() => setPod(d)}>
                          Delivered
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setIssue(d)} aria-label="Report issue">
                          <AlertTriangle />
                        </Button>
                      </div>
                    ) : d.status === "Delivered" && (d.pod?.photoCount ?? 0) === 0 ? (
                      <Button size="sm" variant="outline" onClick={() => setPod(d)}>
                        Upload POD
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {pod && <PodDialog delivery={pod} mode={pod.status === "Delivered" ? "upload" : "deliver"} open onOpenChange={(v) => !v && setPod(null)} />}
      {issue && <ReportIssueDialog delivery={issue} open onOpenChange={(v) => !v && setIssue(null)} />}
    </Card>
  );
}

function BackhaulTab({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const customers = useCustomerMap();
  const paidJobs = m.jobs.filter((j) => j.leg === "return");
  const paidRevenue = sumBy(paidJobs, jobTotal);
  const unused = Math.max(0, m.capacityKg - m.returnKg);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Return cargo</CardTitle>
            <CardDescription>A trip is not complete until the return leg is accounted for</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/backhaul">Backhaul planner</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          {m.returnLoads.length === 0 ? (
            <EmptyState className="mx-4 sm:mx-5" title="No backhaul on this trip" description={`${kg(unused)} of return capacity is empty.`} />
          ) : (
            <ul className="divide-y">
              {m.returnLoads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.cargoDescription}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.jobId ? (
                        <Link href={`/jobs/${l.jobId}`} className="hover:underline">
                          {l.jobId} · {customers.get(l.customerId ?? "")?.name}
                        </Link>
                      ) : (
                        `Company cargo${l.estimatedValue ? ` · value ${peso(l.estimatedValue)}` : ""}`
                      )}{" "}
                      · {l.pickup.name} → {l.destination.name}
                    </div>
                  </div>
                  <div className="grid shrink-0 justify-items-end gap-1">
                    <span className="text-sm font-medium tabular">{kg(l.weightKg)}</span>
                    <LoadTypeBadge type={l.type} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Return utilization</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return load" />
          <LineItem label="Paid backhaul freight" value={peso(paidRevenue)} />
          <LineItem label="Company cargo value (not revenue)" value={peso(m.companyCargoValue)} muted />
          <LineItem label="Paid return kg" value={kg(m.paidReturnKg)} muted />
          <LineItem label="Company-owned kg" value={kg(m.companyReturnKg)} muted />
          <Separator />
          <LineItem label="Unused return capacity" value={kg(unused)} strong />
          {unused > 1000 && trip.status !== "Completed" && trip.status !== "Cancelled" && (
            <div className="rounded-md bg-accent/60 px-3 py-2 text-xs">
              {truckById(trip.truckId).code} has <b>{kg(unused)}</b> unused return capacity on this trip.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExpensesTab({ m, onAdd, onFuel }: { m: TripMetrics; onAdd: () => void; onFuel: () => void }) {
  const byCat = Object.entries(groupBy(m.expenses, (e) => e.category)).map(([cat, list]) => ({ cat, total: sumBy(list, (e) => e.amount) }));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="overflow-hidden lg:col-span-2">
        <CardHeader>
          <CardTitle>Trip expenses</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onFuel}>
              <Fuel /> Log fuel
            </Button>
            <Button size="sm" onClick={onAdd}>
              <Plus /> Add expense
            </Button>
          </div>
        </CardHeader>
        {m.expenses.length === 0 ? (
          <EmptyState className="m-4" title="No expenses recorded yet" description="Tolls, allowances and fuel appear here as they are logged." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Paid to</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{fmtDay(e.date)}</TableCell>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                    <TableCell>{e.paidTo}</TableCell>
                    <TableCell className="text-right tabular">{peso(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total logged</TableCell>
                  <TableCell className="text-right tabular">{peso(m.expenseTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {byCat.map((c) => (
            <LineItem key={c.cat} label={c.cat} value={peso(c.total)} />
          ))}
          {!m.dieselLogged && m.estimatedDiesel > 0 && <LineItem label="Diesel (estimated, not yet logged)" value={peso(m.estimatedDiesel)} muted />}
          <Separator />
          <LineItem label="Expense per km" value={peso(m.costPerKm, true)} strong />
        </CardContent>
      </Card>
    </div>
  );
}

function PodTab({ m }: { m: TripMetrics }) {
  const customers = useCustomerMap();
  const pods = m.deliveries.filter((d) => d.pod);
  if (!pods.length) return <EmptyState title="No proof of delivery yet" description="PODs appear here as the driver completes drops." />;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {pods.map((d) => (
        <PodCard key={d.id} pod={d.pod!} title={customers.get(d.customerId)?.name ?? ""} subtitle={`${d.jobId} · ${d.id}`} />
      ))}
    </div>
  );
}

function FinancialsTab({ m }: { m: TripMetrics }) {
  const byCat = Object.entries(groupBy(m.expenses, (e) => e.category)).map(([cat, list]) => ({ cat, total: sumBy(list, (e) => e.amount) }));
  const totalCost = m.expenseTotal + m.estimatedDiesel;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>Trip financials</CardTitle>
            <CardDescription>Freight revenue + additional charges − trip expenses = trip contribution (before fixed costs like salaries, depreciation and insurance)</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <LineItem label="Freight revenue" value={peso(m.freightRevenue)} strong />
          <LineItem label="Additional charges" value={peso(m.additionalCharges)} />
          <LineItem label="Total trip revenue" value={peso(m.revenue)} strong className="border-t pt-2" />
          <div className="mt-2 text-xs font-medium text-muted-foreground">Trip expenses</div>
          {byCat.map((c) => (
            <LineItem key={c.cat} label={c.cat} value={`−${peso(c.total)}`} muted />
          ))}
          {!m.dieselLogged && m.estimatedDiesel > 0 && <LineItem label="Diesel (estimated until fill-up is logged)" value={`−${peso(m.estimatedDiesel)}`} muted />}
          <LineItem label="Total trip expenses" value={`−${peso(totalCost)}`} />
          <Separator className="my-1" />
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Trip contribution</span>
            <span className={cn("text-2xl font-semibold tabular", m.contribution >= 0 ? "text-[oklch(0.45_0.13_150)]" : "text-danger")}>{peso(m.contribution)}</span>
          </div>
          <div className="text-xs text-muted-foreground">Contribution margin {pct(m.revenue ? m.contribution / m.revenue : 0, 1)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Unit economics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <LineItem label="Distance" value={`${num(m.distanceKm)} km${m.distanceIsActual ? "" : " (planned)"}`} />
          <LineItem label="Revenue per km" value={peso(m.revenue / Math.max(1, m.distanceKm), true)} />
          <LineItem label="Cost per km" value={peso(m.costPerKm, true)} />
          <LineItem label="Revenue per trip" value={peso(m.revenue)} />
          <LineItem label="Expense per trip" value={peso(totalCost)} />
          <LineItem label="Revenue per kg hauled" value={peso(m.revenue / Math.max(1, m.outboundKg + m.returnKg), true)} />
          <Separator />
          <LineItem label="Company cargo value (backhaul)" value={peso(m.companyCargoValue)} muted />
          <p className="text-xs text-muted-foreground">Company-owned cargo is shown at purchase value and is not counted as freight revenue.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineTab({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const customers = useCustomerMap();
  const items: (TimelineItem & { sort: string })[] = [
    ...trip.history.map((e) => ({ sort: e.at, at: fmtDateTime(e.at), title: e.label, meta: e.by, note: e.note })),
    ...trip.stops.flatMap((s: TripStop) => [
      ...(s.actualArrival && s.seq > 1 ? [{ sort: s.actualArrival, at: fmtDateTime(s.actualArrival), title: `Arrived — ${s.location.name}`, meta: s.type }] : []),
      ...(s.type === "Backhaul Pickup" && s.actualDeparture ? [{ sort: s.actualDeparture, at: fmtDateTime(s.actualDeparture), title: `Backhaul loaded — ${s.location.name}`, meta: loadsSummary(m.loads.filter((l) => s.loaded.includes(l.id))) }] : []),
    ]),
    ...m.deliveries.filter((d) => d.pod).map((d) => ({ sort: d.pod!.signedAt, at: fmtDateTime(d.pod!.signedAt), title: `Delivered — ${customers.get(d.customerId)?.name}`, meta: `POD ${d.pod!.receiptNo} · received by ${d.pod!.receivedBy}` })),
    ...m.deliveries.flatMap((d) => d.issues.map((i) => ({ sort: i.reportedAt, at: fmtDateTime(i.reportedAt), title: `Issue: ${i.type}`, meta: i.reportedBy, note: i.note, state: "failed" as const }))),
  ].sort((a, b) => a.sort.localeCompare(b.sort));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trip timeline</CardTitle>
      </CardHeader>
      <CardContent>{items.length ? <Timeline items={items} /> : <p className="text-sm text-muted-foreground">No events yet.</p>}</CardContent>
    </Card>
  );
}

function CloseTripDialog({ trip, m, openDeliveries, open, onOpenChange }: { trip: Trip; m: TripMetrics; openDeliveries: number; open: boolean; onOpenChange: (v: boolean) => void }) {
  const complete = useAppStore((s) => s.completeTrip);
  const [saving, setSaving] = React.useState(false);
  const truck = truckById(trip.truckId);
  const start = trip.odometerStart ?? truck.mileageKm;
  const [odo, setOdo] = React.useState(String(start + routeById(trip.routeId).roundTripKm));
  const [logFuel, setLogFuel] = React.useState(!m.dieselLogged);
  const [liters, setLiters] = React.useState(String(Math.round(routeById(trip.routeId).roundTripKm / truck.fuelEfficiencyKmPerL)));
  const [price, setPrice] = React.useState(String(DEMO_DIESEL_PRICE));
  const [error, setError] = React.useState<string>();
  const km = Number(odo) - start;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close {trip.id}</DialogTitle>
          <DialogDescription>Record the truck&apos;s return to Lucena. Remaining stops are marked done and return cargo is unloaded at the bodega.</DialogDescription>
        </DialogHeader>
        {openDeliveries > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {openDeliveries} deliver{openDeliveries === 1 ? "y is" : "ies are"} still open. Capture POD or report the issue first — failed drops return to dispatch when the trip closes.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Odometer at return (km)" htmlFor="ct-odo" error={error} required hint={`Start ${start.toLocaleString("en-PH")} km · ${Number.isFinite(km) ? km : 0} km driven`}>
            <Input id="ct-odo" type="number" value={odo} onChange={(e) => setOdo(e.target.value)} aria-invalid={!!error} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={logFuel} onChange={(e) => setLogFuel(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Log full-tank diesel fill-up
          </label>
          {logFuel && (
            <>
              <Field label="Litres" htmlFor="ct-l">
                <Input id="ct-l" type="number" value={liters} onChange={(e) => setLiters(e.target.value)} />
              </Field>
              <Field label="Price per litre (₱)" htmlFor="ct-p" hint="Demo rate">
                <Input id="ct-p" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              const end = Math.round(Number(odo));
              if (!Number.isFinite(end) || end <= start) return setError("Must be higher than the starting odometer");
              setSaving(true);
              await act(
                () => complete(trip.id, { odometerEnd: end, fuel: logFuel && Number(liters) > 0 ? { liters: Number(liters), pricePerLiter: Number(price) || DEMO_DIESEL_PRICE, station: "Petron — Diversion Rd., Lucena" } : undefined }),
                () => {
                  toast.success(`${trip.id} closed`, { description: `${end - start} km · contribution recalculated with logged diesel.` });
                  onOpenChange(false);
                },
              );
              setSaving(false);
            }}
          >
            <Flag /> Close trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
