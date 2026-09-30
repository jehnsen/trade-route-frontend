"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Clock3, MapPin, Truck, UserRound } from "lucide-react";
import type { Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { truckById, driverById } from "@/data/fleet";
import { tripProgress, tripWarnings, type TripMetrics } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, pesoCompact, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { CapacityBar } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

export function TripScheduleCard({ trip, metrics: m }: { trip: Trip; metrics: TripMetrics }) {
  const trips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const progress = tripProgress(trip);
  const warnings = tripWarnings(trip, m, trips, maintenance, documents);
  const stop = progress.current ?? progress.next;
  const progressLabel = trip.status === "Planned" ? "First stop" : progress.current ? "At stop" : "Next stop";

  return (
    <Card className="trip-schedule-card h-full overflow-hidden" role="region" aria-label={`${truck.code} · ${trip.id}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-primary"><Truck className="size-5" strokeWidth={1.6} /></span>
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">{truck.code}<span className="size-1.5 rounded-full" style={{ background: truck.color }} /></h3>
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">{truck.plateNo}</span>
          </div>
        </div>
        <StatusBadge status={trip.status} className="rounded-full text-[11px]" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-5 text-[11px] text-muted-foreground">
        <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-1 font-mono hover:text-primary hover:underline">{trip.id}<ArrowUpRight className="size-3" /></Link>
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3" />{relativeDay(trip.date)} · {fmtDay(trip.date)}</span>
      </div>

      <div className="mx-5 mt-4 rounded-lg border border-primary/10 bg-accent/40 p-3.5">
        <div className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Trip route</div>
        <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" /><p className="text-[13px] leading-relaxed font-medium">{tripRouteLine(trip)}</p></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-primary/10 pt-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><UserRound className="size-3" />{driver.name}</span>
          <span className="inline-flex items-center gap-1.5 font-medium tabular"><Clock3 className="size-3 text-muted-foreground" /><span>{fmtTime(trip.actualDeparture ?? trip.departure)} → {fmtTime(trip.actualReturn ?? trip.expectedReturn)}</span></span>
        </div>
        <div className="mt-1 text-right text-[10px] text-muted-foreground">{trip.actualDeparture ? "Departed" : "Scheduled departure"} · {trip.actualReturn ? "actual return" : "expected return"}</div>
      </div>

      <div className="grid gap-4 p-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium">Route progress</span>
            <span className="text-[11px] text-muted-foreground tabular">{progress.done}/{progress.total} stops processed · {m.delivered}/{m.deliveryCount} delivered</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${truck.code} route progress`} aria-valuemin={0} aria-valuemax={Math.max(1, progress.total)} aria-valuenow={progress.done}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{stop ? <><span className="font-medium text-foreground">{progressLabel}:</span> {stop.location.name}</> : progress.total ? "All route stops processed" : "Stops will appear when cargo is assigned"}</p>
        </div>
        <div className="grid gap-3 border-t pt-4">
          <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label="Outbound" size="sm" />
          <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return leg" size="sm" />
        </div>
        {warnings.length > 0 && <ul className="grid gap-1.5">{warnings.map((warning) => <li key={warning.message} className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-danger"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{warning.message}</li>)}</ul>}
      </div>

      <details className="trip-financials mt-auto border-t">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/25 px-5 py-3.5 transition-colors hover:bg-muted/60">
          <span className="text-xs font-medium">Trip financials</span>
          <span className="flex items-center gap-2 text-xs"><span className={cn("font-semibold tabular", m.contribution < 0 ? "text-danger" : "text-primary")}>{pesoCompact(m.contribution)}</span><span className="text-[10px] text-muted-foreground">{m.dieselLogged ? "contribution" : "est. contribution"}</span><ChevronDown className="financials-chevron size-3.5 shrink-0 text-muted-foreground transition-transform" /></span>
        </summary>
        <div className="grid grid-cols-3 gap-3 border-t px-5 py-4">
          <div><div className="text-[10px] text-muted-foreground">Freight revenue</div><div className="mt-1 text-xs font-semibold tabular">{pesoCompact(m.revenue)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">Trip expenses</div><div className="mt-1 text-xs font-semibold tabular">{pesoCompact(m.expenseTotal + m.estimatedDiesel)}</div></div>
          <div><div className="text-[10px] text-muted-foreground">Contribution</div><div className={cn("mt-1 text-xs font-semibold tabular", m.contribution < 0 ? "text-danger" : "text-primary")}>{pesoCompact(m.contribution)}</div></div>
          {!m.dieselLogged && <p className="col-span-3 text-[10px] leading-relaxed text-muted-foreground">Expenses and contribution include estimated diesel until a fill-up is logged.</p>}
        </div>
      </details>
      <Link href={`/trips/${trip.id}`} className="flex items-center justify-between border-t px-5 py-3.5 text-xs font-medium text-primary transition-colors hover:bg-accent"><span>Manage trip <span className="ml-1 font-normal text-muted-foreground">· {m.jobs.length} jobs</span></span><ArrowRight className="size-3.5" /></Link>
    </Card>
  );
}
