"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, GripVertical, Lock, MapPin, PackageCheck, Ship, Truck, Warehouse, X } from "lucide-react";
import type { AreaId, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { orderLoadKg, orderTotal } from "@/lib/calc";
import { unassignedTruckOrders } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDay, fmtTime, kg, peso } from "@/lib/format";
import { cn, groupBy, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CapacityBar, EmptyState, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

const DND_TYPE = "application/x-freshroute-orders";

export function DispatchBoard() {
  const [date, setDate] = React.useState(TOMORROW);
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const assign = useAppStore((s) => s.assignOrderToTrip);
  const metrics = useTripMetrics();
  const customers = useCustomerMap();
  const [dragging, setDragging] = React.useState<string[] | null>(null);

  const dayTrips = trips.filter((t) => t.date === date).sort((a, b) => a.truckId.localeCompare(b.truckId));
  const unassigned = unassignedTruckOrders(orders, date);
  const groups = Object.entries(groupBy(unassigned, (o) => customers.get(o.customerId)!.areaId)).sort((a, b) => b[1].length - a[1].length);
  const pickups = orders.filter((o) => o.deliveryDate === date && o.fulfillment === "pickup" && o.status !== "Cancelled");
  const partner = orders.filter((o) => o.deliveryDate === date && o.fulfillment === "partner" && o.status !== "Cancelled");
  const draggingKg = dragging ? sumBy(dragging.map((id) => orders.find((o) => o.id === id)!).filter(Boolean), orderLoadKg) : 0;

  const doAssign = (ids: string[], trip: Trip) => {
    const m = metrics.get(trip.id)!;
    const add = sumBy(ids.map((id) => orders.find((o) => o.id === id)!), orderLoadKg);
    ids.forEach((id) => assign(id, trip.id));
    const after = m.outboundLoadKg + add;
    const truck = truckById(trip.truckId);
    if (after > m.capacityKg) toast.warning(`${truck.code} capacity exceeded by ${kg(after - m.capacityKg)}`, { description: "Move an order to the other truck or split the load." });
    else toast.success(`${ids.length} order${ids.length > 1 ? "s" : ""} assigned to ${truck.code}`, { description: `${kg(m.capacityKg - after)} remaining on ${trip.id}` });
  };
  const locked = (t: Trip) => t.status === "In Transit" || t.status === "Returning" || t.status === "Completed";

  return (
    <>
      <PageHeader
        title="Dispatch Board"
        description="Drag orders onto a truck, or use the Assign button. Loads include ice and packaging; capacity is the configured operational payload."
        actions={
          <Tabs value={date} onValueChange={setDate}>
            <TabsList>
              <TabsTrigger value={TODAY}>Today · {fmtDay(TODAY)}</TabsTrigger>
              <TabsTrigger value={TOMORROW}>Tomorrow · {fmtDay(TOMORROW)}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {/* Unassigned */}
        <div className="grid content-start gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Unassigned orders</h2>
            <span className="text-xs text-muted-foreground tabular">
              {unassigned.length} orders · {kg(sumBy(unassigned, orderLoadKg))}
            </span>
          </div>
          {groups.length === 0 && <EmptyState icon={PackageCheck} title="All truck orders are assigned" description={`Nothing waiting for ${fmtDay(date)}.`} className="bg-card" />}
          {groups.map(([areaId, list]) => {
            const ids = list.map((o) => o.id);
            return (
              <Card key={areaId} className="gap-0 overflow-hidden">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DND_TYPE, ids.join(","));
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(ids);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className="flex cursor-grab items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2.5 active:cursor-grabbing"
                  title="Drag the whole area onto a truck"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="size-4 text-muted-foreground" />
                    <MapPin className="size-4 text-primary" />
                    <div>
                      <div className="font-semibold">{areaName(areaId as AreaId)}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {list.length} order{list.length > 1 ? "s" : ""} · {kg(sumBy(list, orderLoadKg))}
                      </div>
                    </div>
                  </div>
                  <AssignMenu trips={dayTrips} locked={locked} onPick={(t) => doAssign(ids, t)} label="Assign all" />
                </div>
                <ul className="divide-y">
                  {list.map((o) => {
                    const c = customers.get(o.customerId)!;
                    return (
                      <li
                        key={o.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DND_TYPE, o.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragging([o.id]);
                        }}
                        onDragEnd={() => setDragging(null)}
                        className="flex cursor-grab items-center gap-2 px-3 py-2 hover:bg-muted/40 active:cursor-grabbing"
                      >
                        <GripVertical className="size-4 shrink-0 text-muted-foreground/60" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/orders/${o.id}`} className="text-[13px] font-medium hover:underline">
                              {c.name}
                            </Link>
                            {o.status === "Pending Confirmation" && <StatusBadge status="Pending Confirmation" icon={false} label="Pending" />}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {o.id} · {orderSummary(o)}
                          </div>
                          {o.notes?.toLowerCase().includes("credit hold") && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-danger">
                              <AlertTriangle className="size-3" /> Credit hold — confirm with accounting
                            </div>
                          )}
                        </div>
                        <div className="text-right text-xs tabular">
                          <div className="font-medium">{kg(orderLoadKg(o))}</div>
                          <div className="text-muted-foreground">{peso(orderTotal(o))}</div>
                        </div>
                        <AssignMenu trips={dayTrips} locked={locked} onPick={(t) => doAssign([o.id], t)} label="Assign" compact />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}

          {(pickups.length > 0 || partner.length > 0) && (
            <Card className="gap-2 p-3 text-sm">
              <div className="font-semibold">Not on trucks</div>
              {pickups.length > 0 && (
                <div className="flex items-start gap-2">
                  <Warehouse className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    {pickups.length} bodega pickup{pickups.length > 1 ? "s" : ""} · {kg(sumBy(pickups, orderLoadKg))}
                    <div className="text-xs text-muted-foreground">{pickups.map((o) => customers.get(o.customerId)!.name).join(", ")}</div>
                  </div>
                </div>
              )}
              {partner.length > 0 && (
                <div className="flex items-start gap-2">
                  <Ship className="mt-0.5 size-4 text-muted-foreground" />
                  <div>
                    {partner.length} inter-island via sea-freight partner
                    <div className="text-xs text-muted-foreground">{partner.map((o) => customers.get(o.customerId)!.name).join(", ")}</div>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Trucks */}
        <div className="grid content-start gap-4 lg:grid-cols-2">
          {dayTrips.length === 0 && <EmptyState title="No trips scheduled for this day." className="bg-card lg:col-span-2" />}
          {dayTrips.map((t) => (
            <TruckColumn key={t.id} trip={t} locked={locked(t)} draggingKg={draggingKg} dragging={!!dragging} onDropIds={(ids) => doAssign(ids, t)} />
          ))}
        </div>
      </div>
    </>
  );
}

function AssignMenu({ trips, locked, onPick, label, compact }: { trips: Trip[]; locked: (t: Trip) => boolean; onPick: (t: Trip) => void; label: string; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant={compact ? "ghost" : "outline"} className={compact ? "h-7 px-2 text-xs" : ""}>
          <Truck /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Assign to</DropdownMenuLabel>
        {trips.map((t) => (
          <DropdownMenuItem key={t.id} disabled={locked(t)} onSelect={() => onPick(t)}>
            <Truck /> {truckById(t.truckId).code} · {t.id} {locked(t) && <Lock className="ml-auto size-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TruckColumn({ trip, locked, draggingKg, dragging, onDropIds }: { trip: Trip; locked: boolean; draggingKg: number; dragging: boolean; onDropIds: (ids: string[]) => void }) {
  const m = useTripMetrics().get(trip.id)!;
  const customers = useCustomerMap();
  const assign = useAppStore((s) => s.assignOrderToTrip);
  const [over, setOver] = React.useState(false);
  const truck = truckById(trip.truckId);
  const remaining = m.capacityKg - m.outboundLoadKg;
  const preview = over ? m.outboundLoadKg + draggingKg : m.outboundLoadKg;
  const exceeded = preview - m.capacityKg;
  return (
    <Card
      onDragOver={(e) => {
        if (locked || !e.dataTransfer.types.includes(DND_TYPE)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (locked) return;
        const ids = e.dataTransfer.getData(DND_TYPE).split(",").filter(Boolean);
        if (ids.length) onDropIds(ids);
      }}
      className={cn("gap-0 overflow-hidden transition-shadow", over && "ring-2 ring-primary", dragging && !locked && !over && "ring-1 ring-dashed ring-primary/40", locked && "opacity-90")}
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
              {truck.make} {truck.model.split(" ")[0]} · {truck.plateNo} · {driverById(trip.driverId).name}
            </div>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        <Link href={`/trips/${trip.id}`} className="text-sm font-medium hover:underline">
          {trip.id} · {routeById(trip.routeId).name}
        </Link>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Available capacity" value={kg(m.capacityKg)} />
          <Metric label="Assigned" value={kg(m.outboundLoadKg)} />
          <Metric label="Remaining" value={kg(remaining)} tone={remaining < 0 ? "danger" : remaining < 500 ? "warning" : undefined} />
        </div>
        <CapacityBar used={preview} capacity={m.capacityKg} showNumbers={false} />
        {exceeded > 0 && (
          <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs font-medium text-danger" role="alert">
            <AlertTriangle className="size-3.5" /> Truck capacity exceeded by {kg(exceeded)}.
          </div>
        )}
        {locked ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" /> Departed {trip.actualDeparture ? fmtTime(trip.actualDeparture) : ""} — load is locked.
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Departs {fmtTime(trip.departure)} · drop orders here</div>
        )}
      </div>
      <ul className="max-h-[520px] divide-y overflow-y-auto">
        {m.deliveries.map((d) => {
          const o = m.orders.find((x) => x.id === d.orderId);
          if (!o) return null;
          const c = customers.get(o.customerId)!;
          return (
            <li key={d.id} className="flex items-center gap-2 px-4 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular">{d.stopSeq}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {areaName(c.areaId)} · {orderSummary(o)}
                </div>
              </div>
              <div className="text-right text-xs tabular">
                <div className="font-medium">{kg(orderLoadKg(o))}</div>
                <div className="text-muted-foreground">ETA {fmtTime(d.eta)}</div>
              </div>
              {!locked && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${o.id} from ${truck.code}`}
                  onClick={() => {
                    assign(o.id, null);
                    toast(`${o.id} moved back to unassigned`);
                  }}
                >
                  <X />
                </Button>
              )}
            </li>
          );
        })}
        {m.deliveries.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">No orders yet — drag orders here.</li>}
      </ul>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular", tone === "danger" && "text-danger", tone === "warning" && "text-[oklch(0.55_0.13_65)]")}>{value}</div>
    </div>
  );
}
