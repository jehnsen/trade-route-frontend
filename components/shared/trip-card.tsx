"use client";

import Link from "next/link";
import { ArrowRight, Clock, CornerDownLeft, MapPin, UserRound } from "lucide-react";
import type { Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { buildTripStops } from "@/lib/selectors";
import { routeById, returnLegName } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { productById } from "@/data/products";
import { fmtTime, fmtDay, kg, peso, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { StatusBadge } from "./status-badge";
import { CapacityBar, MoneyDisplay } from "./common";

export function TripCard({ trip, compact, className }: { trip: Trip; compact?: boolean; className?: string }) {
  const metrics = useTripMetrics().get(trip.id)!;
  const route = routeById(trip.routeId);
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
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
      <div className="grid gap-1.5 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground">Outbound</span>
            <div className="font-medium">{route.name}</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CornerDownLeft className="mt-0.5 size-4 shrink-0 text-[var(--chart-3)]" />
          <div>
            <span className="text-xs text-muted-foreground">Return</span>
            <div className="font-medium">{returnLegName(route)}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" /> {driver.name}
        </span>
        <span>{truck.code} — {truck.make} {truck.model.split(" ")[0]}</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" /> {fmtTime(trip.actualDeparture ?? trip.departure)} → {fmtTime(trip.actualReturn ?? trip.expectedReturn)}
        </span>
      </div>
      {!compact && metrics.outboundCargo.length > 0 && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="mb-1 font-medium text-muted-foreground">Outbound cargo</div>
            {metrics.outboundCargo.slice(0, 3).map((c) => (
              <div key={c.productId} className="flex justify-between gap-2">
                <span className="truncate">{productById(c.productId).localName}</span>
                <span className="tabular">{c.quantity.toLocaleString()} {productById(c.productId).unit === "pc" ? "pcs" : "kg"}</span>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-1 font-medium text-muted-foreground">Return cargo</div>
            {metrics.returnCargo.length ? (
              metrics.returnCargo.slice(0, 3).map((c) => (
                <div key={c.productId} className="flex justify-between gap-2">
                  <span className="truncate">{productById(c.productId).localName}</span>
                  <span className="tabular">{kg(c.quantity)}</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">No backhaul yet</div>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-2">
        <CapacityBar used={metrics.outboundLoadKg} capacity={metrics.capacityKg} label="Outbound load" size="sm" />
        <CapacityBar used={metrics.returnLoadKg} capacity={metrics.capacityKg} label="Return load" size="sm" />
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2 border-t pt-3 text-xs">
          <div>
            <div className="text-muted-foreground">Revenue</div>
            <MoneyDisplay amount={metrics.revenue} className="font-semibold" compact />
          </div>
          <div>
            <div className="text-muted-foreground">Trip cost</div>
            <MoneyDisplay amount={metrics.tripCost} className="font-semibold" compact />
          </div>
          <div>
            <div className="text-muted-foreground">Contribution</div>
            <MoneyDisplay amount={metrics.contribution} className="font-semibold text-[oklch(0.45_0.13_150)]" compact />
          </div>
        </div>
      )}
      <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        View trip details <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

export function TruckStatusCard({ truckId, trip }: { truckId: string; trip?: Trip }) {
  const truck = truckById(truckId);
  const metrics = useTripMetrics();
  const customers = useAppStore((s) => s.customers);
  const m = trip ? metrics.get(trip.id) : undefined;
  const stops = trip && m ? buildTripStops(trip, m, customers) : [];
  const current = stops.find((s) => s.status === "current");
  const status = trip?.status === "In Transit" ? "In Transit" : trip?.status === "Loading" ? "Loading" : trip?.status === "Completed" ? "Available" : trip ? trip.status : "Available";
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: truck.color }} />
            <Link href={`/trucks/${truck.id}`} className="font-semibold hover:underline">
              {truck.code}
            </Link>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{truck.plateNo}</span>
          </div>
          <div className="text-xs text-muted-foreground">{truck.name}</div>
        </div>
        <StatusBadge status={status} />
      </div>
      {trip && m ? (
        <>
          <div className="text-sm">
            <span className="text-muted-foreground">Route: </span>
            <Link href={`/trips/${trip.id}`} className="font-medium hover:underline">
              {routeById(trip.routeId).name}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Driver</div>
              <div className="font-medium">{driverById(trip.driverId).name}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{current && current.type !== "depart" ? "Next stop" : "Departure"}</div>
              <div className="truncate font-medium">{current && current.type !== "depart" ? `${current.label} · ${fmtTime(current.eta)}` : `${fmtTime(trip.actualDeparture ?? trip.departure)} from Lucena`}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Drops</div>
              <div className="font-medium tabular">
                {m.delivered} of {m.deliveries.length} delivered
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Cargo value</div>
              <div className="font-medium">{peso(m.revenue)}</div>
            </div>
          </div>
          <CapacityBar used={m.outboundLoadKg} capacity={m.capacityKg} label="Capacity utilization" />
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No trip scheduled today.</div>
      )}
    </Card>
  );
}
