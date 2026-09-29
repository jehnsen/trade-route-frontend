"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Plus, Truck } from "lucide-react";
import type { POStatus, PurchaseOrder } from "@/types";
import { useAppStore } from "@/lib/store";
import { supplierById } from "@/data/suppliers";
import { productById, productLabel } from "@/data/products";
import { poKg, poTotal } from "@/lib/calc";
import { poSummary } from "@/lib/domain";
import { fmtDate, fmtDateShort, fmtDateTime, fmtTime, kg, peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, Separator } from "@/components/ui/primitives";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, PageHeader, Stat, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { CreatePODialog } from "./create-po-dialog";

const NEXT: Partial<Record<POStatus, { label: string; to: POStatus }>> = {
  Draft: { label: "Send to supplier", to: "Sent" },
  Sent: { label: "Mark confirmed", to: "Confirmed" },
  Confirmed: { label: "Mark ready for pickup", to: "Ready for Pickup" },
  "Ready for Pickup": { label: "Mark picked up", to: "Picked Up" },
  "Picked Up": { label: "Receive at bodega", to: "Received" },
};

const TABS: { value: string; label: string; statuses: POStatus[] }[] = [
  { value: "open", label: "Open", statuses: ["Draft", "Sent", "Confirmed", "Ready for Pickup", "Picked Up"] },
  { value: "received", label: "Received", statuses: ["Received", "Partially Received"] },
  { value: "cancelled", label: "Cancelled", statuses: ["Cancelled"] },
  { value: "all", label: "All", statuses: ["Draft", "Sent", "Confirmed", "Ready for Pickup", "Picked Up", "Partially Received", "Received", "Cancelled"] },
];

export function PurchaseOrdersView({ initialPo }: { initialPo?: string }) {
  const pos = useAppStore((s) => s.purchaseOrders);
  const [tab, setTab] = React.useState(initialPo ? "all" : "open");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<string | undefined>(initialPo);
  const [creating, setCreating] = React.useState(false);
  const statuses = TABS.find((t) => t.value === tab)!.statuses;
  const data = pos.filter((p) => statuses.includes(p.status));
  const sel = pos.find((p) => p.id === selected);

  const columns: ColumnDef<PurchaseOrder, unknown>[] = [
    { id: "id", header: "PO Number", accessorFn: (p) => p.id, cell: ({ row }) => <span className="font-medium whitespace-nowrap text-primary">{row.original.id}</span> },
    { id: "sup", header: "Supplier", accessorFn: (p) => supplierById(p.supplierId).name, cell: ({ row }) => <div className="min-w-[180px]"><div className="font-medium">{supplierById(row.original.supplierId).name}</div><div className="text-xs text-muted-foreground">{supplierById(row.original.supplierId).type}</div></div> },
    { id: "prod", header: "Products", enableSorting: false, cell: ({ row }) => <span className="block max-w-[220px] truncate text-muted-foreground">{poSummary(row.original, 3)}</span> },
    { id: "qty", header: "Total Qty", accessorFn: (p) => poKg(p), meta: { align: "right" }, cell: ({ row }) => kg(poKg(row.original)) },
    { id: "val", header: "Value", accessorFn: (p) => poTotal(p), meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(poTotal(row.original))}</span> },
    { id: "pickup", header: "Pickup Location", accessorFn: (p) => p.pickupLocation, cell: ({ row }) => <div className="whitespace-nowrap">{row.original.deliveredBySupplier ? "Supplier delivers to bodega" : row.original.pickupLocation}<div className="text-xs text-muted-foreground">{fmtDateShort(row.original.pickupDate)}{row.original.pickupEta ? ` · ${fmtTime(row.original.pickupEta)}` : ""}</div></div> },
    { id: "collect", header: "Collection", accessorFn: (p) => (p.deliveredBySupplier ? "supplier" : "pickup"), cell: ({ row }) => <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">{row.original.deliveredBySupplier ? "Supplier delivers" : <><Truck className="size-3.5" /> Our pickup</>}</span> },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Seafood bought from Quezon suppliers and produce picked up on backhaul return legs."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Create Purchase Order
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label} <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{pos.filter((p) => t.statuses.includes(p.status)).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search PO, supplier, product, trip…" />
        <DataTable
          columns={columns}
          data={data}
          search={q}
          searchText={(p) => `${p.id} ${supplierById(p.supplierId).name} ${poSummary(p, 9)} ${p.pickupLocation}`}
          initialSorting={[{ id: "id", desc: true }]}
          onRowClick={(p) => setSelected(p.id)}
          rowClassName={(p) => (p.id === selected ? "bg-accent/50" : undefined)}
          empty={<EmptyState title="No purchase orders in this tab." />}
          renderCard={(p) => (
            <div className="grid gap-1">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-primary">{p.id}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="text-sm font-medium">{supplierById(p.supplierId).name}</div>
              <div className="text-xs text-muted-foreground">{poSummary(p)} · {peso(poTotal(p))}</div>
            </div>
          )}
        />
      </Card>
      <Sheet open={!!sel} onOpenChange={(v) => !v && setSelected(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{sel && <PODetail po={sel} />}</SheetContent>
      </Sheet>
      <CreatePODialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function PODetail({ po }: { po: PurchaseOrder }) {
  const setStatus = useAppStore((s) => s.setPOStatus);
  const sup = supplierById(po.supplierId);
  const next = NEXT[po.status];
  return (
    <div className="grid gap-4 p-5">
      <div>
        <SheetTitle className="flex items-center gap-2">
          {po.id} <StatusBadge status={po.status} />
        </SheetTitle>
        <SheetDescription>
          Created {fmtDateTime(po.createdAt)} by {po.createdBy}
        </SheetDescription>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Supplier" value={<Link className="text-primary hover:underline" href={`/suppliers/${sup.id}`}>{sup.name}</Link>} sub={`${sup.contactPerson} · ${sup.phone}`} />
        <Stat label="Payment terms" value={sup.paymentTerms} />
        <Stat label="Pickup" value={po.deliveredBySupplier ? "Supplier delivers" : po.pickupLocation} sub={`${fmtDate(po.pickupDate)}${po.pickupEta ? ` · ${fmtTime(po.pickupEta)}` : ""}`} />
        <Stat label="Collection" value={po.deliveredBySupplier ? "Supplier delivers to bodega" : "Picked up by our truck"} sub={po.deliveredBySupplier ? undefined : "Hauled as company-owned cargo (Loads)"} />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {po.items.map((i) => {
            const p = productById(i.productId);
            return (
              <TableRow key={i.productId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ProductImage product={p} size="xs" />
                    {productLabel(p)}
                  </div>
                  {i.receivedQty !== undefined && i.receivedQty !== i.quantity && <div className="text-xs text-[oklch(0.55_0.13_65)]">Received {qty(i.receivedQty, p.unit)}</div>}
                </TableCell>
                <TableCell className="text-right tabular">{qty(i.quantity, p.unit)}</TableCell>
                <TableCell className="text-right tabular">{peso(i.unitCost)}</TableCell>
                <TableCell className="text-right tabular">{peso(i.quantity * i.unitCost)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex justify-between text-sm font-semibold">
        <span>Total · {kg(poKg(po))}</span>
        <span className="tabular">{peso(poTotal(po))}</span>
      </div>
      {po.notes && <p className="rounded-md bg-muted/60 p-3 text-sm">{po.notes}</p>}
      <Separator />
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button onClick={() => { setStatus(po.id, next.to); toast.success(`${po.id}: ${next.to}`); }}>
            {next.label}
          </Button>
        )}
        {!["Received", "Partially Received", "Cancelled", "Picked Up"].includes(po.status) && (
          <Button variant="outline" className="text-destructive" onClick={() => { setStatus(po.id, "Cancelled"); toast(`${po.id} cancelled`); }}>
            Cancel PO
          </Button>
        )}
        {!po.deliveredBySupplier && po.status !== "Cancelled" && po.status !== "Received" && (
          <Button variant="outline" asChild>
            <Link href="/loads">Add as company cargo on a trip</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
