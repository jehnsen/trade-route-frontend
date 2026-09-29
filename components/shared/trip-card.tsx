"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, MapPin, UserRound, Wrench } from "lucide-react";
import type { Trip, Truck } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { truckById, driverById } from "@/data/fleet";
import { currentOdometer, maintenanceOutlook, tripProgress, tripWarnings, truckLocation, truckStatus, truckTripToday } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtTime, fmtDay, kg, num, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { StatusBadge } from "./status-badge";
import { CapacityBar, MoneyDisplay } from "./common";

/** Trip summary: route, crew, outbound/return utilization and trip financials. */
export function TripCard({ trip, compact, className, showFinancials = true }: { trip: Trip; compact?: boolean; className?: string; showFinancials?: boolean }) {
  const m = useTripMetrics().get(trip.id);
  const allTrips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  if (!m) return null;
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const progress = tripProgress(trip);
  const warnings = tripWarnings(trip, m, allTrips, maintenance, documents);
  return (
    <Card className={cn("gap-3 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/trips/${trip.id}`} className="font-semibold hover:underline">
            {trip.id}
          </Link>
          <div className="text-xs text-muted-foreground">
            {relativeDay(trip.date)} · {fmtDay(trip.date)}
          </div>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      <div className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="font-medium">{tripRouteLine(trip)}</div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ background: truck.color }} /> {truck.code} · {truck.plateNo}
        </span>
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" /> {driver.name}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {fmtTime(trip.actualDeparture ?? trip.departure)} → {fmtTime(trip.actualReturn ?? trip.expectedReturn)}
        </span>
      </div>
      <div className="grid gap-2">
        <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label="Outbound" size="sm" />
        <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return" size="sm" />
      </div>
      {!compact && (
        <div className="text-xs text-muted-foreground">
          {m.jobs.length} jobs · {m.delivered}/{m.deliveryCount} delivered · stops {progress.done}/{progress.total}
        </div>
      )}
      {warnings.length > 0 && (
        <ul className="grid gap-1">
          {warnings.slice(0, 2).map((w) => (
            <li key={w.message} className="flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-xs font-medium text-danger">
              <AlertTriangle className="size-3.5 shrink-0" /> {w.message}
            </li>
          ))}
        </ul>
      )}
      {!compact && showFinancials && (
        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
          <div>
            <div className="text-muted-foreground">Freight revenue</div>
            <MoneyDisplay amount={m.revenue} className="font-semibold" compact />
          </div>
          <div>
            <div className="text-muted-foreground">Trip cost{m.dieselLogged ? "" : "*"}</div>
            <MoneyDisplay amount={m.expenseTotal + m.estimatedDiesel} className="font-semibold" compact />
          </div>
          <div>
            <div className="text-muted-foreground">Contribution</div>
            <MoneyDisplay amount={m.contribution} className="font-semibold text-[oklch(0.45_0.13_150)]" compact />
          </div>
          {!m.dieselLogged && <div className="col-span-3 text-[11px] text-muted-foreground">* includes estimated diesel until the fill-up is logged</div>}
        </div>
      )}
      <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        View trip <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

/** Where a truck is, what it carries and how much room is left — for the owner and dispatcher. */
export function TruckStatusCard({ truck }: { truck: Truck }) {
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const metrics = useTripMetrics();
  const trip = truckTripToday(truck.id, trips);
  const status = truckStatus(truck, trips, maintenance);
  const m = trip ? metrics.get(trip.id) : undefined;
  const loc = truckLocation(trip);
  const next = trip ? tripProgress(trip).next : undefined;
  const odo = currentOdometer(truck, trips, fuelLogs);
  const outlook = maintenanceOutlook(truck.id, maintenance, odo);
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: truck.color }} />
            <Link href={`/trucks/${truck.id}`} className="font-semibold hover:underline">
              {truck.code}
            </Link>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{truck.plateNo}</span>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {truck.make} {truck.model.split(" ")[0]} · {truck.vehicleType}
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="font-medium">{loc.label}</div>
          {loc.detail && <div className="text-xs text-muted-foreground">{loc.detail}</div>}
        </div>
      </div>
      {trip && m ? (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="min-w-0">
              <div className="text-muted-foreground">Trip</div>
              <Link href={`/trips/${trip.id}`} className="font-medium text-primary hover:underline">
                {trip.id}
              </Link>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">Driver</div>
              <div className="truncate font-medium">{driverById(trip.driverId).name}</div>
            </div>
            <div className="col-span-2 min-w-0">
              <div className="text-muted-foreground">Route</div>
              <div className="truncate font-medium">{tripRouteLine(trip)}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">{next ? "Next stop" : "Departure"}</div>
              <div className="truncate font-medium">{next ? `${next.location.name} · ${fmtTime(next.plannedArrival)}` : fmtTime(trip.actualDeparture ?? trip.departure)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Expected return</div>
              <div className="font-medium">{fmtTime(trip.actualReturn ?? trip.expectedReturn)}</div>
            </div>
          </div>
          <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label={`Outbound · ${m.delivered}/${m.deliveryCount} drops`} size="sm" />
          <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return (backhaul)" size="sm" />
          <div className="text-xs text-muted-foreground">
            Remaining: <span className="font-medium text-foreground">{kg(Math.max(0, m.capacityKg - m.outboundKg))}</span> outbound · <span className="font-medium text-foreground">{kg(Math.max(0, m.capacityKg - m.returnKg))}</span> return
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No trip scheduled today — available for dispatch.</div>
      )}
      {outlook.nextPms && (
        <div className={cn("flex items-center gap-1.5 text-xs", outlook.nextPms.kmLeft < 1000 ? "font-medium text-[oklch(0.5_0.13_65)]" : "text-muted-foreground")}>
          <Wrench className="size-3.5" /> PMS {outlook.nextPms.kmLeft >= 0 ? `due in ${num(outlook.nextPms.kmLeft)} km` : `overdue by ${num(-outlook.nextPms.kmLeft)} km`}
        </div>
      )}
    </Card>
  );
}
