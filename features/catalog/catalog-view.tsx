"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/types";
import { useStock } from "@/hooks/use-data";
import { PRODUCTS, productLabel } from "@/data/products";
import { peso, qty } from "@/lib/format";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-table/data-table";
import { DemoPriceNote, FilterBar, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { FilterSelect } from "@/features/orders/orders-view";

export function CatalogView({ initialQ }: { initialQ?: string }) {
  const stock = useStock();
  const [q, setQ] = React.useState(initialQ ?? "");
  const [cat, setCat] = React.useState("all");
  const [flow, setFlow] = React.useState("all");
  const data = PRODUCTS.filter((p) => (cat === "all" || p.category === cat) && (flow === "all" || p.flow === flow));

  const columns: ColumnDef<Product, unknown>[] = [
    { id: "img", header: () => <span className="sr-only">Image</span>, enableSorting: false, cell: ({ row }) => <ProductImage product={row.original} size="sm" /> },
    { id: "sku", header: "SKU", accessorFn: (p) => p.sku, cell: ({ getValue }) => <span className="font-mono text-xs whitespace-nowrap">{getValue() as string}</span> },
    { id: "name", header: "Product", accessorFn: (p) => productLabel(p), cell: ({ row }) => <div className="min-w-[180px]"><div className="font-medium">{row.original.name}</div><div className="text-xs text-muted-foreground">{row.original.variant} · {row.original.origin}</div></div> },
    { id: "cat", header: "Category", accessorFn: (p) => p.subcategory, cell: ({ row }) => <div className="whitespace-nowrap">{row.original.category === "seafood" ? "Seafood" : "Agricultural"}<div className="text-xs text-muted-foreground">{row.original.subcategory}</div></div> },
    { id: "unit", header: "Unit", accessorFn: (p) => p.unit, cell: ({ row }) => (row.original.unit === "pc" ? "per pc" : "per kg") },
    { id: "cost", header: "Cost", accessorFn: (p) => p.cost, meta: { align: "right" }, cell: ({ row }) => <span className="text-muted-foreground">{peso(row.original.cost)}</span> },
    { id: "sell", header: "Selling Price", accessorFn: (p) => p.sellingPrice, meta: { align: "right" }, cell: ({ row }) => peso(row.original.sellingPrice) },
    { id: "whole", header: "Wholesale Price", accessorFn: (p) => p.wholesalePrice, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.wholesalePrice)}</span> },
    { id: "stock", header: "Current Stock", accessorFn: (p) => stock.get(p.id)!.onHand, meta: { align: "right" }, cell: ({ row }) => qty(stock.get(row.original.id)!.onHand, row.original.unit) },
    { id: "avail", header: "Available", accessorFn: (p) => stock.get(p.id)!.available, meta: { align: "right" }, cell: ({ row }) => <b>{qty(stock.get(row.original.id)!.available, row.original.unit)}</b> },
    { id: "res", header: "Reserved", accessorFn: (p) => stock.get(p.id)!.reserved, meta: { align: "right" }, cell: ({ row }) => qty(stock.get(row.original.id)!.reserved, row.original.unit) },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge status={row.original.status} icon={false} /> },
    { id: "view", header: () => <span className="sr-only">Portal</span>, enableSorting: false, cell: ({ row }) => <Button variant="ghost" size="icon-sm" asChild aria-label="View on customer portal"><Link href={`/products/${row.original.slug}`} target="_blank"><ExternalLink /></Link></Button> },
  ];

  return (
    <>
      <PageHeader
        title="Products"
        description="30 SKUs of Quezon seafood, Quezon produce (outbound) and Manila / CALABARZON produce (backhaul)."
        actions={
          <Button variant="outline" onClick={() => { downloadCsv("freshroute-price-list.csv", [["SKU", "Product", "Variant", "Unit", "Wholesale", "Selling", "MOQ"], ...PRODUCTS.map((p) => [p.sku, p.name, p.variant ?? "", p.unit, p.wholesalePrice, p.sellingPrice, p.moq])]); toast.success("Price list exported"); }}>
            <Download /> Export price list
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search SKU, product, Tagalog name…">
          <FilterSelect value={cat} onChange={setCat} label="Category" options={[{ value: "all", label: "All categories" }, { value: "seafood", label: "Seafood" }, { value: "produce", label: "Agricultural produce" }]} />
          <FilterSelect value={flow} onChange={setFlow} label="Flow" options={[{ value: "all", label: "Outbound & backhaul" }, { value: "outbound", label: "Outbound (Quezon → Manila)" }, { value: "backhaul", label: "Backhaul (Manila → Lucena)" }]} className="w-full sm:w-60" />
        </FilterBar>
        <DataTable
          columns={columns}
          data={data}
          search={q}
          searchText={(p) => `${p.sku} ${p.name} ${p.localName ?? ""} ${p.variant ?? ""} ${p.origin}`}
          pageSize={30}
          renderCard={(p) => (
            <div className="flex gap-3">
              <ProductImage product={p} size="md" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{productLabel(p)}</div>
                <div className="text-xs text-muted-foreground">{p.sku} · {p.origin}</div>
                <div className="mt-1 flex justify-between text-sm"><span>Wholesale {peso(p.wholesalePrice)}/{p.unit}</span><span className="text-muted-foreground">Avail {qty(stock.get(p.id)!.available, p.unit)}</span></div>
              </div>
            </div>
          )}
        />
        <div className="border-t px-4 py-3">
          <DemoPriceNote />
        </div>
      </Card>
    </>
  );
}
