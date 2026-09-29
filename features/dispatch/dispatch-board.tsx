"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarPlus, GripVertical, Lock, MapPin, PackageCheck, Truck, X } from "lucide-react";
import type { AreaId, LogisticsJob, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, ROUTES, routeById } from "@/data/areas";
import { TRUCKS, DRIVERS, driverById, driverUnavailability, truckById } from "@/data/fleet";
import { HELPERS } from "@/data/company";
import { canAddReturnCargo, isTripEditable, jobTotal, tripWarnings, truckStatus, unassignedJobs } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, kg, peso, pct } from "@/lib/format";
import { cn, groupBy, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Checkbox, Input } from "@/components/ui/primitives";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CapacityBar, EmptyState, KPICard, PageHeader } from "@/components/shared/common";
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

  const doAssign = (ids: string[], trip: Trip) => {
    const list = ids.map((id) => jobs.find((j) => j.id === id)!).filter(Boolean);
    const leg = list[0]?.leg ?? "outbound";
    if (leg === "outbound" ? !isTripEditable(trip) : !canAddReturnCargo(trip)) {
      toast.error(`${trip.id} has departed — outbound cargo is locked`, { description: "Only return-leg cargo can still be added." });
      return;
    }
    const m = metrics.get(trip.id)!;
    const add = sumBy(list, (j) => j.weightKg);
    list.forEach((j) => assign(j.id, trip.id));
    const after = (leg === "outbound" ? m.outboundKg : m.returnKg) + add;
    const truck = truckById(trip.truckId);
    if (after > m.capacityKg) toast.warning(`${truck.code} ${leg === "outbound" ? "outbound" : "return"} capacity exceeded by ${kg(after - m.capacityKg)}`, { description: "Move a job to the other truck or split the cargo." });
    else toast.success(`${list.length} job${list.length > 1 ? "s" : ""} assigned to ${truck.code}`, { description: `${kg(m.capacityKg - after)} remaining on the ${leg === "outbound" ? "outbound" : "return"} leg of ${trip.id}` });
  };

  const renderGroup = (title: string, list: LogisticsJob[], key: (j: LogisticsJob) => AreaId, leg: "outbound" | "return") => {
    if (!list.length) return null;
    const groups = Object.entries(groupBy(list, key)).sort((a, b) => b[1].length - a[1].length);
    return (
      <div className="grid gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {leg === "outbound" ? <ArrowUpRight className="size-3.5 text-primary" /> : <ArrowDownLeft className="size-3.5 text-[oklch(0.45_0.14_300)]" />}
          {title} · {kg(sumBy(list, (j) => j.weightKg))}
        </div>
        {groups.map(([areaId, items]) => {
          const ids = items.map((j) => j.id);
          return (
            <Card key={areaId} className="gap-0 overflow-hidden">
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DND_TYPE, ids.join(","));
                  e.dataTransfer.effectAllowed = "move";
                  setDragging({ ids, leg });
                }}
                onDragEnd={() => setDragging(null)}
                className="flex cursor-grab items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5 active:cursor-grabbing"
                title="Drag the whole group onto a truck"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <MapPin className="size-4 text-primary" />
                  <div>
                    <div className="font-semibold">{areaName(areaId as AreaId)}</div>
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
                      className="flex cursor-grab items-center gap-2 px-3 py-2 hover:bg-muted/40 active:cursor-grabbing"
                    >
                      <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <Link href={`/jobs/${j.id}`} className="text-[13px] font-medium hover:underline">
                            {c?.name}
                          </Link>
                          <StatusBadge status={j.status} icon={false} className="text-[10px]" />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {j.id} · {j.cargoDescription} · {leg === "outbound" ? `due ${fmtTime(j.requiredBy)}` : `from ${j.pickup.name}`}
                        </div>
                        {hold && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-danger">
                            <AlertTriangle className="size-3" /> Credit hold — confirm with accounting
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs tabular">
                        <div className="font-medium">{kg(j.weightKg)}</div>
                        <div className="text-muted-foreground">{peso(jobTotal(j))}</div>
                      </div>
                      <AssignMenu trips={dayTrips} leg={leg} onPick={(t) => doAssign([j.id], t)} label="Assign" compact />
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
    <>
      <PageHeader
        title="Dispatch"
        description="Match confirmed jobs to trucks. Drag jobs onto a truck or use Assign. Weights are gross against each van's configured payload; departed trips accept return-leg cargo only."
        actions={
          <Tabs value={date} onValueChange={setDate}>
            <TabsList className="h-auto flex-wrap">
              {dates.map((d) => (
                <TabsTrigger key={d} value={d}>
                  {d === TODAY ? "Today" : d === TOMORROW ? "Tomorrow" : fmtDay(d).split(",")[0]} · {fmtDay(d).split(", ")[1]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Unassigned jobs" value={open.length} icon={PackageCheck} hint={`${kg(sumBy(open, (j) => j.weightKg))} for ${fmtDay(date)}`} tone={open.length ? "warning" : "success"} />
        <KPICard label="Confirmed, not ready" value={open.filter((j) => j.status === "Confirmed").length} icon={AlertTriangle} hint="Booking confirmed — cargo or credit still pending" />
        <KPICard label="Available trucks" value={`${freeTrucks.length} of ${TRUCKS.length}`} icon={Truck} hint={freeTrucks.map((t) => `${t.code}: ${truckStatus(t, trips, maintenance, date)}`).join(" · ") || "Both trucks have trips"} />
        <KPICard label="Active trips now" value={activeTrips.length} icon={Truck} hint={activeTrips.map((t) => `${truckById(t.truckId).code}: ${t.status}`).join(" · ") || "No truck on the road"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Unassigned jobs</h2>
            <span className="text-xs text-muted-foreground tabular">{open.length} jobs</span>
          </div>
          {open.length === 0 && <EmptyState icon={PackageCheck} title="All confirmed jobs are assigned" description={`Nothing waiting for ${fmtDay(date)}.`} className="bg-card" />}
          {renderGroup("Outbound from Lucena", outbound, (j) => j.dropoff.areaId, "outbound")}
          {renderGroup("Return-leg cargo", inbound, (j) => j.pickup.areaId, "return")}
        </div>

        <div className="grid content-start gap-4 lg:grid-cols-2">
          {dayTrips.map((t) => (
            <TruckColumn key={t.id} trip={t} dragging={dragging} draggingKg={draggingKg} onDropIds={(ids) => doAssign(ids, t)} />
          ))}
          {freeTrucks.map((truck) => {
            const status = truckStatus(truck, trips, maintenance, date);
            const shop = maintenance.find((m) => m.truckId === truck.id && m.status !== "Completed" && m.status !== "Cancelled" && m.date === date);
            return (
              <Card key={truck.id} className="gap-3 border-dashed p-4">
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
      </div>
      {planning && <PlanTripDialog truckId={planning} date={date} open onOpenChange={(v) => !v && setPlanning(null)} />}
    </>
  );
}

function AssignMenu({ trips, leg, onPick, label, compact }: { trips: Trip[]; leg: "outbound" | "return"; onPick: (t: Trip) => void; label: string; compact?: boolean }) {
  const ok = (t: Trip) => (leg === "outbound" ? isTripEditable(t) : canAddReturnCargo(t));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 px-2 text-xs" : ""}>
          <Truck /> {label}
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
        setOver(false);
        if (!canDrop) return;
        const ids = e.dataTransfer.getData(DND_TYPE).split(",").filter(Boolean);
        if (ids.length) onDropIds(ids);
      }}
      className={cn("gap-0 overflow-hidden transition-shadow", over && "ring-2 ring-primary", dragging && canDrop && !over && "ring-1 ring-primary/40", dragging && !canDrop && "opacity-60")}
      aria-label={`${truck.code} drop zone`}
    >
      <div className="grid gap-3 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold tracking-wide uppercase">
              <span className="size-2.5 rounded-full" style={{ background: truck.color }} />
              {truck.code}
            </div>
            <div className="text-xs text-muted-foreground">
              {truck.make} {truck.model.split(" ")[0]} {truck.vehicleType} · {truck.plateNo}
            </div>
            <div className="text-xs text-muted-foreground">Driver: {driverById(trip.driverId).name}</div>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        <div className="grid gap-0.5">
          <Link href={`/trips/${trip.id}`} className="text-sm font-medium hover:underline">
            {trip.id} · {route.name.split(" → ").slice(1).join(" → ") || route.name}
          </Link>
          <div className="text-xs text-muted-foreground">{tripRouteLine(trip)}</div>
          <div className="text-xs text-muted-foreground">
            Departure {fmtTime(trip.actualDeparture ?? trip.departure)} · expected return {fmtTime(trip.expectedReturn)}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Metric label="Capacity" value={kg(m.capacityKg)} />
          <Metric label="Assigned" value={kg(previewOut)} />
          <Metric label="Remaining" value={kg(m.capacityKg - previewOut)} tone={previewOut > m.capacityKg ? "danger" : m.capacityKg - previewOut < 500 ? "warning" : undefined} />
          <Metric label="Utilization" value={pct(previewOut / m.capacityKg)} />
        </div>
        <CapacityBar used={previewOut} capacity={m.capacityKg} label="Outbound" size="sm" />
        <CapacityBar used={previewRet} capacity={m.capacityKg} label={`Return · ${kg(Math.max(0, m.capacityKg - previewRet))} free`} size="sm" />
        {warnings.map((w) => (
          <div key={w.message} className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium", w.kind === "capacity" || w.kind === "document" ? "bg-danger-soft text-danger" : "bg-warning-soft text-[oklch(0.45_0.11_65)]")} role="alert">
            <AlertTriangle className="size-3.5 shrink-0" /> {w.message}
          </div>
        ))}
        {locked ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> {trip.actualDeparture ? `Departed ${fmtTime(trip.actualDeparture)}` : "Departed"} — outbound locked; return-leg cargo can still be added.
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Drop outbound or return-leg jobs here</div>
        )}
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {(["outbound", "return"] as const).map((leg) => {
          const rows = jobRows(leg);
          return (
            <div key={leg}>
              <div className="flex items-center justify-between bg-muted/40 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <span>{leg === "outbound" ? "Outbound jobs" : "Return leg"}</span>
                <span className="tabular">{kg(leg === "outbound" ? m.outboundKg : m.returnKg)}</span>
              </div>
              <ul className="divide-y">
                {rows.map((j) => {
                  const d = m.deliveries.find((x) => x.jobId === j.id);
                  const removable = accepts(leg) && j.status === "Assigned";
                  return (
                    <li key={j.id} className="flex items-center gap-2 px-4 py-2">
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
                        <div className="text-muted-foreground">{d ? (d.status === "Delivered" ? "Delivered" : `ETA ${fmtTime(d.eta)}`) : j.status}</div>
                      </div>
                      {removable && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${j.id} from ${truck.code}`}
                          onClick={() => {
                            assign(j.id, null);
                            toast(`${j.id} moved back to unassigned`);
                          }}
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
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-md bg-muted/50 px-1.5 py-1.5">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={cn("text-[13px] font-semibold tabular", tone === "danger" && "text-danger", tone === "warning" && "text-[oklch(0.55_0.13_65)]")}>{value}</div>
    </div>
  );
}

function PlanTripDialog({ truckId, date, open, onOpenChange }: { truckId: string; date: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useAppStore((s) => s.createTrip);
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
            onClick={() => {
              const id = create({ date, truckId, driverId, helperIds: helpers, routeId, departure: `${date}T${time}` });
              toast.success(`${id} planned`, { description: warnings.length ? `Planned with ${warnings.length} warning(s) — review before dispatch.` : "Drag jobs onto the truck to build the load." });
              onOpenChange(false);
            }}
          >
            <CalendarPlus /> Plan trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
