"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, ChevronDown, Clock3, FileText, Inbox, MoreHorizontal, Pause, Pencil, Play, Radio, Send, Truck, XCircle } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap } from "@/hooks/use-data";
import { COMPANY } from "@/data/company";
import { truckById } from "@/data/fleet";
import type { BackhaulListing, ShipperListing } from "@/types";
import { act } from "@/lib/act";
import { legRouteLine, requestStatus, type FitView, type ListingView } from "@/lib/backhaul-marketplace";
import { etaAt, shortArea } from "@/lib/load-board";
import { deliveryIdForJob, jobTotal } from "@/lib/logistics";
import { fmtDay, fmtTime, fmtTimeWindow, kg, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CapacityBar } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

type Terms = { listing?: Pick<BackhaulListing, "ratePerKg" | "minimumCharge" | "acceptedCargo"> };
const rateLine = (v: Terms) => (v.listing ? `${peso(v.listing.ratePerKg, true)}/kg · min ${peso(v.listing.minimumCharge)}` : undefined);
const acceptsLine = (v: Terms) => (v.listing?.acceptedCargo.length ? v.listing.acceptedCargo.join(", ") : "Any cargo");

/** Pickup towns on the way home with the truck's planned time in each (a window for shippers). */
function PickupTimes({ v, shipper = false }: { v: Pick<FitView, "pickupAreas" | "leg">; shipper?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Pickup times on the way home">
      {v.pickupAreas.map((a) => (
        <li key={a} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
          <span className="font-medium">{shortArea(a)}</span>
          <span className="text-muted-foreground tabular">{shipper ? fmtTimeWindow(etaAt(v.leg, a)) : `~${fmtTime(etaAt(v.leg, a))}`}</span>
        </li>
      ))}
    </ul>
  );
}

export function ListingCard({ v, onEdit, onRequests }: { v: ListingView; onEdit: () => void; onRequests: () => void }) {
  const setStatus = useAppStore((s) => s.setBackhaulListingStatus);
  const deliveries = useAppStore((s) => s.deliveries);
  const customers = useCustomerMap();
  const truck = truckById(v.trip.truckId);
  const l = v.listing;
  const pendingCount = v.requests.filter((r) => requestStatus(r, undefined, v.status) === "Requested").length;
  const closedLeg = v.status === "Departed" || v.status === "Closed";

  return (
    <Card className="h-full gap-0 overflow-hidden p-0" role="region" aria-label={`${v.truckLabel} return leg listing`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <span className="size-2 rounded-full" style={{ background: truck.color }} aria-hidden />
            {v.truckLabel}
            {l && <span className="font-mono text-[11px] font-normal text-muted-foreground">{l.id}</span>}
          </h3>
          <Link href={`/trips/${v.trip.id}`} className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary hover:underline">
            {v.trip.id} · {v.trip.status}
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="mx-5 mt-3 grid gap-2 rounded-lg border bg-muted/20 p-3">
        <div className="text-sm font-semibold">{legRouteLine(v)}</div>
        <PickupTimes v={v} />
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="size-3" /> Lucena ~{fmtTime(v.leg.arrivalAt)}
        </div>
      </div>

      <div className="grid gap-3 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Open return space</div>
            <div className="text-2xl leading-none font-semibold tracking-tight text-primary tabular">{kg(v.openKg)}</div>
          </div>
          {pendingCount > 0 ? (
            <button type="button" onClick={onRequests} className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-warning-soft px-2 py-1 text-xs font-medium text-[oklch(0.48_0.12_65)] hover:underline">
              <Inbox className="size-3.5" /> {pendingCount} request{pendingCount === 1 ? "" : "s"} · {kg(v.pendingKg)}
            </button>
          ) : (
            l && !closedLeg && <span className="text-xs text-muted-foreground">No requests waiting</span>
          )}
        </div>
        <CapacityBar used={v.usedKg} capacity={v.totalKg} label="Return load" size="sm" />
        {l ? (
          <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Rate</dt>
              <dd className="mt-0.5 font-medium tabular">{rateLine(v)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accepts</dt>
              <dd className="mt-0.5 font-medium">{acceptsLine(v)}</dd>
            </div>
          </dl>
        ) : (
          <p className="border-t pt-3 text-xs text-muted-foreground">{closedLeg ? "This return leg no longer takes cargo." : "Not listed yet — shippers can't see or request this space."}</p>
        )}
      </div>

      {l && (
        <details className="border-t">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/25 px-5 py-3 transition-colors hover:bg-muted/60">
            <span className="text-xs">
              <span className="font-semibold">Marketplace manifest</span>
              <span className="ml-1 text-muted-foreground">
                · {v.booked.length} shipment{v.booked.length === 1 ? "" : "s"} · {kg(v.bookedKg)} · {peso(v.bookedFreight)}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </summary>
          <ul className="divide-y border-t">
            {v.booked.map(({ request: r, job }) => {
              const dlvId = deliveryIdForJob(job.id);
              const hasDelivery = deliveries.some((d) => d.id === dlvId);
              return (
                <li key={r.id} className="grid gap-1 px-5 py-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/customers/${job.customerId}`} className="font-medium hover:text-primary hover:underline">
                      {customers.get(job.customerId)?.name ?? r.shipper.businessName}
                    </Link>
                    <span className="shrink-0 font-semibold tabular">{kg(job.weightKg)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {job.cargoDescription} · {shortArea(job.pickup.areaId)} → {shortArea(job.dropoff.areaId)} · {peso(jobTotal(job))}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/jobs/${job.id}`} className="font-mono text-primary hover:underline">
                      {job.id}
                    </Link>
                    <StatusBadge status={job.status} className="text-[10px]" />
                    {hasDelivery && (
                      <Link href={`/print/delivery-receipt/${dlvId}`} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <FileText className="size-3" /> Waybill / DR
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
            {v.booked.length === 0 && <li className="px-5 py-4 text-xs text-muted-foreground">No marketplace shipments on this leg yet. Each confirmed request gets its own job, delivery and waybill.</li>}
          </ul>
        </details>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
        <Button variant="ghost" size="sm" className="px-0 text-xs" asChild>
          <Link href={`/trips/${v.trip.id}`}>
            View trip <ArrowUpRight />
          </Link>
        </Button>
        {!l ? (
          !closedLeg && (
            <Button size="sm" className="text-xs" onClick={onEdit}>
              <Radio /> List this leg
            </Button>
          )
        ) : closedLeg && v.status === "Departed" ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs" aria-label={`Listing actions for ${l.id}`}>
                Manage listing <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {v.status === "Closed" ? (
                <DropdownMenuItem onSelect={onEdit}>
                  <Play /> Reopen listing
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil /> Edit rate & terms
                  </DropdownMenuItem>
                  {l.status === "Paused" ? (
                    <DropdownMenuItem
                      onSelect={() => void act(() => setStatus(l.id, "Published"), () => toast(`${l.id} published again`, { description: "Shippers can request space." }))}
                    >
                      <Play /> Resume listing
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => void act(() => setStatus(l.id, "Paused"), () => toast(`${l.id} paused`, { description: "Hidden from shippers. Waiting requests can still be confirmed." }))}
                    >
                      <Pause /> Pause — stop new requests
                    </DropdownMenuItem>
                  )}
                  {pendingCount > 0 && (
                    <DropdownMenuItem onSelect={onRequests}>
                      <Inbox /> Review requests
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void act(() => setStatus(l.id, "Closed"), () => toast(`${l.id} closed`, { description: pendingCount ? `${pendingCount} waiting request(s) will expire.` : undefined }))}
                  >
                    <XCircle /> Close listing
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Card>
  );
}

/**
 * What an outside shipper sees for one listed return leg, here and on the public Return trips page.
 * No trip ids, plate, driver, other cargo or revenue, and truck times only as two-hour windows.
 */
/** A listed return leg as shippers see it (no trip, plate, driver or exact times). */
export function ShipperListingCard({ v, onRequest }: { v: ShipperListing; onRequest: () => void }) {
  return (
    <Card className="h-full gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{fmtDay(v.date)} · return trip to Lucena</div>
          <h3 className="mt-0.5 text-[15px] font-semibold">{legRouteLine(v)}</h3>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Truck className="size-4.5" />
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {COMPANY.shortName} · {v.vehicleType} ({v.body}) · arrives Lucena {fmtTimeWindow(v.leg.arrivalAt)}
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">Pickup windows</div>
        <PickupTimes v={v} shipper />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Space left</dt>
          <dd className="mt-0.5 text-lg leading-tight font-semibold text-primary tabular">{kg(v.openKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rate</dt>
          <dd className="mt-0.5 font-medium tabular">{rateLine(v)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Accepts</dt>
          <dd className="mt-0.5">
            {acceptsLine(v)}
            {v.listing?.restrictions && <span className="text-muted-foreground"> · {v.listing.restrictions}</span>}
          </dd>
        </div>
      </dl>
      <Button className="mt-auto w-full" onClick={onRequest}>
        <Send /> Get a quote & request space <ArrowRight />
      </Button>
    </Card>
  );
}
