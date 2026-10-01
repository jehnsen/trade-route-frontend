"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronDown, Clock3, MapPin, Package, Truck, UserRound, type LucideIcon } from "lucide-react";
import type { Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap } from "@/hooks/use-data";
import { returnLegName, routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { canAddReturnCargo, jobTotal, truckLocation, type TripMetrics } from "@/lib/logistics";
import { fmtTime, kg, peso } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { CapacityBar } from "@/components/shared/common";
import { LoadTypeBadge, StatusBadge } from "@/components/shared/status-badge";

export function BackhaulMetric({ label, value, hint, icon: Icon, featured }: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: LucideIcon;
  featured?: boolean;
}) {
  return (
    <div className={cn("backhaul-metric min-w-0 p-4 sm:p-5", featured && "backhaul-metric-featured")}>
      <div className="flex items-start justify-between gap-2 text-xs font-medium">
        <span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} />
      </div>
      <div className="my-3 text-[26px] leading-none font-semibold tracking-tight tabular sm:text-[30px]">{value}</div>
      <p className="text-[11px] leading-relaxed opacity-75">{hint}</p>
    </div>
  );
}

export function ReturnLegCard({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const customers = useCustomerMap();
  const boardLoads = useAppStore((s) => s.boardLoads);
  const truck = truckById(trip.truckId);
  const route = routeById(trip.routeId);
  const loc = truckLocation(trip);
  const free = Math.max(0, m.capacityKg - m.returnKg);
  const over = m.returnKg > m.capacityKg;
  const acceptsCargo = canAddReturnCargo(trip);
  const paid = sumBy(m.jobs.filter((j) => j.leg === "return"), jobTotal);
  const companyCount = m.returnLoads.filter((l) => l.type === "Company-Owned").length;
  const manifestHref = `/loads?trip=${trip.id}`;

  return (
    <Card className="backhaul-trip h-full overflow-hidden" role="region" aria-label={`${truck.code} return trip`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg border bg-muted/40 text-primary"><Truck className="size-5" strokeWidth={1.6} /></span>
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">{truck.code}<span className="size-1.5 rounded-full" style={{ background: truck.color }} /></h3>
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">{truck.plateNo}</span>
          </div>
        </div>
        <StatusBadge status={trip.status} className="rounded-full text-[11px]" />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-5 text-[11px] text-muted-foreground">
        <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-1 font-mono hover:text-primary hover:underline">{trip.id}<ArrowUpRight className="size-3" /></Link>
        <span className="inline-flex items-center gap-1.5"><UserRound className="size-3" />{driverById(trip.driverId).name}</span>
      </div>

      <div className="mx-5 mt-4 rounded-lg border border-primary/10 bg-accent/40 p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="font-semibold tracking-wider uppercase">Return route</span>
          <span className="inline-flex items-center gap-1 tabular"><Clock3 className="size-3" />{trip.actualReturn ? "Returned" : "ETA Lucena"} {fmtTime(trip.actualReturn ?? trip.expectedReturn)}</span>
        </div>
        <div className="text-sm leading-relaxed font-semibold">{returnLegName(route)}</div>
        <div className="mt-2.5 flex items-start gap-1.5 border-t border-primary/10 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 size-3 shrink-0" />
          <div><span>{loc.label}</span>{loc.detail && <span className="block text-[10px]">{loc.detail}</span>}</div>
        </div>
      </div>

      <div className="grid gap-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">{over ? "Over return capacity" : "Available return space"}</div>
            <div className={cn("text-2xl leading-none font-semibold tracking-tight tabular", over ? "text-danger" : "text-primary")}>{kg(over ? m.returnKg - m.capacityKg : free)}</div>
          </div>
          <span className="text-[11px] text-muted-foreground">{over ? "Reassign cargo before departure" : !acceptsCargo ? "Trip closed to new cargo" : free === 0 ? "Return leg is full" : "Open for return cargo"}</span>
        </div>
        <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Booked" size="sm" />
        <div className="mt-1 grid grid-cols-2 divide-x border-t pt-4">
          <div className="pr-3"><div className="text-[11px] text-muted-foreground">Paid freight</div><div className="mt-1 text-sm font-semibold tabular">{peso(paid)}</div></div>
          <div className="pl-4"><div className="text-[11px] text-muted-foreground">Company cargo value</div><div className="mt-1 text-sm font-semibold tabular">{peso(m.companyCargoValue)}</div><div className="mt-0.5 text-[10px] text-muted-foreground">Purchase value</div></div>
        </div>
      </div>

      <details className="backhaul-manifest border-t">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/25 px-5 py-3.5 transition-colors hover:bg-muted/60">
          <span className="flex items-center gap-2.5">
            <Package className="size-4 text-muted-foreground" />
            <span><span className="block text-xs font-semibold">Cargo manifest <span className="ml-1 font-normal text-muted-foreground">· {m.returnLoads.length} loads</span></span><span className="mt-0.5 block text-[10px] text-muted-foreground">{m.returnLoads.length - companyCount} paid · {companyCount} company-owned</span></span>
          </span>
          <ChevronDown className="manifest-chevron size-4 shrink-0 text-muted-foreground transition-transform" />
        </summary>
        <ul className="divide-y border-t">
          {m.returnLoads.map((load) => (
            <li key={load.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={load.jobId ? `/jobs/${load.jobId}` : `${manifestHref}&q=${load.id}`} className="min-w-0 text-xs leading-relaxed font-medium hover:text-primary hover:underline">{load.cargoDescription}</Link>
                <span className="shrink-0 text-xs font-semibold tabular">{kg(load.weightKg)}</span>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{load.jobId ? customers.get(load.customerId ?? "")?.name : `Pickup · ${load.pickup.name}`}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <LoadTypeBadge type={load.type} className="text-[10px]" />
                {load.jobId && boardLoads.some((b) => b.jobId === load.jobId) && <span className="text-[10px] text-muted-foreground">via Load Board</span>}
                {load.jobId && m.jobs.some((j) => j.id === load.jobId && j.source === "Backhaul Marketplace") && <span className="text-[10px] text-muted-foreground">via Marketplace</span>}
              </div>
            </li>
          ))}
          {m.returnLoads.length === 0 && <li className="px-5 py-5 text-xs text-muted-foreground">No return cargo assigned yet. Find a load or add company cargo to fill this leg.</li>}
        </ul>
      </details>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
        <Button variant="ghost" size="sm" className="px-0 text-xs" asChild><Link href={manifestHref}>Manage cargo <ArrowUpRight /></Link></Button>
        {acceptsCargo && free > 0 ? (
          <Button variant="outline" size="sm" className="text-xs" asChild><Link href="/load-board?tab=capacity">Find return loads <ArrowRight /></Link></Button>
        ) : (
          <Button variant="outline" size="sm" className="text-xs" asChild><Link href={`/trips/${trip.id}`}>View trip <ArrowRight /></Link></Button>
        )}
      </div>
    </Card>
  );
}
