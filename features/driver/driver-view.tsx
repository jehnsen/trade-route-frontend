"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, CornerDownLeft, Flag, LogOut, MapPin, Navigation, Package, PackagePlus, Phone, Play, Truck, Warehouse } from "lucide-react";
import type { Delivery, Load, Trip, TripStop } from "@/types";
import { useAppStore, useHydrated } from "@/lib/store";
import { TODAY } from "@/data/company";
import { DRIVERS, driverById, truckById } from "@/data/fleet";
import { ACTIVE_TRIP_STATUSES, DELIVERY_DONE, tripProgress } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, kg, unitQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/common";
import { Logo } from "@/components/layout/brand";
import { PodDialog, ReportIssueDialog } from "@/features/deliveries/delivery-dialogs";

/** Mobile-first view for the driver: today's trip, stops, cargo and POD. No revenue or balances. */
export function DriverView() {
  const hydrated = useHydrated((s) => s.hydrated);
  const [driverId, setDriverId] = React.useState("DRV-01");
  const trips = useAppStore((s) => s.trips);
  const loads = useAppStore((s) => s.loads);
  const deliveries = useAppStore((s) => s.deliveries);
  const setTripStatus = useAppStore((s) => s.setTripStatus);
  const setRole = useAppStore((s) => s.setRole);
  const [dialog, setDialog] = React.useState<{ kind: "pod" | "upload" | "issue"; d: Delivery } | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const mine = trips.filter((t) => t.driverId === driverId && t.status !== "Cancelled");
  const trip = mine.find((t) => ACTIVE_TRIP_STATUSES.includes(t.status)) ?? mine.find((t) => t.date === TODAY && t.status !== "Completed") ?? mine.filter((t) => t.date > TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
  const driver = driverById(driverId);

  if (!hydrated)
    return (
      <div className="grid gap-3 p-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );

  const header = (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-[oklch(0.25_0.04_220)] px-4 py-3 text-white">
      <Logo />
      <div className="flex items-center gap-2">
        <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm" aria-label="Driver (demo)">
          {DRIVERS.map((d) => (
            <option key={d.id} value={d.id} className="text-foreground">
              {d.name}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" asChild aria-label="Back to office view" onClick={() => setRole("owner")}>
          <Link href="/command-center">
            <LogOut />
          </Link>
        </Button>
      </div>
    </header>
  );

  if (!trip)
    return (
      <>
        {header}
        <div className="p-4">
          <EmptyState icon={Truck} title={`No trips scheduled for ${driver.name}`} description={driver.unavailable.find((u) => u.from <= TODAY && u.to >= TODAY)?.reason ?? "Check with dispatcher Noel Pascual (0919 338 5402) for changes."} className="bg-card" />
        </div>
      </>
    );

  const truck = truckById(trip.truckId);
  const loadMap = new Map(loads.map((l) => [l.id, l]));
  const tripDeliveries = deliveries.filter((d) => d.tripId === trip.id);
  const progress = tripProgress(trip);
  const departed = !!trip.actualDeparture;
  const focus = progress.current ?? progress.next;

  return (
    <>
      {header}
      <div className="grid gap-3 p-3 pb-10 sm:p-4">
        <Card className="gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">{trip.date === TODAY ? "Today's trip" : `Next trip · ${fmtDay(trip.date)}`}</div>
              <div className="text-lg font-semibold">{trip.id}</div>
            </div>
            <StatusBadge status={trip.status} />
          </div>
          <div className="text-sm font-medium">{tripRouteLine(trip)}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" /> {truck.code} · {truck.plateNo}
            </span>
            <span>Depart {fmtTime(trip.actualDeparture ?? trip.departure)}</span>
            <span>Back ~{fmtTime(trip.expectedReturn)}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress.done} aria-valuemax={progress.total} aria-label="Stops completed">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {progress.done} of {progress.total} stops done · {tripDeliveries.filter((d) => d.status === "Delivered").length} of {tripDeliveries.length} deliveries
          </div>
          {trip.notes && <div className="rounded-md bg-warning-soft px-3 py-2 text-xs">{trip.notes}</div>}
          {!departed && trip.date === TODAY && (
            <Button
              size="xl"
              className="mt-1"
              onClick={() => {
                setTripStatus(trip.id, "Dispatched");
                toast.success("Trip started — ingat sa biyahe!", { description: `Dispatcher notified that ${truck.code} left Lucena.` });
              }}
            >
              <Play /> Start trip — departed Lucena
            </Button>
          )}
        </Card>

        {focus && departed && (
          <StopCard
            trip={trip}
            stop={focus}
            loadMap={loadMap}
            deliveries={tripDeliveries}
            highlight
            onDialog={(kind, d) => setDialog({ kind, d })}
          />
        )}

        <div className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">All stops</div>
        {trip.stops.map((s) => {
          const open = expanded === s.id;
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : s.id)}
                className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left", s.status === "Completed" && "opacity-70")}
                aria-expanded={open}
              >
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular", s.status === "Completed" ? "bg-primary text-white" : "bg-muted")}>{s.status === "Completed" ? <CheckCircle2 className="size-4" /> : s.seq}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.location.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.type} · {s.actualArrival ? `arrived ${fmtTime(s.actualArrival)}` : `ETA ${fmtTime(s.plannedArrival)}`}
                  </div>
                </div>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-1.5">
                  <StopCard trip={trip} stop={s} loadMap={loadMap} deliveries={tripDeliveries} onDialog={(kind, d) => setDialog({ kind, d })} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {dialog?.kind === "pod" && <PodDialog delivery={dialog.d} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "upload" && <PodDialog delivery={dialog.d} mode="upload" open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "issue" && <ReportIssueDialog delivery={dialog.d} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}

function StopCard({ trip, stop, loadMap, deliveries, highlight, onDialog }: { trip: Trip; stop: TripStop; loadMap: Map<string, Load>; deliveries: Delivery[]; highlight?: boolean; onDialog: (kind: "pod" | "upload" | "issue", d: Delivery) => void }) {
  const markArrived = useAppStore((s) => s.markArrived);
  const markStopArrived = useAppStore((s) => s.markStopArrived);
  const completeStop = useAppStore((s) => s.completeStop);
  const jobs = useAppStore((s) => s.jobs);
  const departed = !!trip.actualDeparture && trip.status !== "Completed";
  const toLoad = stop.loaded.map((id) => loadMap.get(id)).filter((l): l is Load => !!l);
  const toUnload = stop.unloaded.map((id) => loadMap.get(id)).filter((l): l is Load => !!l);
  const stopDeliveries = deliveries.filter((d) => d.loadIds.some((id) => stop.unloaded.includes(id)));
  const isDrop = stopDeliveries.length > 0;
  const Icon = stop.type === "Delivery" ? MapPin : stop.type === "Backhaul Pickup" ? CornerDownLeft : stop.type === "Pickup" ? PackagePlus : stop.type === "Warehouse" ? Warehouse : Flag;
  const instructions = [...new Set(stopDeliveries.map((d) => jobs.find((j) => j.id === d.jobId)?.instructions).filter(Boolean))];
  return (
    <Card className={cn("gap-3 p-4", highlight && "border-primary ring-2 ring-primary/15")}>
      {highlight && <div className="text-xs font-semibold tracking-wide text-primary uppercase">{stop.status === "Arrived" ? "You are here" : "Next stop"}</div>}
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            Stop {stop.seq} · {stop.type}
          </div>
          <div className="font-semibold">{stop.location.name}</div>
          {stop.location.address && <div className="text-xs text-muted-foreground">{stop.location.address}</div>}
          <div className="mt-0.5 text-xs text-muted-foreground">
            ETA {fmtTime(stop.plannedArrival)}
            {stop.actualArrival ? ` · arrived ${fmtTime(stop.actualArrival)}` : ""}
          </div>
        </div>
        <StatusBadge status={stop.status} icon={false} />
      </div>
      {stop.contactName && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <div>
            <div className="font-medium">{stop.contactName}</div>
            <div className="text-xs text-muted-foreground">{stop.contactPhone}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${(stop.contactPhone ?? "").replace(/\s/g, "")}`}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" size="icon-sm" asChild aria-label="Open in maps">
              <a href={`https://maps.google.com/?q=${encodeURIComponent(`${stop.location.name} ${stop.location.address ?? ""}`)}`} target="_blank" rel="noreferrer">
                <Navigation />
              </a>
            </Button>
          </div>
        </div>
      )}
      {(toLoad.length > 0 || toUnload.length > 0) && (
        <ul className="grid gap-1.5 text-sm">
          {toUnload.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Package className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">Unload: {l.cargoDescription}</span>
              </span>
              <span className="shrink-0 text-xs tabular">
                {unitQty(l.quantity, l.unit)} · {kg(l.weightKg)}
              </span>
            </li>
          ))}
          {toLoad.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <PackagePlus className="size-3.5 shrink-0 text-[oklch(0.45_0.13_150)]" />
                <span className="truncate">Load: {l.cargoDescription}</span>
              </span>
              <span className="shrink-0 text-xs tabular">
                {unitQty(l.quantity, l.unit)} · {kg(l.weightKg)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {toLoad.concat(toUnload).some((l) => l.handlingNotes) && <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">{[...new Set(toLoad.concat(toUnload).map((l) => l.handlingNotes).filter(Boolean))].join(" ")}</div>}
      {instructions.length > 0 && <div className="rounded-md border border-[oklch(0.85_0.08_85)] bg-warning-soft px-3 py-2 text-xs">{instructions.join(" ")}</div>}

      {departed && isDrop &&
        stopDeliveries.map((d) => {
          const job = jobs.find((j) => j.id === d.jobId);
          const open = !DELIVERY_DONE.includes(d.status);
          return (
            <div key={d.id} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{job?.consignee.name}</span>
                <StatusBadge status={d.status} />
              </div>
              {open ? (
                <div className="grid grid-cols-2 gap-2">
                  {d.status !== "Arrived" ? (
                    <Button size="lg" variant="outline" onClick={() => { markArrived(d.id); toast.success("Marked arrived", { description: "Dispatcher and consignee notified (demo)." }); }}>
                      <MapPin /> Mark arrived
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" onClick={() => onDialog("issue", d)}>
                      <AlertTriangle /> Report issue
                    </Button>
                  )}
                  <Button size="lg" variant="success" onClick={() => onDialog("pod", d)}>
                    <CheckCircle2 /> Mark delivered
                  </Button>
                  {d.status !== "Arrived" && (
                    <Button variant="ghost" className="col-span-2" onClick={() => onDialog("issue", d)}>
                      <AlertTriangle /> Report issue
                    </Button>
                  )}
                </div>
              ) : d.status === "Delivered" ? (
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    POD {d.pod?.receiptNo} · {d.pod?.photoCount ?? 0} photo(s)
                  </span>
                  <Button size="sm" variant="outline" onClick={() => onDialog("upload", d)}>
                    <Camera /> Upload POD
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-danger">{d.failureReason}</div>
              )}
            </div>
          );
        })}
      {departed && !isDrop && stop.status !== "Completed" && stop.seq > 1 && (
        <div className="grid grid-cols-2 gap-2">
          {stop.status === "Pending" ? (
            <Button size="lg" variant="outline" onClick={() => { markStopArrived(trip.id, stop.id); toast.success(`Arrived at ${stop.location.name}`); }}>
              <MapPin /> Mark arrived
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" onClick={() => { completeStop(trip.id, stop.id); toast.success(stop.type === "Backhaul Pickup" ? "Backhaul loaded" : stop.type === "Warehouse" ? "Unloaded at the bodega" : "Stop done"); }}>
            <CheckCircle2 /> {stop.type === "Backhaul Pickup" ? "Cargo loaded" : stop.type === "Warehouse" ? "Unloaded at bodega" : "Done"}
          </Button>
        </div>
      )}
    </Card>
  );
}
