"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CalendarPlus, Clock3, GripVertical, Lock, MapPin, PackageCheck, Plus, Route, Truck, UserRound, X, type LucideIcon } from "lucide-react";
import type { AreaId, LogisticsJob, Trip } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, ROUTES, routeById } from "@/data/areas";
import { TRUCKS, DRIVERS, driverById, driverUnavailability, truckById } from "@/data/fleet";
import { HELPERS } from "@/data/company";
import { canAddReturnCargo, isTripEditable, jobTotal, tripWarnings, truckStatus, unassignedJobs } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, kg, peso } from "@/lib/format";
import { cn, groupBy, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Checkbox, Input } from "@/components/ui/primitives";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CapacityBar, EmptyState, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

const DND_TYPE = "application/x-tradeloop-jobs";
const CAP = 8500;

export function DispatchBoard() {
  const jobs = useAppStore((s) => s.jobs);
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const assign = useAppStore((s) => s.assignJobToTrip);
  const metrics = useTripMetrics();
  const customers = useCustomerMap();
  const openDates = [...new Set(unassignedJobs(jobs).map((j) => j.pickupAt.slice(0, 10)))].filter((d) => d > TOMORROW).sort();
  const dates = [TODAY, TOMORROW, ...openDates].slice(0, 5);
  const [date, setDate] = React.useState(TODAY);
  const [dragging, setDragging] = React.useState<{ ids: string[]; leg: "outbound" | "return" } | null>(null);
  const [planning, setPlanning] = React.useState<string | null>(null);

  const dayTrips = trips.filter((t) => t.date === date && t.status !== "Cancelled").sort((a, b) => a.truckId.localeCompare(b.truckId));
  const open = unassignedJobs(jobs, date);
  const outbound = open.filter((j) => j.leg === "outbound");
  const inbound = open.filter((j) => j.leg === "return");
  const freeTrucks = TRUCKS.filter((t) => !dayTrips.some((x) => x.truckId === t.id));
  const draggingKg = dragging ? sumBy(dragging.ids.map((id) => jobs.find((j) => j.id === id)!).filter(Boolean), (j) => j.weightKg) : 0;

  const doAssign = async (ids: string[], trip: Trip) => {
    const list = ids.map((id) => jobs.find((j) => j.id === id)!).filter(Boolean);
    const leg = list[0]?.leg ?? "outbound";
    if (leg === "outbound" ? !isTripEditable(trip) : !canAddReturnCargo(trip)) {
      toast.error(`${trip.id} has departed — outbound cargo is locked`, { description: "Only return-leg cargo can still be added." });
      return;
    }
    const m = metrics.get(trip.id)!;
    const add = sumBy(list, (j) => j.weightKg);
    for (const j of list) if (!(await act(() => assign(j.id, trip.id)))) return;
    const after = (leg === "outbound" ? m.outboundKg : m.returnKg) + add;
    const truck = truckById(trip.truckId);
    if (after > m.capacityKg) toast.warning(`${truck.code} ${leg === "outbound" ? "outbound" : "return"} capacity exceeded by ${kg(after - m.capacityKg)}`, { description: "Move a job to the other truck or split the cargo." });
    else toast.success(`${list.length} job${list.length > 1 ? "s" : ""} assigned to ${truck.code}`, { description: `${kg(m.capacityKg - after)} remaining on the ${leg === "outbound" ? "outbound" : "return"} leg of ${trip.id}` });
  };

  const renderGroup = (title: string, list: LogisticsJob[], key: (j: LogisticsJob) => AreaId, leg: "outbound" | "return") => {
    if (!list.length) return null;
    const groups = Object.entries(groupBy(list, key)).sort((a, b) => b[1].length - a[1].length);
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span className={cn("flex size-6 items-center justify-center rounded-md", leg === "outbound" ? "bg-accent text-primary" : "bg-info-soft text-info")}>
            {leg === "outbound" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}
          </span>
          <span>{title}</span>
          <span className="ml-auto tabular">{kg(sumBy(list, (j) => j.weightKg))}</span>
        </div>
        {groups.map(([areaId, items]) => {
          const ids = items.map((j) => j.id);
          return (
            <Card key={areaId} className="dispatch-job-group gap-0 overflow-hidden">
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_TYPE, ids.join(","));
                  e.dataTransfer.effectAllowed = "move";
                  setDragging({ ids, leg });
                }}
                onDragEnd={() => setDragging(null)}
                className="flex cursor-grab items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-3.5 py-3 active:cursor-grabbing"
                title="Drag the whole group onto a truck"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-[13px] font-semibold">{areaName(areaId as AreaId)}</div>
                    <div className="text-xs text-muted-foreground tabular">
                      {items.length} job{items.length > 1 ? "s" : ""} · {kg(sumBy(items, (j) => j.weightKg))}
                    </div>
                  </div>
                </div>
                <AssignMenu trips={dayTrips} leg={leg} onPick={(t) => doAssign(ids, t)} label="Assign all" />
              </div>
              <ul className="divide-y">
                {items.map((j) => {
                  const c = customers.get(j.customerId);
                  const hold = j.notes?.toLowerCase().includes("credit hold");
                  return (
                    <li
                      key={j.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_TYPE, j.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging({ ids: [j.id], leg });
                      }}
                      onDragEnd={() => setDragging(null)}
                      className="group cursor-grab px-3.5 py-3.5 transition-colors hover:bg-muted/30 active:cursor-grabbing"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{j.id}</span>
                        <GripVertical className="size-3.5 text-muted-foreground/50" aria-hidden />
                      </div>
                      <div className="min-w-0">
                          <Link href={`/jobs/${j.id}`} className="block text-[13px] font-semibold hover:text-primary hover:underline">
                            {c?.name}
                          </Link>
                        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {j.cargoDescription}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{leg === "outbound" ? `Due ${fmtTime(j.requiredBy)}` : `Pickup · ${j.pickup.name}`}</div>
                        {hold && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-danger">
                            <AlertTriangle className="size-3" /> Credit hold — confirm with accounting
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs tabular">
                        <span className="font-semibold">{kg(j.weightKg)}</span>
                        <span className="text-border">/</span>
                        <span className="text-muted-foreground">{peso(jobTotal(j))}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed pt-3">
                        <StatusBadge status={j.status} icon={false} className="text-[10px]" />
                        <AssignMenu trips={dayTrips} leg={leg} onPick={(t) => doAssign([j.id], t)} label="Assign" compact />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
    );
  };

  const activeTrips = trips.filter((t) => ["Loading", "Ready", "Dispatched", "In Transit", "Returning"].includes(t.status));

  return (
    <div className="dispatch-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><Route className="size-3.5" /> Fleet operations</div>
      <PageHeader
        title="Dispatch"
        description="Plan the load. Connect the route. Keep freight moving."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/trips"><Route /> View trips</Link></Button>
            <Button asChild><Link href="/jobs/new"><Plus /> New job</Link></Button>
          </>
        }
      />
      <div className="dispatch-summary mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <DispatchMetric label="Unassigned jobs" value={String(open.length).padStart(2, "0")} icon={PackageCheck} hint={`${kg(sumBy(open, (j) => j.weightKg))} awaiting assignment`} featured />
        <DispatchMetric label="Confirmed, not ready" value={String(open.filter((j) => j.status === "Confirmed").length).padStart(2, "0")} icon={AlertTriangle} hint="Cargo or credit approval pending" />
        <DispatchMetric label="Available trucks" value={<>{freeTrucks.length}<span className="ml-1.5 text-base font-normal text-muted-foreground">/ {TRUCKS.length}</span></>} icon={Truck} hint={freeTrucks.map((t) => `${t.code}: ${truckStatus(t, trips, maintenance, date)}`).join(" · ") || "All trucks have scheduled trips"} />
        <DispatchMetric label="Active trips now" value={String(activeTrips.length).padStart(2, "0")} icon={Route} hint={activeTrips.map((t) => `${truckById(t.truckId).code}: ${t.status}`).join(" · ") || "No truck on the road"} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <CalendarDays className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          <Tabs value={date} onValueChange={setDate} className="min-w-0">
            <TabsList aria-label="Dispatch date" className="dispatch-dates h-auto max-w-full flex-wrap gap-1 border bg-card p-1">
              {dates.map((d) => (
                <TabsTrigger key={d} value={d} className="px-3 py-2 text-xs">
                  {d === TODAY ? "Today" : d === TOMORROW ? "Tomorrow" : fmtDay(d).split(",")[0]} · {fmtDay(d).split(", ")[1]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><GripVertical className="size-3.5" /> Drag a job to a truck, or use Assign</p>
      </div>

      <div className="dispatch-board grid items-start gap-6">
        <section aria-label="Unassigned jobs" className="dispatch-queue grid content-start gap-4">
          <div className="flex h-7 items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">Unassigned jobs <span className="dispatch-count">{open.length}</span></h2>
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">To assign</span>
          </div>
          {open.length === 0 && <EmptyState icon={PackageCheck} title="All confirmed jobs are assigned" description={`Nothing waiting for ${fmtDay(date)}.`} className="bg-card" />}
          {renderGroup("Outbound from Lucena", outbound, (j) => j.dropoff.areaId, "outbound")}
          {renderGroup("Return-leg cargo", inbound, (j) => j.pickup.areaId, "return")}
        </section>

        <section aria-label="Fleet schedule" className="dispatch-fleet min-w-0">
          <div className="mb-4 flex h-7 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">Fleet schedule <span className="dispatch-count">{dayTrips.length} trips</span></h2>
            <span className="text-[11px] text-muted-foreground">{fmtDay(date)}</span>
          </div>
          <div className="dispatch-trucks grid items-start gap-4">
          {dayTrips.map((t) => (
            <TruckColumn key={t.id} trip={t} dragging={dragging} draggingKg={draggingKg} onDropIds={(ids) => doAssign(ids, t)} />
          ))}
          {freeTrucks.map((truck) => {
            const status = truckStatus(truck, trips, maintenance, date);
            const shop = maintenance.find((m) => m.truckId === truck.id && m.status !== "Completed" && m.status !== "Cancelled" && m.date === date);
            return (
              <Card key={truck.id} className="dispatch-empty-truck gap-4 border-dashed p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-base font-semibold tracking-wide uppercase">
                      <span className="size-2.5 rounded-full" style={{ background: truck.color }} />
                      {truck.code}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {truck.make} {truck.model.split(" ")[0]} · {truck.plateNo} · {kg(truck.capacityKg)} payload
                    </div>
                  </div>
                  <StatusBadge status={date === TODAY ? status : shop ? "Maintenance" : "Available"} />
                </div>
                <p className="text-sm text-muted-foreground">No trip planned for {fmtDay(date)}.</p>
                {shop && (
                  <div className="flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-[oklch(0.45_0.11_65)]">
                    <AlertTriangle className="size-3.5" /> In the shop: {shop.type} at {shop.vendor}
                  </div>
                )}
                <Button variant="outline" onClick={() => setPlanning(truck.id)}>
                  <CalendarPlus /> Plan trip for {truck.code}
                </Button>
              </Card>
            );
          })}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><PackageCheck className="mt-0.5 size-3.5 shrink-0" /> All weights are gross cargo against each truck’s configured payload.</p>
        </section>
      </div>
      {planning && <PlanTripDialog truckId={planning} date={date} open onOpenChange={(v) => !v && setPlanning(null)} />}
    </div>
  );
}

function DispatchMetric({ label, value, hint, icon: Icon, featured }: { label: string; value: React.ReactNode; hint: string; icon: LucideIcon; featured?: boolean }) {
  return (
    <div className={cn("dispatch-metric min-w-0 p-4 sm:p-5", featured && "dispatch-metric-featured")}>
      <div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div>
      <div className="my-3 text-[30px] leading-none font-semibold tracking-[-0.04em] tabular">{value}</div>
      <p className="text-[11px] leading-relaxed opacity-75">{hint}</p>
    </div>
  );
}

function AssignMenu({ trips, leg, onPick, label, compact }: { trips: Trip[]; leg: "outbound" | "return"; onPick: (t: Trip) => void; label: string; compact?: boolean }) {
  const ok = (t: Trip) => (leg === "outbound" ? isTripEditable(t) : canAddReturnCargo(t));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 px-2 text-xs text-primary" : "h-7 px-2 text-[11px]"}>
          {label} <ArrowRight className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        {trips.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No trips planned — plan one first.</div>}
        {trips.map((t) => (
          <DropdownMenuItem key={t.id} disabled={!ok(t)} onSelect={() => onPick(t)}>
            <Truck /> {truckById(t.truckId).code} · {t.id} {!ok(t) && <Lock className="ml-auto size-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TruckColumn({ trip, dragging, draggingKg, onDropIds }: { trip: Trip; dragging: { ids: string[]; leg: "outbound" | "return" } | null; draggingKg: number; onDropIds: (ids: string[]) => void }) {
  const m = useTripMetrics().get(trip.id)!;
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const assign = useAppStore((s) => s.assignJobToTrip);
  const customers = useCustomerMap();
  const [over, setOver] = React.useState(false);
  const truck = truckById(trip.truckId);
  const accepts = (leg: "outbound" | "return") => (leg === "outbound" ? isTripEditable(trip) : canAddReturnCargo(trip));
  const canDrop = !!dragging && accepts(dragging.leg);
  const previewOut = over && dragging?.leg === "outbound" ? m.outboundKg + draggingKg : m.outboundKg;
  const previewRet = over && dragging?.leg === "return" ? m.returnKg + draggingKg : m.returnKg;
  const warnings = tripWarnings({ ...trip }, { ...m, outboundKg: previewOut, returnKg: previewRet }, trips, maintenance, documents);
  const route = routeById(trip.routeId);
  const locked = !isTripEditable(trip);
  const jobRows = (leg: "outbound" | "return") =>
    m.jobs
      .filter((j) => j.leg === leg)
      .sort((a, b) => (m.deliveries.find((d) => d.jobId === a.id)?.eta ?? a.pickupAt).localeCompare(m.deliveries.find((d) => d.jobId === b.id)?.eta ?? b.pickupAt));
  const companyReturn = m.returnLoads.filter((l) => l.type === "Company-Owned");
  return (
    <Card
      onDragOver={(e) => {
        if (!canDrop || !e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!canDrop) return;
        const ids = e.dataTransfer.getData(DND_TYPE).split(",").filter(Boolean);
        if (ids.length) onDropIds(ids);
      }}
      className={cn("dispatch-truck gap-0 overflow-hidden transition-shadow", over && "ring-2 ring-primary", dragging && canDrop && !over && "ring-1 ring-primary/40", dragging && !canDrop && "opacity-60")}
      aria-label={`${truck.code} drop zone`}
    >
      <div className="grid gap-3 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40"><Truck className="size-5 text-primary" strokeWidth={1.6} /></span>
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold">
                {truck.code}<span className="size-1.5 rounded-full" style={{ background: truck.color }} />
              </div>
              <div className="mt-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">{truck.plateNo}</div>
            </div>
          </div>
          <StatusBadge status={trip.status} className="mt-1 rounded-full text-[10px]" />
        </div>
        <div className="-mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          <span>{truck.make} {truck.model.split(" ")[0]} · {truck.vehicleType}</span>
          <span className="flex items-center gap-1.5"><UserRound className="size-3" />{driverById(trip.driverId).name}</span>
        </div>
        <div className="dispatch-route rounded-lg border p-3">
          <Link href={`/trips/${trip.id}`} className="flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground hover:text-primary">
            {trip.id}<ArrowUpRight className="size-3.5" />
          </Link>
          <div className="mt-2 text-[14px] font-semibold tracking-tight">{route.name.split(" → ").slice(1).join(" → ") || route.name}</div>
          <div className="dispatch-itinerary my-2 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>{tripRouteLine(trip)}</span></div>
          <div className="grid grid-cols-2 gap-3 border-t border-primary/10 pt-2">
            <div><span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" /> {trip.actualDeparture ? "Departed" : "Departure"}</span><span className="mt-1 block text-xs font-semibold tabular">{fmtTime(trip.actualDeparture ?? trip.departure)}</span></div>
            <div className="text-right"><span className="block text-[10px] text-muted-foreground">Expected return</span><span className="mt-1 block text-xs font-semibold tabular">{fmtTime(trip.expectedReturn)}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x rounded-lg border bg-muted/20 py-3 text-center">
          <Metric label="Payload" value={kg(m.capacityKg)} />
          <Metric label="Outbound" value={kg(previewOut)} />
          <Metric label="Free outbound" value={kg(m.capacityKg - previewOut)} tone={previewOut > m.capacityKg ? "danger" : m.capacityKg - previewOut < 500 ? "warning" : undefined} />
        </div>
        <div className="grid gap-3">
          <CapacityBar used={previewOut} capacity={m.capacityKg} label="Outbound" size="sm" />
          <CapacityBar used={previewRet} capacity={m.capacityKg} label="Return leg" size="sm" />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ArrowDownLeft className="size-3.5 text-primary" /><span><b className="font-medium text-primary">{kg(Math.max(0, m.capacityKg - previewRet))}</b> available on return</span></div>
        </div>
        {warnings.map((w) => (
          <div key={w.message} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", w.kind === "capacity" || w.kind === "document" ? "bg-danger-soft text-danger" : "bg-warning-soft text-[oklch(0.45_0.11_65)]")} role="alert">
            <AlertTriangle className="size-3.5 shrink-0" /> {w.message}
          </div>
        ))}
        {locked ? (
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" /> Outbound locked. {canAddReturnCargo(trip) ? "Return-leg cargo can still be assigned." : "This trip is no longer accepting cargo."}
          </div>
        ) : (
          <div className={cn("flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/25 bg-accent/30 px-3 py-2.5 text-[11px] text-primary", over && "bg-accent")}><Plus className="size-3.5" /> Drop outbound or return-leg jobs here</div>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto scrollbar-thin" tabIndex={0} role="region" aria-label={`${truck.code} cargo manifest`}>
        {(["outbound", "return"] as const).map((leg) => {
          const rows = jobRows(leg);
          return (
            <div key={leg}>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-[#f6f8f9] px-4 py-2.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span>{leg === "outbound" ? "Outbound jobs" : "Return leg"} · {rows.length + (leg === "return" ? companyReturn.length : 0)}</span>
                <span className="tabular">{kg(leg === "outbound" ? m.outboundKg : m.returnKg)}</span>
              </div>
              <ul className="divide-y">
                {rows.map((j) => {
                  const d = m.deliveries.find((x) => x.jobId === j.id);
                  const removable = accepts(leg) && j.status === "Assigned";
                  return (
                    <li key={j.id} className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <Link href={`/jobs/${j.id}`} className="block truncate text-[13px] font-medium hover:underline">
                          {customers.get(j.customerId)?.name}
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">
                          {areaName(leg === "outbound" ? j.dropoff.areaId : j.pickup.areaId)} · {j.cargoDescription}
                        </div>
                      </div>
                      <div className="text-right text-xs tabular">
                        <div className="font-medium">{kg(j.weightKg)}</div>
                        <div className={cn("mt-1 whitespace-nowrap text-[10px]", d?.status === "Delivered" ? "text-success" : "text-muted-foreground")}>{d ? (d.status === "Delivered" ? "Delivered" : `ETA ${fmtTime(d.eta)}`) : j.status}</div>
                      </div>
                      {removable && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${j.id} from ${truck.code}`}
                          onClick={() => void act(() => assign(j.id, null), () => toast(`${j.id} moved back to unassigned`))}
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  );
                })}
                {leg === "return" &&
                  companyReturn.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 px-4 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">Company cargo — {l.cargoDescription}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {l.id} · from {l.pickup.name}
                        </div>
                      </div>
                      <div className="text-xs font-medium tabular">{kg(l.weightKg)}</div>
                    </li>
                  ))}
                {rows.length === 0 && !(leg === "return" && companyReturn.length) && <li className="px-4 py-4 text-center text-xs text-muted-foreground">{leg === "outbound" ? "No outbound jobs yet — drag jobs here." : "No return cargo yet — see Backhaul."}</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <Link href={`/trips/${trip.id}`} className="flex items-center justify-between border-t bg-muted/20 px-4 py-3 text-xs font-medium text-primary transition-colors hover:bg-accent">View trip details<ArrowRight className="size-3.5" /></Link>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" }) {
  return (
    <div className="min-w-0 px-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xs font-semibold tabular", tone === "danger" && "text-danger", tone === "warning" && "text-[oklch(0.55_0.13_65)]")}>{value}</div>
    </div>
  );
}

function PlanTripDialog({ truckId, date, open, onOpenChange }: { truckId: string; date: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useAppStore((s) => s.createTrip);
  const [saving, setSaving] = React.useState(false);
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const truck = truckById(truckId);
  const [driverId, setDriverId] = React.useState(truck.primaryDriverId);
  const [routeId, setRouteId] = React.useState(truckId === "TRK-01" ? "RT-NV" : "RT-CAV");
  const [time, setTime] = React.useState(routeById(truckId === "TRK-01" ? "RT-NV" : "RT-CAV").departure);
  const [helpers, setHelpers] = React.useState<string[]>(truckId === "TRK-01" ? ["HL-01", "HL-02"] : ["HL-03", "HL-04"]);
  const draft: Trip = { id: "NEW", date, truckId, driverId, helperIds: helpers, routeId, status: "Planned", departure: `${date}T${time}`, expectedReturn: `${date}T${routeById(routeId).expectedReturn}`, stops: [], history: [] };
  const warnings = tripWarnings(draft, undefined, trips, maintenance, documents);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Plan trip — {truck.code}, {fmtDay(date)}
          </DialogTitle>
          <DialogDescription>
            {truck.name} · {truck.plateNo} · configured payload {kg(CAP)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Driver" htmlFor="pt-driver" required>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger id="pt-driver">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVERS.map((d) => {
                  const off = driverUnavailability(d.id, date);
                  return (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {off ? ` — ${off.reason.split(" — ")[0]}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Departure time" htmlFor="pt-time" required>
            <Input id="pt-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Route" htmlFor="pt-route" required className="sm:col-span-2">
            <Select
              value={routeId}
              onValueChange={(r) => {
                setRouteId(r);
                setTime(routeById(r).departure);
              }}
            >
              <SelectTrigger id="pt-route">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUTES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · {r.roundTripKm} km
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1 text-[13px] font-medium">Helpers</legend>
            <div className="flex flex-wrap gap-4">
              {HELPERS.map((h) => (
                <label key={h.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={helpers.includes(h.id)} onCheckedChange={(v) => setHelpers((cur) => (v ? [...cur, h.id] : cur.filter((x) => x !== h.id)))} />
                  {h.name}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {warnings.length > 0 && (
          <ul className="grid gap-1.5">
            {warnings.map((w) => (
              <li key={w.message} className="flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs font-medium text-[oklch(0.45_0.11_65)]">
                <AlertTriangle className="size-3.5 shrink-0" /> {w.message}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await act(
                () => create({ date, truckId, driverId, helperIds: helpers, routeId, departure: `${date}T${time}` }),
                (id) => {
                  toast.success(`${id} planned`, { description: warnings.length ? `Planned with ${warnings.length} warning(s) — review before dispatch.` : "Drag jobs onto the truck to build the load." });
                  onOpenChange(false);
                },
              );
              setSaving(false);
            }}
          >
            <CalendarPlus /> Plan trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
