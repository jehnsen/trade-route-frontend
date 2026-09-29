"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import type { PurchaseOrder, Supplier } from "@/types";
import { useAppStore } from "@/lib/store";
import { SUPPLIERS } from "@/data/suppliers";
import { productById } from "@/data/products";
import { poKg, poTotal } from "@/lib/calc";
import { fmtDateShort, kg, peso, pesoCompact, relativeDay } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Card } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/common";

export interface SupplierStats {
  pos: PurchaseOrder[];
  volumeKg: number;
  value: number;
  avgPrice: number;
  last?: string;
}

export function supplierStats(pos: PurchaseOrder[], supplierId: string): SupplierStats {
  const own = pos.filter((p) => p.supplierId === supplierId && p.status !== "Cancelled" && p.status !== "Draft");
  const volumeKg = sumBy(own, poKg);
  const value = sumBy(own, poTotal);
  return { pos: own, volumeKg, value, avgPrice: volumeKg ? value / volumeKg : 0, last: own.map((p) => p.createdAt).sort().pop() };
}

export function ReliabilityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full ${value >= 92 ? "bg-success" : value >= 86 ? "bg-primary" : "bg-warning"}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular">{value}%</span>
    </div>
  );
}

export function SuppliersView() {
  const router = useRouter();
  const pos = useAppStore((s) => s.purchaseOrders);
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const rows = SUPPLIERS.filter((s) => type === "all" || s.type === type).map((s) => ({ s, st: supplierStats(pos, s.id) }));

  const columns: ColumnDef<{ s: Supplier; st: SupplierStats }, unknown>[] = [
    { id: "name", header: "Supplier", accessorFn: (r) => r.s.name, cell: ({ row }) => <div className="min-w-[200px]"><Link href={`/suppliers/${row.original.s.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.s.name}</Link><div className="text-xs text-muted-foreground">{row.original.s.type}</div></div> },
    { id: "products", header: "Products", enableSorting: false, cell: ({ row }) => <span className="block max-w-[200px] truncate text-muted-foreground">{row.original.s.productIds.map((p) => productById(p).localName).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</span> },
    { id: "loc", header: "Location", accessorFn: (r) => r.s.address.city, cell: ({ row }) => <div className="whitespace-nowrap">{row.original.s.address.city}<div className="text-xs text-muted-foreground">{row.original.s.address.province}</div></div> },
    { id: "contact", header: "Contact", accessorFn: (r) => r.s.contactPerson, cell: ({ row }) => <div className="whitespace-nowrap">{row.original.s.contactPerson}<div className="text-xs text-muted-foreground tabular">{row.original.s.phone}</div></div> },
    { id: "vol", header: "Purchase Volume", accessorFn: (r) => r.st.volumeKg, meta: { align: "right" }, cell: ({ row }) => <div>{kg(row.original.st.volumeKg)}<div className="text-xs text-muted-foreground">{pesoCompact(row.original.st.value)}</div></div> },
    { id: "avg", header: "Average Price", accessorFn: (r) => r.st.avgPrice, meta: { align: "right" }, cell: ({ row }) => (row.original.st.avgPrice ? `${peso(row.original.st.avgPrice)}/kg` : "—") },
    { id: "rel", header: "Reliability", accessorFn: (r) => r.s.reliability, cell: ({ row }) => <ReliabilityBar value={row.original.s.reliability} /> },
    { id: "last", header: "Last Transaction", accessorFn: (r) => r.st.last ?? "", cell: ({ row }) => (row.original.st.last ? <span className="whitespace-nowrap">{relativeDay(row.original.st.last.slice(0, 10))}</span> : "—") },
    { id: "status", header: "Status", accessorFn: (r) => r.s.status, cell: ({ row }) => <StatusBadge status={row.original.s.status} icon={false} /> },
  ];
  return (
    <>
      <PageHeader title="Suppliers" description="Quezon seafood sources, farm suppliers and Manila / CALABARZON produce traders on our return routes." />
      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search supplier, product, location…">
          <FilterSelect value={type} onChange={setType} label="Type" options={[{ value: "all", label: "All types" }, ...["Seafood Source", "Farm Supplier", "Agricultural Trader", "Wholesale Market", "Distributor"].map((t) => ({ value: t, label: t }))]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={rows}
          search={q}
          searchText={(r) => `${r.s.name} ${r.s.type} ${r.s.address.city} ${r.s.pickupLocation} ${r.s.contactPerson} ${r.s.productIds.map((p) => productById(p).name).join(" ")}`}
          initialSorting={[{ id: "vol", desc: true }]}
          onRowClick={(r) => router.push(`/suppliers/${r.s.id}`)}
          renderCard={(r) => (
            <div className="grid gap-1">
              <div className="flex justify-between gap-2"><span className="font-medium">{r.s.name}</span><StatusBadge status={r.s.status} icon={false} /></div>
              <div className="text-xs text-muted-foreground">{r.s.type} · {r.s.address.city} · last {r.st.last ? fmtDateShort(r.st.last) : "—"}</div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
