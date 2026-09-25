"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Info, PackagePlus, ShoppingBasket, Star, Truck, Undo2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useStock, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { PRODUCTS, productById, productLabel } from "@/data/products";
import { SUPPLIER_QUOTES, supplierById } from "@/data/suppliers";
import { routeById } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { poTotal } from "@/lib/calc";
import { fmtDateShort, fmtTime, kg, peso, pesoCompact, qty } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Tip } from "@/components/ui/overlays";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DemoPriceNote, KPICard, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { CreatePODialog, type PODraft } from "./create-po-dialog";

/** ₱ per km of detour for a loaded 10-wheeler (diesel + time) — used for landed-cost comparison. */
const DETOUR_COST_PER_KM = 55;

export function ProcurementView() {
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const pos = useAppStore((s) => s.purchaseOrders);
  const stock = useStock();
  const metrics = useTripMetrics();
  const [dialog, setDialog] = React.useState<PODraft | null>(null);
  const [product, setProduct] = React.useState("P-ONR");

  // Expected walk-in/bodega demand for the next 2 days = average daily pickup volume over the last 14 days × 2
  const expected = React.useMemo(() => {
    const m = new Map<string, number>();
    const since = "2026-09-11";
    for (const o of orders) {
      if (o.fulfillment !== "pickup" || o.deliveryDate < since || o.deliveryDate >= TODAY || o.status === "Cancelled") continue;
      for (const i of o.items) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity);
    }
    for (const [k, v] of m) m.set(k, Math.round(((v / 12) * 2) / 10) * 10);
    return m;
  }, [orders]);

  const reqRows = PRODUCTS.map((p) => {
    const s = stock.get(p.id)!;
    const confirmed = s.demand;
    const exp = p.flow === "backhaul" ? expected.get(p.id) ?? 0 : 0;
    const required = confirmed + exp;
    const available = Math.max(0, s.onHand - s.damaged);
    const need = Math.max(0, required - available - s.incoming);
    return { p, confirmed, exp, required, available, incoming: s.incoming, need };
  })
    .filter((r) => r.required > 0)
    .sort((a, b) => b.need - a.need || b.required - a.required);

  const backhaulReq = reqRows.filter((r) => r.p.flow === "backhaul");
  const localReq = reqRows.filter((r) => r.p.flow === "outbound");

  const upcomingTrips = trips.filter((t) => (t.date === TODAY || t.date === TOMORROW) && t.status !== "Completed");
  const quotes = SUPPLIER_QUOTES.filter((q) => q.productId === product);
  const scored = quotes
    .map((q) => {
      const sup = supplierById(q.supplierId);
      const onRoute = upcomingTrips.filter((t) => routeById(t.routeId).returnAreas.includes(sup.pickupAreaId));
      const lastPO = pos.filter((p) => p.supplierId === sup.id && p.items.some((i) => i.productId === product) && p.status !== "Cancelled" && p.status !== "Draft").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const lastPrice = lastPO?.items.find((i) => i.productId === product)?.unitCost;
      const need = reqRows.find((r) => r.p.id === product)?.need || 1000;
      const buyQty = Math.min(q.availableQty, Math.max(need, 500));
      const detourPerKg = (sup.detourKm * 2 * DETOUR_COST_PER_KM) / buyQty;
      const riskPerKg = ((100 - sup.reliability) / 100) * q.quotedPrice * 0.5;
      const landed = q.quotedPrice + detourPerKg + riskPerKg + (onRoute.length ? 0 : 6);
      return { q, sup, onRoute, lastPO, lastPrice, landed, detourPerKg, riskPerKg };
    })
    .sort((a, b) => a.landed - b.landed);
  const best = scored[0];

  const openPOs = pos.filter((p) => ["Draft", "Sent", "Confirmed", "Ready for Pickup"].includes(p.status)).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  const quoteProducts = [...new Set(SUPPLIER_QUOTES.map((q) => q.productId))];

  return (
    <>
      <PageHeader
        title="Procurement"
        description="What we need to buy, from whom, and on which return trip — derived from confirmed orders, standing orders, stock and expected bodega demand."
        actions={
          <Button onClick={() => setDialog({})}>
            <PackagePlus /> Create Purchase Order
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Products to procure" value={reqRows.filter((r) => r.need > 0).length} icon={ShoppingBasket} tone="warning" hint={`${kg(sumBy(reqRows, (r) => r.need * r.p.unitWeightKg))} total shortfall`} />
        <KPICard label="Open purchase orders" value={openPOs.length} icon={ClipboardList} hint={pesoCompact(sumBy(openPOs, poTotal))} href="/purchase-orders" />
        <KPICard label="Backhaul capacity free" value={kg(sumBy(upcomingTrips, (t) => metrics.get(t.id)!.capacityKg - metrics.get(t.id)!.returnLoadKg))} icon={Undo2} hint="today + tomorrow return legs" href="/backhaul" />
        <KPICard label="Quotes received today" value={SUPPLIER_QUOTES.filter((q) => q.quotedAt.startsWith(TODAY)).length} icon={CheckCircle2} hint={`from ${new Set(SUPPLIER_QUOTES.map((q) => q.supplierId)).size} suppliers`} />
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <RequirementCard title="Backhaul produce (buy on the Manila / Laguna return leg)" rows={backhaulReq} onBuy={(r) => setDialog({ productId: r.p.id, quantity: Math.ceil(r.need / 50) * 50 })} showExpected />
        <RequirementCard title="Quezon seafood & produce (local suppliers deliver to bodega)" rows={localReq} onBuy={(r) => setDialog({ productId: r.p.id, quantity: Math.ceil(r.need / 10) * 10 })} />
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-col sm:flex-row">
          <div>
            <CardTitle>Supplier comparison</CardTitle>
            <CardDescription>Today&apos;s quotes, ranked by landed cost = quoted price + detour from the truck route + reliability risk.</CardDescription>
          </div>
          <Tabs value={product} onValueChange={setProduct}>
            <TabsList>
              {quoteProducts.map((pid) => (
                <TabsTrigger key={pid} value={pid}>
                  {productById(pid).name.split(" / ")[0]}
                  {productById(pid).variant?.startsWith("Native") && pid === "P-GAR-N" ? " (native)" : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Supplier</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Available qty</TableHead>
              <TableHead className="text-right">Quoted price</TableHead>
              <TableHead>Pickup location</TableHead>
              <TableHead>Distance from route</TableHead>
              <TableHead>Reliability</TableHead>
              <TableHead>Last purchase</TableHead>
              <TableHead className="text-right">Landed cost</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {scored.map((r) => (
              <TableRow key={r.q.id} className={cn(r === best && "bg-success-soft/40")}>
                <TableCell>
                  <Link href={`/suppliers/${r.sup.id}`} className="font-medium hover:underline">
                    {r.sup.name}
                  </Link>
                  {r === best && (
                    <Badge variant="success" className="ml-2">
                      <Star /> Recommended
                    </Badge>
                  )}
                  <div className="text-xs text-muted-foreground">Quoted {fmtTime(r.q.quotedAt)} · valid until {fmtDateShort(r.q.validUntil)}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{productLabel(productById(r.q.productId))}</TableCell>
                <TableCell className="text-right tabular">{kg(r.q.availableQty)}</TableCell>
                <TableCell className="text-right font-medium tabular">{peso(r.q.quotedPrice)}/kg</TableCell>
                <TableCell className="text-muted-foreground">{r.sup.pickupLocation}</TableCell>
                <TableCell>
                  {r.onRoute.length ? (
                    <span className="text-xs">
                      <span className="font-medium">{r.sup.detourKm} km detour</span>
                      <div className="text-muted-foreground">on {r.onRoute.map((t) => truckById(t.truckId).code).join(", ")} return</div>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not on a scheduled return leg</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 rounded-full bg-muted">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${r.sup.reliability}%` }} />
                    </div>
                    <span className="text-xs tabular">{r.sup.reliability}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{r.lastPO ? <>{fmtDateShort(r.lastPO.createdAt)} · {peso(r.lastPrice ?? 0)}/kg</> : <span className="text-muted-foreground">No history</span>}</TableCell>
                <TableCell className="text-right">
                  <Tip content={`${peso(r.q.quotedPrice)} quote + ${peso(r.detourPerKg, true)} detour + ${peso(r.riskPerKg, true)} reliability risk${r.onRoute.length ? "" : " + ₱6 off-route pickup"} per kg`}>
                    <span className="inline-flex cursor-help items-center gap-1 font-semibold tabular">
                      {peso(r.landed, true)} <Info className="size-3 text-muted-foreground" />
                    </span>
                  </Tip>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant={r === best ? "default" : "outline"} onClick={() => setDialog({ supplierId: r.sup.id, productId: r.q.productId, unitCost: r.q.quotedPrice, quantity: Math.min(r.q.availableQty, Math.ceil((reqRows.find((x) => x.p.id === product)?.need || 500) / 50) * 50), tripId: r.onRoute[0]?.id })}>
                    Create PO
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-5 py-3">
          <DemoPriceNote />
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Open purchase orders</CardTitle>
            <CardDescription>Waiting for pickup or supplier delivery</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/purchase-orders">All POs</Link>
          </Button>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>PO</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Products</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Trip</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openPOs.slice(0, 12).map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/purchase-orders?po=${p.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">
                    {p.id}
                  </Link>
                </TableCell>
                <TableCell>{supplierById(p.supplierId).name}</TableCell>
                <TableCell className="text-muted-foreground">{p.items.map((i) => `${productById(i.productId).localName} ${qty(i.quantity, productById(i.productId).unit)}`).join(", ")}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">
                  {fmtDateShort(p.pickupDate)}
                  <div className="text-muted-foreground">{p.deliveredBySupplier ? "Supplier delivers" : p.pickupLocation}</div>
                </TableCell>
                <TableCell className="text-xs">
                  {p.tripId ? (
                    <Link href={`/trips/${p.tripId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Truck className="size-3.5" /> {p.tripId}
                    </Link>
                  ) : p.deliveredBySupplier ? (
                    "—"
                  ) : (
                    <span className="text-[oklch(0.55_0.13_65)]">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular">{peso(poTotal(p))}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {dialog && <CreatePODialog open onOpenChange={(v) => !v && setDialog(null)} draft={dialog} />}
    </>
  );
}

type ReqRow = { p: ReturnType<typeof productById>; confirmed: number; exp: number; required: number; available: number; incoming: number; need: number };

function RequirementCard({ title, rows, onBuy, showExpected }: { title: string; rows: ReqRow[]; onBuy: (r: ReqRow) => void; showExpected?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Required = confirmed orders{showExpected ? " + expected bodega sales (2 days)" : ""} · Need = required − available − incoming</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Required</TableHead>
            <TableHead className="text-right">Available</TableHead>
            <TableHead className="text-right">Incoming</TableHead>
            <TableHead className="text-right">Need to procure</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.p.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ProductImage product={r.p} size="xs" />
                  <div>
                    <div className="font-medium whitespace-nowrap">{productLabel(r.p)}</div>
                    {showExpected && r.exp > 0 && <div className="text-[11px] text-muted-foreground">{qty(r.confirmed, r.p.unit)} orders + {qty(r.exp, r.p.unit)} expected</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular">{qty(r.required, r.p.unit)}</TableCell>
              <TableCell className="text-right whitespace-nowrap tabular">{qty(r.available, r.p.unit)}</TableCell>
              <TableCell className="text-right whitespace-nowrap tabular text-muted-foreground">{qty(r.incoming, r.p.unit)}</TableCell>
              <TableCell className={cn("text-right font-semibold whitespace-nowrap tabular", r.need > 0 ? "text-danger" : "text-[oklch(0.45_0.13_150)]")}>{r.need > 0 ? qty(r.need, r.p.unit) : "Covered"}</TableCell>
              <TableCell className="text-right">
                {r.need > 0 && (
                  <Button size="sm" variant="outline" onClick={() => onBuy(r)}>
                    Buy
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
