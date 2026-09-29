"use client";

import * as React from "react";
import Link from "next/link";
import { MapPin, PackagePlus, Phone } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { SUPPLIERS, SUPPLIER_QUOTES } from "@/data/suppliers";
import { productById, productLabel } from "@/data/products";
import { ROUTES, areaName } from "@/data/areas";
import { poTotal } from "@/lib/calc";
import { poSummary } from "@/lib/domain";
import { fmtDate, fmtDateShort, fmtTime, kg, peso, pesoCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KPICard, PageHeader, Stat } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { RecordNotFound } from "@/components/shared/states";
import { Columns } from "@/components/charts/charts";
import { CreatePODialog } from "@/features/procurement/create-po-dialog";
import { ReliabilityBar, supplierStats } from "./suppliers-view";

export function SupplierDetail({ id }: { id: string }) {
  const s = SUPPLIERS.find((x) => x.id === id);
  const pos = useAppStore((st) => st.purchaseOrders);
  const [creating, setCreating] = React.useState(false);
  if (!s) return <RecordNotFound kind="Supplier" id={id} backHref="/suppliers" backLabel="Back to suppliers" />;
  const st = supplierStats(pos, id);
  const quotes = SUPPLIER_QUOTES.filter((q) => q.supplierId === id);
  const routes = ROUTES.filter((r) => r.returnAreas.includes(s.pickupAreaId));
  const recent = [...pos.filter((p) => p.supplierId === id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const weekly = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].map((w, i, arr) => ({
    week: `Wk ${fmtDateShort(w)}`,
    Purchases: st.pos.filter((p) => p.pickupDate >= w && p.pickupDate < (arr[i + 1] ?? "2026-09-28")).reduce((a, p) => a + poTotal(p), 0),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: s.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {s.name} <StatusBadge status={s.status} icon={false} />
          </span>
        }
        description={`${s.type} · ${s.address.city}, ${s.address.province} · supplier since ${fmtDate(s.since)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${s.phone.replace(/\s/g, "")}`}>
                <Phone /> Call {s.contactPerson.split(" ")[0]}
              </a>
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <PackagePlus /> Create PO
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Purchases (30 days)" value={pesoCompact(st.value)} hint={`${st.pos.length} POs`} />
        <KPICard label="Volume" value={kg(st.volumeKg)} />
        <KPICard label="Average price" value={st.avgPrice ? `${peso(st.avgPrice)}/kg` : "—"} />
        <KPICard label="Reliability" value={`${s.reliability}%`} hint="on-time & complete pickups" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Purchases per week</CardTitle>
            </CardHeader>
            <CardContent>
              <Columns data={weekly} xKey="week" series={[{ key: "Purchases", name: "Purchases" }]} height={200} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Purchase orders</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>PO</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.slice(0, 12).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/purchase-orders?po=${p.id}`}>
                        {p.id}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateShort(p.pickupDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{poSummary(p, 3)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.deliveredBySupplier ? "Supplier delivers" : "Our pickup"}</TableCell>
                    <TableCell className="text-right tabular">{peso(poTotal(p))}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact & pickup</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Stat label="Contact person" value={s.contactPerson} sub={s.phone} />
              <div className="flex gap-2">
                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div>{s.address.line1}</div>
                  <div className="text-muted-foreground">
                    {s.address.barangay}, {s.address.city}
                  </div>
                </div>
              </div>
              <Stat label="Pickup point" value={s.pickupLocation} sub={s.detourKm ? `${s.detourKm} km detour from route` : "Delivers to the Lucena bodega"} />
              <Stat label="Payment terms" value={s.paymentTerms} />
              <div>
                <div className="text-xs text-muted-foreground">Reliability</div>
                <ReliabilityBar value={s.reliability} />
              </div>
              {routes.length > 0 && <Stat label="On return legs of" value={routes.map((r) => r.name.replace("Lucena → ", "")).join("; ")} />}
              {s.notes && <p className="rounded-md bg-muted/60 p-3">{s.notes}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Products supplied</CardTitle>
                <CardDescription>Latest quotes (demo prices)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              {s.productIds.map((pid) => {
                const q = quotes.find((x) => x.productId === pid);
                return (
                  <div key={pid} className="flex items-center gap-2 text-sm">
                    <ProductImage product={productById(pid)} size="xs" />
                    <span className="flex-1">{productLabel(productById(pid))}</span>
                    {q ? (
                      <span className="text-xs tabular">
                        {peso(q.quotedPrice)}/kg · {kg(q.availableQty)} · {fmtTime(q.quotedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">~{peso(productById(pid).cost)}</span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <p className="px-1 text-xs text-muted-foreground">Pickup area: {areaName(s.pickupAreaId)}</p>
        </div>
      </div>
      <CreatePODialog open={creating} onOpenChange={setCreating} draft={{ supplierId: s.id }} />
    </>
  );
}
