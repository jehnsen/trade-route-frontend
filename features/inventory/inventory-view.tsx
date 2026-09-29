"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Boxes, PackageCheck, PackageMinus, PackagePlus, Wallet } from "lucide-react";
import type { InventoryLocation } from "@/types";
import { useAppStore } from "@/lib/store";
import { useStock } from "@/hooks/use-data";
import { NOW } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { supplierById } from "@/data/suppliers";
import { areaName } from "@/data/areas";
import { fmtDateShort, fmtTime, kg, peso, pesoCompact, qty } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, KPICard, PageHeader, EmptyState } from "@/components/shared/common";
import { ProductImage } from "@/components/shared/product-image";

interface BatchRow {
  id: string;
  productId: string;
  location: InventoryLocation;
  locationNote?: string;
  source: string;
  available: number;
  reserved: number;
  incoming: number;
  damaged: number;
  unitCost: number;
  receivedAt?: string;
  href?: string;
  status: "Fresh" | "Sell first" | "Aging" | "In transit" | "Incoming" | "Return load" | "Staged";
}

const LOCATIONS: InventoryLocation[] = ["Lucena Main Warehouse", "Truck 01", "Truck 02", "Temporary Manila Pickup", "Supplier Pickup"];

export function InventoryView() {
  const inventory = useAppStore((s) => s.inventory);
  const orders = useAppStore((s) => s.orders);
  const pos = useAppStore((s) => s.purchaseOrders);
  const stock = useStock();
  const [q, setQ] = React.useState("");
  const [loc, setLoc] = React.useState<string>("all");

  const rows: BatchRow[] = React.useMemo(() => {
    const out: BatchRow[] = [];
    // Allocate reservations FIFO across warehouse batches (oldest first)
    const remainingDemand = new Map([...stock.values()].map((s) => [s.productId, s.reserved]));
    const warehouse = inventory.filter((b) => b.location === "Lucena Main Warehouse").sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
    for (const b of warehouse) {
      const usable = b.onHand - b.damaged;
      const res = Math.min(usable, remainingDemand.get(b.productId) ?? 0);
      remainingDemand.set(b.productId, (remainingDemand.get(b.productId) ?? 0) - res);
      const p = productById(b.productId);
      const ageDays = (new Date(NOW).getTime() - new Date(b.receivedAt).getTime()) / 86400000;
      const life = ageDays / p.shelfLifeDays;
      out.push({ id: b.id, productId: b.productId, location: b.location, source: b.source, available: usable - res, reserved: res, incoming: 0, damaged: b.damaged, unitCost: b.unitCost, receivedAt: b.receivedAt, href: b.poId ? `/purchase-orders?po=${b.poId}` : undefined, status: life > 0.8 ? "Aging" : life > 0.5 ? "Sell first" : "Fresh" });
    }
    for (const b of inventory.filter((x) => x.location === "Temporary Manila Pickup")) {
      out.push({ id: b.id, productId: b.productId, location: b.location, locationNote: b.note, source: b.source, available: b.onHand, reserved: 0, incoming: 0, damaged: 0, unitCost: b.unitCost, receivedAt: b.receivedAt, status: "Staged" });
    }
    // Stock riding on a truck is tracked as company-owned cargo on the Loads board, not here.
    for (const o of orders.filter((x) => x.status === "Out for Delivery"))
      for (const i of o.items) out.push({ id: `${o.id}-${i.productId}`, productId: i.productId, location: "Lucena Main Warehouse", locationNote: `Out for delivery · ${o.id}`, source: "Released to customer delivery", available: 0, reserved: i.quantity, incoming: 0, damaged: 0, unitCost: productById(i.productId).cost, href: `/orders/${o.id}`, status: "In transit" });
    // Supplier pickups not yet collected (incoming on return legs) and supplier deliveries
    for (const p of pos.filter((x) => ["Sent", "Confirmed", "Ready for Pickup"].includes(x.status))) {
      for (const i of p.items)
        out.push({
          id: `${p.id}-${i.productId}`,
          productId: i.productId,
          location: "Supplier Pickup",
          locationNote: p.deliveredBySupplier ? "Supplier delivers to bodega" : `${areaName(p.pickupAreaId)} · pickup ${p.pickupEta ? fmtTime(p.pickupEta) : p.pickupDate}`,
          source: supplierById(p.supplierId).name,
          available: 0,
          reserved: 0,
          incoming: i.quantity,
          damaged: 0,
          unitCost: i.unitCost,
          href: `/purchase-orders?po=${p.id}`,
          status: "Incoming",
        });
    }
    return out;
  }, [inventory, orders, pos, stock]);

  const shown = rows.filter((r) => loc === "all" || r.location === loc);
  const all = [...stock.values()];
  const availableKg = sumBy(all, (s) => s.available * productById(s.productId).unitWeightKg);
  const reservedKg = sumBy(all, (s) => s.reserved * productById(s.productId).unitWeightKg);
  const incomingKg = sumBy(all, (s) => s.incoming * productById(s.productId).unitWeightKg);
  const damagedKg = sumBy(all, (s) => s.damaged);
  const value = sumBy(all, (s) => s.value);

  const columns: ColumnDef<BatchRow, unknown>[] = [
    { id: "product", header: "Product", accessorFn: (r) => productLabel(productById(r.productId)), cell: ({ row }) => <div className="flex items-center gap-2"><ProductImage product={productById(row.original.productId)} size="xs" /><span className="whitespace-nowrap font-medium">{productLabel(productById(row.original.productId))}</span></div> },
    { id: "batch", header: "Batch / lot", accessorFn: (r) => r.id, cell: ({ row }) => <div className="whitespace-nowrap"><div className="font-mono text-xs">{row.original.href ? <Link className="hover:underline" href={row.original.href}>{row.original.id}</Link> : row.original.id}</div><div className="max-w-[220px] truncate text-xs text-muted-foreground">{row.original.source}</div></div> },
    { id: "loc", header: "Location", accessorFn: (r) => r.location, cell: ({ row }) => <div className="whitespace-nowrap">{row.original.location}{row.original.locationNote && <div className="text-xs text-muted-foreground">{row.original.locationNote}</div>}</div> },
    { id: "available", header: "Available", accessorFn: (r) => r.available, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{row.original.available ? qty(row.original.available, productById(row.original.productId).unit) : "—"}</span> },
    { id: "reserved", header: "Reserved", accessorFn: (r) => r.reserved, meta: { align: "right" }, cell: ({ row }) => (row.original.reserved ? qty(row.original.reserved, productById(row.original.productId).unit) : "—") },
    { id: "incoming", header: "Incoming", accessorFn: (r) => r.incoming, meta: { align: "right" }, cell: ({ row }) => (row.original.incoming ? qty(row.original.incoming, productById(row.original.productId).unit) : "—") },
    { id: "damaged", header: "Damaged", accessorFn: (r) => r.damaged, meta: { align: "right" }, cell: ({ row }) => (row.original.damaged ? <span className="text-danger">{qty(row.original.damaged, productById(row.original.productId).unit)}</span> : "—") },
    { id: "cost", header: "Unit cost", accessorFn: (r) => r.unitCost, meta: { align: "right" }, cell: ({ row }) => peso(row.original.unitCost) },
    { id: "age", header: "Age", accessorFn: (r) => r.receivedAt ?? "", cell: ({ row }) => (row.original.receivedAt ? <span className="whitespace-nowrap text-xs">{ageLabel(row.original.receivedAt)}<div className="text-muted-foreground">{fmtDateShort(row.original.receivedAt)}</div></span> : "—") },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => <Badge variant={row.original.status === "Aging" ? "danger" : row.original.status === "Sell first" ? "warning" : row.original.status === "Fresh" ? "success" : row.original.status === "Incoming" || row.original.status === "Return load" ? "info" : "teal"}>{row.original.status}</Badge> },
  ];

  const products = all.filter((s) => s.onHand || s.demand || s.incoming || s.inTransit).sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader title="Inventory" description="Batch-level stock across the Lucena bodega, trucks and supplier pickups. Reservations follow confirmed orders, oldest batch first." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Available stock" value={kg(availableKg)} icon={PackageCheck} hint="unreserved, bodega" tone="success" />
        <KPICard label="Reserved for orders" value={kg(reservedKg)} icon={Boxes} hint="confirmed orders not yet loaded" />
        <KPICard label="Incoming" value={kg(incomingKg)} icon={PackagePlus} hint="open POs & backhaul pickups" href="/purchase-orders" />
        <KPICard label="Damaged / spoiled" value={kg(damagedKg)} icon={PackageMinus} tone={damagedKg ? "danger" : "default"} hint="set aside for markdown" />
        <KPICard label="Inventory value" value={pesoCompact(value)} icon={Wallet} hint="usable bodega stock at cost" />
      </div>
      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batches & lots</TabsTrigger>
          <TabsTrigger value="products">By product</TabsTrigger>
        </TabsList>
        <TabsContent value="batches">
          <Card className="overflow-hidden">
            <div className="flex gap-1 overflow-x-auto border-b px-4 py-2.5 scrollbar-thin">
              {["all", ...LOCATIONS].map((l) => {
                const n = rows.filter((r) => l === "all" || r.location === l).length;
                return (
                  <button key={l} type="button" onClick={() => setLoc(l)} className={`shrink-0 rounded-full border px-3 py-1 text-xs cursor-pointer ${loc === l ? "border-primary bg-accent font-medium text-primary" : "hover:bg-muted"}`}>
                    {l === "all" ? "All locations" : l} <span className="tabular text-muted-foreground">{n}</span>
                  </button>
                );
              })}
            </div>
            <FilterBar search={q} onSearch={setQ} placeholder="Search product, batch, supplier…" />
            <DataTable
              columns={columns}
              data={shown}
              search={q}
              searchText={(r) => `${r.id} ${productLabel(productById(r.productId))} ${productById(r.productId).name} ${r.source} ${r.location}`}
              pageSize={20}
              empty={loc === "Truck 02" ? <EmptyState title="Truck 02 is still loading" description="Stock stays in the Lucena bodega (reserved) until the truck departs at 9:00 AM." /> : <EmptyState title="No stock at this location." />}
              renderCard={(r) => (
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{productLabel(productById(r.productId))}</span>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.id} · {r.location}</div>
                  <div className="text-sm tabular">Avail {qty(r.available, productById(r.productId).unit)} · Res {qty(r.reserved, productById(r.productId).unit)} · In {qty(r.incoming, productById(r.productId).unit)}</div>
                </div>
              )}
            />
          </Card>
        </TabsContent>
        <TabsContent value="products">
          <Card className="overflow-hidden">
            <DataTable
              columns={[
                { id: "p", header: "Product", accessorFn: (s) => productLabel(productById(s.productId)), cell: ({ row }) => <div className="flex items-center gap-2"><ProductImage product={productById(row.original.productId)} size="xs" /><span className="font-medium">{productLabel(productById(row.original.productId))}</span></div> },
                { id: "on", header: "On hand", accessorFn: (s) => s.onHand, meta: { align: "right" }, cell: ({ row }) => qty(row.original.onHand, productById(row.original.productId).unit) },
                { id: "res", header: "Reserved", accessorFn: (s) => s.reserved, meta: { align: "right" }, cell: ({ row }) => qty(row.original.reserved, productById(row.original.productId).unit) },
                { id: "av", header: "Available", accessorFn: (s) => s.available, meta: { align: "right" }, cell: ({ row }) => <b>{qty(row.original.available, productById(row.original.productId).unit)}</b> },
                { id: "in", header: "Incoming", accessorFn: (s) => s.incoming, meta: { align: "right" }, cell: ({ row }) => qty(row.original.incoming, productById(row.original.productId).unit) },
                { id: "tr", header: "On trucks", accessorFn: (s) => s.inTransit, meta: { align: "right" }, cell: ({ row }) => qty(row.original.inTransit, productById(row.original.productId).unit) },
                { id: "val", header: "Value", accessorFn: (s) => s.value, meta: { align: "right" }, cell: ({ row }) => peso(row.original.value) },
                { id: "st", header: "Status", accessorFn: (s) => s.shortage, cell: ({ row }) => (row.original.shortage > 0 ? <Badge variant="danger"><AlertTriangle /> Short {qty(row.original.shortage, productById(row.original.productId).unit)}</Badge> : row.original.available === 0 && row.original.demand > 0 ? <Badge variant="warning">Fully reserved</Badge> : <Badge variant="success">OK</Badge>) },
              ]}
              data={products}
              pageSize={30}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ageLabel(receivedAt: string) {
  const hours = Math.max(0, Math.round((new Date(NOW).getTime() - new Date(receivedAt).getTime()) / 3600000));
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}
