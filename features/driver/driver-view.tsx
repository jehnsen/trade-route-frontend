"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Camera, CheckCircle2, ChevronDown, CornerDownLeft, MapPin, Navigation, Package, Phone, Play, Truck, Upload, Warehouse, LogOut } from "lucide-react";
import type { Delivery } from "@/types";
import { useAppStore, useHydrated } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { DRIVERS, driverById, truckById } from "@/data/fleet";
import { areaName, routeById } from "@/data/areas";
import { productById } from "@/data/products";
import { supplierById } from "@/data/suppliers";
import { orderBilledAmount } from "@/lib/calc";
import { fmtTime, peso, qty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Input, Skeleton, Checkbox } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/common";
import { Logo } from "@/components/layout/brand";

export function DriverView() {
  const hydrated = useHydrated((s) => s.hydrated);
  const [driverId, setDriverId] = React.useState("DRV-01");
  const trips = useAppStore((s) => s.trips);
  const orders = useAppStore((s) => s.orders);
  const setTripStatus = useAppStore((s) => s.setTripStatus);
  const markArrived = useAppStore((s) => s.markArrived);
  const setPO = useAppStore((s) => s.setPOStatus);
  const setRole = useAppStore((s) => s.setRole);
  const customers = useCustomerMap();
  const metrics = useTripMetrics();
  const [podFor, setPodFor] = React.useState<Delivery | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const trip = trips.find((t) => t.driverId === driverId && t.date === TODAY) ?? trips.filter((t) => t.driverId === driverId && t.date > TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];
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
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white hover:bg-white/10 hover:text-white"
          asChild
          aria-label="Back to office view"
          onClick={() => setRole("owner")}
        >
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
          <EmptyState icon={Truck} title={`No trips scheduled for ${driver.name}`} description="Rest day. Check with dispatcher Noel Pascual for changes." className="bg-card" />
        </div>
      </>
    );

  const m = metrics.get(trip.id)!;
  const route = routeById(trip.routeId);
  const truck = truckById(trip.truckId);
  const pending = m.deliveries.filter((d) => !["Delivered", "Failed", "Returned"].includes(d.status));
  const current = trip.status === "In Transit" ? pending[0] : undefined;
  const started = trip.status === "In Transit" || trip.status === "Returning" || trip.status === "Completed";

  return (
    <>
      {header}
      <div className="grid gap-3 p-3 pb-10 sm:p-4">
        <Card className="gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">{trip.date === TODAY ? "Today's trip" : "Next trip"}</div>
              <div className="text-lg font-semibold">{trip.id}</div>
            </div>
            <StatusBadge status={trip.status} />
          </div>
          <div className="text-sm font-medium">{route.name} → Lucena</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Truck className="size-3.5" /> {truck.code} · {truck.plateNo}
            </span>
            <span>Depart {fmtTime(trip.actualDeparture ?? trip.departure)}</span>
            <span>Back ~{fmtTime(trip.expectedReturn)}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={m.delivered} aria-valuemax={m.deliveries.length} aria-label="Drops completed">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(m.delivered / Math.max(1, m.deliveries.length)) * 100}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {m.delivered} of {m.deliveries.length} drops delivered · {m.pos.length} pickups on the way back
          </div>
          {!started && (
            <Button
              size="xl"
              className="mt-1"
              onClick={() => {
                setTripStatus(trip.id, "In Transit");
                toast.success("Trip started — safe trip!", { description: `Dispatcher notified that ${truck.code} left Lucena.` });
              }}
            >
              <Play /> Start trip — departed Lucena
            </Button>
          )}
        </Card>

        {current && (
          <StopCard
            key={current.id}
            d={current}
            highlight
            onArrive={() => {
              markArrived(current.id);
              toast.success("Marked arrived", { description: "Customer notified via SMS (demo)." });
            }}
            onPod={() => setPodFor(current)}
          />
        )}

        <div className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">All stops</div>
        {m.deliveries.map((d) => {
          const o = orders.find((x) => x.id === d.orderId)!;
          const c = customers.get(o.customerId)!;
          const open = expanded === d.id;
          if (current && d.id === current.id) return null;
          return (
            <Card key={d.id} className={cn("gap-0 overflow-hidden", d.status === "Delivered" && "opacity-70")}>
              <button type="button" onClick={() => setExpanded(open ? null : d.id)} className="flex items-center gap-3 p-3 text-left cursor-pointer" aria-expanded={open}>
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", d.status === "Delivered" ? "bg-success text-white" : "bg-muted")}>{d.status === "Delivered" ? <CheckCircle2 className="size-4" /> : d.stopSeq}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {areaName(c.areaId)} · {d.status === "Delivered" ? `delivered ${fmtTime(d.completedAt!)}` : `ETA ${fmtTime(d.eta)}`}
                  </div>
                </div>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="border-t p-3">
                  <StopBody d={d} />
                </div>
              )}
            </Card>
          );
        })}

        {m.pos.length > 0 && (
          <>
            <div className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Backhaul pickups</div>
            {[...m.pos].sort((a, b) => (a.pickupEta ?? "").localeCompare(b.pickupEta ?? "")).map((p) => {
              const s = supplierById(p.supplierId);
              const picked = ["Picked Up", "Received", "Partially Received"].includes(p.status);
              return (
                <Card key={p.id} className="gap-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-2">
                      <CornerDownLeft className="mt-0.5 size-4 text-[var(--chart-3)]" />
                      <div>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.pickupLocation} · {p.pickupEta ? `ETA ${fmtTime(p.pickupEta)}` : ""}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={p.status} icon={false} />
                  </div>
                  <ul className="text-sm">
                    {p.items.map((i) => (
                      <li key={i.productId} className="flex justify-between">
                        <span>{productById(i.productId).name.split(" / ")[0]}</span>
                        <span className="tabular">{qty(i.quantity, productById(i.productId).unit)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" asChild>
                      <a href={`tel:${s.phone.replace(/\s/g, "")}`}>
                        <Phone /> Call {s.contactPerson.split(" ")[0]}
                      </a>
                    </Button>
                    <Button
                      disabled={picked || !started}
                      onClick={() => {
                        setPO(p.id, "Picked Up");
                        toast.success(`${p.id} loaded`, { description: "Procurement notified." });
                      }}
                    >
                      <Package /> {picked ? "Loaded" : "Mark picked up"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </>
        )}

        <Card className="flex-row items-center gap-3 p-3 text-sm">
          <Warehouse className="size-5 text-primary" />
          <div>
            <div className="font-medium">Return to Lucena Main Warehouse</div>
            <div className="text-xs text-muted-foreground">Expected {fmtTime(trip.expectedReturn)} · unload return cargo at Bay 2</div>
          </div>
        </Card>
      </div>
      {podFor && <PodDialog d={podFor} onClose={() => setPodFor(null)} />}
    </>
  );
}

function StopBody({ d }: { d: Delivery }) {
  const order = useAppStore((s) => s.orders.find((o) => o.id === d.orderId))!;
  const c = useCustomerMap().get(order.customerId)!;
  const addr = c.addresses.find((a) => a.id === order.addressId) ?? c.addresses[0];
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          {addr.line1}, {addr.barangay}, {addr.city}
          {addr.landmark && <div className="text-xs text-muted-foreground">Landmark: {addr.landmark}</div>}
          <div className="text-xs text-muted-foreground">Receiving {order.deliveryWindow}</div>
        </div>
      </div>
      <div className="rounded-lg bg-muted/60 p-2.5">
        <div className="mb-1 text-xs font-medium text-muted-foreground">Cargo · {order.id}</div>
        {order.items.map((i) => (
          <div key={i.productId} className="flex justify-between text-[15px]">
            <span>
              {productById(i.productId).localName} <span className="text-xs text-muted-foreground">{productById(i.productId).variant?.split(/[,(]/)[0]}</span>
            </span>
            <b className="tabular">{qty(i.quantity, productById(i.productId).unit)}</b>
          </div>
        ))}
      </div>
      {order.paymentTerms === "COD" && d.status !== "Delivered" && (
        <div className="rounded-lg border border-[oklch(0.85_0.08_85)] bg-warning-soft p-2.5 text-sm">
          Collect COD: <b className="tabular">{peso(orderBilledAmount(order))}</b>
        </div>
      )}
      {order.notes && <div className="text-xs text-muted-foreground">Note: {order.notes}</div>}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        Contact: {c.contacts[0].name} · {c.contacts[0].phone}
      </div>
    </div>
  );
}

function StopCard({ d, highlight, onArrive, onPod }: { d: Delivery; highlight?: boolean; onArrive: () => void; onPod: () => void }) {
  const order = useAppStore((s) => s.orders.find((o) => o.id === d.orderId))!;
  const c = useCustomerMap().get(order.customerId)!;
  return (
    <Card className={cn("gap-3 p-4", highlight && "border-primary ring-2 ring-primary/15")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold tracking-wide text-primary uppercase">Stop {d.stopSeq} · next</div>
          <div className="text-lg font-semibold leading-tight">{c.name}</div>
          <div className="text-sm text-muted-foreground">
            {areaName(c.areaId)} · ETA {fmtTime(d.eta)}
          </div>
        </div>
        <StatusBadge status={d.status} />
      </div>
      <StopBody d={d} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="lg" asChild>
          <a href={`tel:${c.contacts[0].phone.replace(/\s/g, "")}`}>
            <Phone /> Call Customer
          </a>
        </Button>
        <Button variant="outline" size="lg" onClick={() => toast("Navigation opens Waze / Google Maps in the live app", { description: `${c.addresses[0].line1}, ${c.addresses[0].city}` })}>
          <Navigation /> Navigate
        </Button>
        <Button variant="secondary" size="lg" onClick={onArrive} disabled={d.status === "Arrived"}>
          <MapPin /> {d.status === "Arrived" ? "Arrived" : "Mark Arrived"}
        </Button>
        <Button size="lg" onClick={onPod}>
          <Upload /> Upload POD
        </Button>
      </div>
      <Button size="xl" variant="success" onClick={onPod}>
        <CheckCircle2 /> Mark Delivered
      </Button>
    </Card>
  );
}

function PodDialog({ d, onClose }: { d: Delivery; onClose: () => void }) {
  const order = useAppStore((s) => s.orders.find((o) => o.id === d.orderId))!;
  const markDelivered = useAppStore((s) => s.markDelivered);
  const c = useCustomerMap().get(order.customerId)!;
  const [receivedBy, setReceivedBy] = React.useState(c.contacts[0].name);
  const [photos, setPhotos] = React.useState(0);
  const [signed, setSigned] = React.useState(false);
  const [cod, setCod] = React.useState(order.paymentTerms === "COD");
  const [err, setErr] = React.useState<string>();
  const amount = orderBilledAmount(order);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Proof of delivery</DialogTitle>
          <DialogDescription>
            {c.name} · {order.id}
          </DialogDescription>
        </DialogHeader>
        <Field label="Received by" htmlFor="pod-by" required>
          <Input id="pod-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
        </Field>
        <div className="grid gap-2">
          <div className="text-[13px] font-medium">Photos of goods & signed DR</div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: photos }).map((_, i) => (
              <div key={i} className="flex size-16 items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-100 text-xs text-slate-500">
                IMG {i + 1}
              </div>
            ))}
            <button type="button" onClick={() => setPhotos((p) => Math.min(4, p + 1))} className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted cursor-pointer">
              <Camera className="size-5" /> Add
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setSigned(true)} className={cn("flex h-24 items-center justify-center rounded-md border border-dashed text-sm cursor-pointer", signed ? "bg-muted/50" : "text-muted-foreground hover:bg-muted")}>
          {signed ? (
            <svg viewBox="0 0 160 50" className="h-14 text-slate-700" aria-label="Signature captured">
              <path d="M10 30 C 25 5, 35 45, 50 25 S 75 10, 85 30 S 110 40, 120 20 S 140 25, 150 28" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          ) : (
            "Tap for customer signature"
          )}
        </button>
        {order.paymentTerms === "COD" && (
          <label className="flex items-center gap-2 rounded-md bg-warning-soft p-3 text-sm">
            <Checkbox checked={cod} onCheckedChange={(v) => setCod(!!v)} /> Collected COD <b className="tabular">{peso(amount)}</b> in cash
          </label>
        )}
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() => {
              if (receivedBy.trim().length < 2) return setErr("Enter who received the goods.");
              if (!photos) return setErr("Add at least one POD photo.");
              if (!signed) return setErr("Capture the customer's signature.");
              markDelivered(d.id, { receivedBy: receivedBy.trim(), photoCount: photos }, cod ? amount : undefined);
              toast.success(`${order.id} delivered`, { description: cod ? `${peso(amount)} COD recorded · POD uploaded` : "POD uploaded · invoice issued" });
              onClose();
            }}
          >
            <CheckCircle2 /> Confirm delivered
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
