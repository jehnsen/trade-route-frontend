"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, CornerDownLeft, Flag, MapPin, PackagePlus, Play, Plus, Printer, Truck, UserRound, Warehouse } from "lucide-react";
import type { TripStop } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { buildTripStops, type CargoLine } from "@/lib/selectors";
import { routeById, returnLegName, areaName } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { helperById } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { supplierById } from "@/data/suppliers";
import { orderTotal, poTotal } from "@/lib/calc";
import { orderSummary, poSummary } from "@/lib/domain";
import { fmtDay, fmtTime, kg, num, peso, pct, qty } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CapacityBar, EmptyState, PageHeader, Stat } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { PodCard } from "@/components/shared/pod";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecordNotFound } from "@/components/shared/states";
import { AddExpenseDialog } from "@/features/finance/add-expense-dialog";

const EXPENSE_GROUPS: { label: string; cats: string[] }[] = [
  { label: "Fuel", cats: ["Diesel"] },
  { label: "Tolls", cats: ["Toll"] },
  { label: "Meals / allowances", cats: ["Meals", "Driver Allowance", "Helper Allowance"] },
  { label: "Loading & unloading", cats: ["Loading Fee", "Unloading Fee", "Parking"] },
  { label: "Ice & packaging", cats: ["Ice", "Packaging"] },
  { label: "Other expenses", cats: ["Maintenance", "Repairs", "Port / Shipping Fee", "Miscellaneous"] },
];

export function TripDetail({ id }: { id: string }) {
  const trip = useAppStore((s) => s.trips.find((t) => t.id === id));
  const customers = useAppStore((s) => s.customers);
  const setTripStatus = useAppStore((s) => s.setTripStatus);
  const custMap = useCustomerMap();
  const m = useTripMetrics().get(id);
  const [addingExpense, setAddingExpense] = React.useState(false);

  if (!trip || !m) return <RecordNotFound kind="Trip" id={id} backHref="/trips" backLabel="Back to trips" />;

  const route = routeById(trip.routeId);
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const stops = buildTripStops(trip, m, customers);
  const legKm = route.roundTripKm / 2;
  const loadedKm = legKm + (m.returnLoadKg > 0 ? legKm : 0);
  const emptyCapacityKm = Math.round(((m.capacityKg - m.returnLoadKg) / 1000) * legKm);
  const backhaulResale = sumBy(m.pos, (p) => sumBy(p.items, (i) => i.quantity * productById(i.productId).wholesalePrice));
  const pods = m.deliveries.filter((d) => d.pod);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Trips", href: "/trips" }, { label: trip.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {trip.id} <StatusBadge status={trip.status} />
          </span>
        }
        description={`${fmtDay(trip.date)} · ${truck.code} (${truck.plateNo}) · ${driver.name}`}
        actions={
          <>
            {(trip.status === "Planned" || trip.status === "Loading") && (
              <ConfirmDialog
                trigger={
                  <Button size="sm">
                    <Play /> Dispatch — truck departed
                  </Button>
                }
                title={`Dispatch ${trip.id}?`}
                description={`${m.orders.length} orders (${kg(m.outboundLoadKg)}) will be marked Out for Delivery and customers can be notified.`}
                confirmLabel="Mark departed"
                onConfirm={() => {
                  setTripStatus(trip.id, "In Transit");
                  toast.success(`${truck.code} departed Lucena`, { description: `${trip.id} is now in transit.` });
                }}
              />
            )}
            {(trip.status === "In Transit" || trip.status === "Returning") && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <Flag /> Mark returned to Lucena
                  </Button>
                }
                title="Close this trip?"
                description="Use this once the truck is back at the bodega and the return load has been received."
                confirmLabel="Complete trip"
                onConfirm={() => {
                  setTripStatus(trip.id, "Completed");
                  toast.success(`${trip.id} completed`);
                }}
              />
            )}
            <Button size="sm" variant="outline" onClick={() => setAddingExpense(true)}>
              <Plus /> Add expense
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/dispatch">
                <PackagePlus /> Assign orders
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              <Printer /> Print manifest
            </Button>
          </>
        }
      />
      {trip.notes && <div className="mb-4 rounded-lg border border-[oklch(0.85_0.08_85)] bg-warning-soft px-4 py-2.5 text-sm">{trip.notes}</div>}

      {/* Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Route</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Outbound</div>
                <div className="font-medium">{route.name}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <CornerDownLeft className="mt-0.5 size-4 text-[var(--chart-3)]" />
              <div>
                <div className="text-xs text-muted-foreground">Return (backhaul)</div>
                <div className="font-medium">{returnLegName(route)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Departure" value={fmtTime(trip.actualDeparture ?? trip.departure)} sub={trip.actualDeparture ? `planned ${fmtTime(trip.departure)}` : "planned"} />
              <Stat label={trip.actualReturn ? "Returned" : "Expected return"} value={fmtTime(trip.actualReturn ?? trip.expectedReturn)} />
              <Stat label="Round trip" value={`${route.roundTripKm} km`} sub={`${num(loadedKm)} loaded km`} />
              <Stat label="Odometer" value={trip.odometerStart ? `${num(trip.odometerStart)} km` : "—"} sub={trip.odometerEnd ? `end ${num(trip.odometerEnd)} km` : undefined} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Truck & crew</CardTitle>
            <Link href={`/trucks/${truck.id}`} className="text-xs font-medium text-primary hover:underline">
              Truck profile
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <Truck className="size-5" />
              </span>
              <div>
                <div className="font-medium">
                  {truck.code} · {truck.plateNo}
                </div>
                <div className="text-xs text-muted-foreground">{truck.name}</div>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <Link href={`/drivers/${driver.id}`} className="font-medium hover:underline">
                  {driver.name}
                </Link>
                <div className="text-xs text-muted-foreground">Driver · {driver.phone}</div>
              </div>
            </div>
            {trip.helperIds.map((h) => (
              <div key={h} className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div>{helperById(h)?.name}</div>
                  <div className="text-xs text-muted-foreground">Helper · {helperById(h)?.phone}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Load & capacity</CardTitle>
              <CardDescription>Configured payload {kg(m.capacityKg)} · loads incl. ice & packaging</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            <CapacityBar used={m.outboundLoadKg} capacity={m.capacityKg} label="Outbound" />
            <CapacityBar used={m.returnLoadKg} capacity={m.capacityKg} label="Return" />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Unused return capacity" value={kg(m.capacityKg - m.returnLoadKg)} className={m.retUtil < 0.6 ? "[&>div:nth-child(2)]:text-[oklch(0.55_0.13_65)]" : ""} />
              <Stat label="Empty capacity-km" value={`${num(emptyCapacityKm)} t·km`} sub="on the return leg" />
            </div>
            {m.retUtil < 0.6 && trip.status !== "Completed" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/backhaul">Find backhaul for {kg(m.capacityKg - m.returnLoadKg)}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Stops</CardTitle>
              <CardDescription>
                {m.deliveries.length} drops · {m.pos.length} backhaul pickups · {m.delivered} delivered
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-0">
              {stops.map((s, i) => (
                <StopRow key={i} stop={s} last={i === stops.length - 1} detail={s.orderId ? orderSummary(m.orders.find((o) => o.id === s.orderId)!) : s.poId ? poSummary(m.pos.find((p) => p.id === s.poId)!) : undefined} />
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Trip financials</CardTitle>
              <CardDescription>Contribution = revenue − product cost − trip expenses</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Line label="Revenue (outbound orders)" value={peso(m.revenue)} strong />
            <Line label="Product cost (COGS)" value={`−${peso(m.cogs)}`} />
            <div className="mt-1 text-xs font-medium text-muted-foreground">Trip expenses</div>
            {EXPENSE_GROUPS.map((g) => {
              const v = sumBy(m.expenses.filter((e) => g.cats.includes(e.category)), (e) => e.amount);
              return v ? <Line key={g.label} label={g.label} value={`−${peso(v)}`} muted /> : null;
            })}
            <Line label="Total trip cost" value={`−${peso(m.tripCost)}`} />
            <Separator className="my-1" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Estimated contribution</span>
              <span className="text-xl font-semibold text-[oklch(0.45_0.13_150)] tabular">{peso(m.contribution)}</span>
            </div>
            <div className="text-xs text-muted-foreground">Contribution margin {pct(m.revenue ? m.contribution / m.revenue : 0, 1)} · cost per loaded km {peso(m.tripCost / Math.max(1, loadedKm))}</div>
            <Separator className="my-1" />
            <div className="text-xs font-medium text-muted-foreground">Backhaul (inventory, not trip revenue)</div>
            <Line label="Purchased on return leg" value={peso(m.procurementValue)} muted />
            <Line label="Expected resale value" value={peso(backhaulResale)} muted />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="outbound" className="mt-4">
        <TabsList>
          <TabsTrigger value="outbound">Outbound manifest</TabsTrigger>
          <TabsTrigger value="return">Return manifest</TabsTrigger>
          <TabsTrigger value="orders">Orders ({m.orders.length})</TabsTrigger>
          <TabsTrigger value="pickups">Procurement pickups ({m.pos.length})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses ({m.expenses.length})</TabsTrigger>
          <TabsTrigger value="pod">Proof of delivery ({pods.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="outbound">
          <Manifest lines={m.outboundCargo} capacity={m.capacityKg} empty="No outbound cargo assigned yet." />
        </TabsContent>
        <TabsContent value="return">
          <Manifest lines={m.returnCargo} capacity={m.capacityKg} empty="No backhaul purchase orders assigned to this trip." />
        </TabsContent>
        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Stop</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.deliveries.map((d) => {
                  const o = m.orders.find((x) => x.id === d.orderId);
                  if (!o) return null;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="tabular">{d.stopSeq}</TableCell>
                      <TableCell>
                        <Link href={`/orders/${o.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
                          {o.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{custMap.get(o.customerId)?.name}</div>
                        <div className="text-xs text-muted-foreground">{areaName(custMap.get(o.customerId)!.areaId)}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{orderSummary(o, 3)}</TableCell>
                      <TableCell className="text-right tabular">{peso(orderTotal(o))}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{o.paymentTerms}</TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pickups">
          {m.pos.length === 0 ? (
            <EmptyState title="No procurement pickups" description="Assign a backhaul PO from the Backhaul page to use the empty return capacity." action={<Button asChild size="sm"><Link href="/backhaul">Open Backhaul</Link></Button>} />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>PO</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Pickup location</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.pos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/purchase-orders?po=${p.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
                          {p.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/suppliers/${p.supplierId}`} className="hover:underline">
                          {supplierById(p.supplierId).name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.pickupLocation}</TableCell>
                      <TableCell className="text-muted-foreground">{poSummary(p, 3)}</TableCell>
                      <TableCell className="text-right tabular">{peso(poTotal(p))}</TableCell>
                      <TableCell className="tabular">{p.pickupEta ? fmtTime(p.pickupEta) : "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="expenses">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Paid to</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.category}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description}</TableCell>
                    <TableCell>{e.paidTo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.receiptRef}</TableCell>
                    <TableCell className="text-right tabular">{peso(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular">{peso(m.tripCost)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="pod">
          {pods.length === 0 ? (
            <EmptyState title="No proof of delivery yet" description="PODs appear here as the driver completes drops." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pods.map((d) => {
                const o = m.orders.find((x) => x.id === d.orderId)!;
                return <PodCard key={d.id} pod={d.pod!} title={custMap.get(o.customerId)?.name ?? ""} subtitle={`${o.id} · stop ${d.stopSeq}`} />;
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddExpenseDialog open={addingExpense} onOpenChange={setAddingExpense} tripId={trip.id} truckId={trip.truckId} />
    </>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className={cn("tabular", strong && "font-semibold")}>{value}</span>
    </div>
  );
}

function StopRow({ stop, last, detail }: { stop: TripStop; last: boolean; detail?: string }) {
  const Icon = stop.type === "delivery" ? MapPin : stop.type === "pickup" ? CornerDownLeft : stop.type === "depart" ? Warehouse : Flag;
  const href = stop.orderId ? `/orders/${stop.orderId}` : stop.poId ? `/purchase-orders?po=${stop.poId}` : undefined;
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className={cn("absolute top-8 left-[15px] h-[calc(100%-1.5rem)] w-0.5", stop.status === "done" ? "bg-primary/50" : "bg-border")} aria-hidden />}
      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
          stop.status === "done" && "border-primary bg-primary text-white",
          stop.status === "current" && "border-primary bg-card text-primary ring-4 ring-primary/15",
          stop.status === "pending" && "border-border bg-card text-muted-foreground",
          stop.type === "pickup" && stop.status !== "done" && "border-[var(--chart-3)] text-[var(--chart-3)]",
        )}
      >
        {stop.status === "done" && stop.type !== "depart" ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5 sm:grid-cols-[1fr_auto] sm:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{stop.type === "delivery" ? `Drop · ${areaName(stop.areaId)}` : stop.type === "pickup" ? `Backhaul pickup · ${areaName(stop.areaId)}` : stop.type === "depart" ? "Depart" : "Arrive"}</span>
            {stop.status === "current" && <span className="rounded bg-accent px-1.5 text-[11px] font-medium text-primary">Next</span>}
          </div>
          {href ? (
            <Link href={href} className="font-medium hover:underline">
              {stop.label}
            </Link>
          ) : (
            <div className="font-medium">{stop.label}</div>
          )}
          {detail && <div className="truncate text-xs text-muted-foreground">{detail}</div>}
        </div>
        <div className="text-xs tabular sm:text-right">
          {stop.actual ? (
            <span className="font-medium">{fmtTime(stop.actual)}</span>
          ) : (
            <span className="text-muted-foreground">ETA {fmtTime(stop.eta)}</span>
          )}
          {stop.actual && <div className="text-muted-foreground">ETA {fmtTime(stop.eta)}</div>}
        </div>
      </div>
    </li>
  );
}

function Manifest({ lines, capacity, empty }: { lines: CargoLine[]; capacity: number; empty: string }) {
  if (!lines.length) return <EmptyState title={empty} />;
  const totalLoad = sumBy(lines, (l) => l.loadKg);
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Net quantity</TableHead>
            <TableHead className="text-right">Load weight</TableHead>
            <TableHead className="w-48">Share of truck</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((l) => {
            const p = productById(l.productId);
            return (
              <TableRow key={l.productId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProductImage product={p} size="xs" />
                    {productLabel(p)}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular">{qty(l.quantity, p.unit)}</TableCell>
                <TableCell className="text-right tabular">{kg(l.loadKg)}</TableCell>
                <TableCell>
                  <CapacityBar used={l.loadKg} capacity={capacity} showNumbers={false} size="sm" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell />
            <TableCell className="text-right tabular">{kg(totalLoad)}</TableCell>
            <TableCell className="tabular">{pct(totalLoad / capacity)} of {kg(capacity)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}
