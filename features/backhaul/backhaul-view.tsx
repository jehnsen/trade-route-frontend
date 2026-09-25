"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, CornerDownLeft, Lightbulb, MapPin, PackagePlus, Truck, Undo2, Wallet, Gauge } from "lucide-react";
import type { PurchaseOrder, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useStock, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { routeById, returnLegName, areaName } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { productById, productLabel } from "@/data/products";
import { SUPPLIER_QUOTES, supplierById } from "@/data/suppliers";
import { poLoadKg, poTotal } from "@/lib/calc";
import { poSummary } from "@/lib/domain";
import { fmtDateShort, fmtDay, kg, num, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CapacityBar, KPICard, PageHeader, SectionTitle, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { Columns, SERIES } from "@/components/charts/charts";

const round50 = (n: number) => Math.round(n / 50) * 50;

interface Suggestion {
  key: string;
  kind: "capacity" | "assign" | "buy";
  text: React.ReactNode;
  detail?: string;
  action?: { label: string; run: () => void };
}

export function BackhaulView() {
  const trips = useAppStore((s) => s.trips);
  const pos = useAppStore((s) => s.purchaseOrders);
  const assignPO = useAppStore((s) => s.assignPOToTrip);
  const createPO = useAppStore((s) => s.createPO);
  const metrics = useTripMetrics();
  const stock = useStock();

  const active = trips.filter((t) => (t.date === TODAY || t.date === TOMORROW) && t.status !== "Completed").sort((a, b) => a.departure.localeCompare(b.departure));
  const todayTrips = active.filter((t) => t.date === TODAY);
  const unused = (t: Trip) => metrics.get(t.id)!.capacityKg - metrics.get(t.id)!.returnLoadKg;
  const openPOs = pos.filter((p) => !p.tripId && !p.deliveredBySupplier && ["Draft", "Sent", "Confirmed", "Ready for Pickup"].includes(p.status));

  const resale = (p: PurchaseOrder) => sumBy(p.items, (i) => i.quantity * productById(i.productId).wholesalePrice);

  // ── Rule-based suggestions ────────────────────────────────────────────────
  const suggestions: Suggestion[] = [];
  const remaining = new Map(active.map((t) => [t.id, unused(t)]));
  for (const t of active) {
    const u = unused(t);
    if (u >= 1000) suggestions.push({ key: `cap-${t.id}`, kind: "capacity", text: <><b>{truckById(t.truckId).code}</b> has <b>{kg(round50(u))}</b> unused return capacity on {t.id} ({returnLegName(routeById(t.routeId))}).</>, detail: `${fmtDay(t.date)} · return utilization ${pct(metrics.get(t.id)!.retUtil)}` });
  }
  for (const p of openPOs) {
    const load = poLoadKg(p);
    const fit = active.find((t) => routeById(t.routeId).returnAreas.includes(p.pickupAreaId) && (remaining.get(t.id) ?? 0) >= load && t.date >= p.pickupDate);
    if (fit) {
      remaining.set(fit.id, (remaining.get(fit.id) ?? 0) - load);
      suggestions.push({
        key: `po-${p.id}`,
        kind: "assign",
        text: <><b>{p.id}</b> for {kg(load)} {p.items.map((i) => productById(i.productId).name.toLowerCase()).join(" + ")} can be assigned to <b>{truckById(fit.truckId).code}</b> without exceeding capacity.</>,
        detail: `Pickup ${supplierById(p.supplierId).pickupLocation} is on the ${returnLegName(routeById(fit.routeId))} leg · ${kg((remaining.get(fit.id) ?? 0))} would remain`,
        action: { label: `Assign to ${truckById(fit.truckId).code}`, run: () => { assignPO(p.id, fit.id); toast.success(`${p.id} assigned to ${fit.id}`, { description: `${kg(load)} added to the return load.` }); } },
      });
    }
  }
  // Buy to cover backhaul shortages using quotes from suppliers on a return leg with room
  const backhaulShort = [...stock.values()].filter((s) => s.shortage > 0 && productById(s.productId).flow === "backhaul");
  for (const s of backhaulShort) {
    const quotes = SUPPLIER_QUOTES.filter((q) => q.productId === s.productId).sort((a, b) => a.quotedPrice - b.quotedPrice);
    for (const q of quotes) {
      const sup = supplierById(q.supplierId);
      const t = active.find((x) => routeById(x.routeId).returnAreas.includes(sup.pickupAreaId) && (remaining.get(x.id) ?? 0) >= s.shortage);
      if (!t) continue;
      const qtyNeed = Math.min(q.availableQty, round50(s.shortage + 100));
      remaining.set(t.id, (remaining.get(t.id) ?? 0) - qtyNeed);
      suggestions.push({
        key: `buy-${s.productId}`,
        kind: "buy",
        text: <>Buy <b>{kg(qtyNeed)} {productLabel(productById(s.productId)).toLowerCase()}</b> from <b>{sup.name}</b> at {peso(q.quotedPrice)}/kg — it&apos;s on {truckById(t.truckId).code}&apos;s return leg.</>,
        detail: `Covers a ${kg(s.shortage)} shortage vs confirmed orders · cheapest on-route quote`,
        action: {
          label: "Create PO on this trip",
          run: () => {
            const id = createPO({ supplierId: sup.id, items: [{ productId: s.productId, quantity: qtyNeed, unitCost: q.quotedPrice }], pickupDate: t.date, tripId: t.id, status: "Sent", notes: "Created from backhaul suggestion" });
            toast.success(`${id} created and assigned to ${t.id}`);
          },
        },
      });
      break;
    }
  }

  // ── History: return utilization per day ─────────────────────────────────
  const days = [...new Set(trips.filter((t) => t.status === "Completed").map((t) => t.date))].sort().slice(-12);
  const history = days.map((d) => {
    const row: Record<string, string | number> = { date: d };
    for (const tr of ["TRK-01", "TRK-02"]) {
      const t = trips.find((x) => x.date === d && x.truckId === tr);
      row[truckById(tr).code] = t ? Math.round(metrics.get(t.id)!.retUtil * 100) : 0;
    }
    return row;
  });
  const completed = trips.filter((t) => t.status === "Completed");
  const avgRet = completed.length ? sumBy(completed, (t) => metrics.get(t.id)!.retUtil) / completed.length : 0;

  return (
    <>
      <PageHeader
        title="Backhaul Intelligence"
        description="Every Manila → Lucena return leg is paid for already. Fill it with produce we can resell in Quezon."
        actions={
          <Button asChild>
            <Link href="/procurement">
              <PackagePlus /> Procurement
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Outbound trucks today" value={todayTrips.length} icon={Truck} hint={todayTrips.map((t) => `${truckById(t.truckId).code} ${pct(metrics.get(t.id)!.outUtil)} full`).join(" · ")} />
        <KPICard label="Available return capacity" value={kg(sumBy(todayTrips, unused))} icon={Undo2} tone="warning" hint="today's return legs" />
        <KPICard label="Current return procurement" value={kg(sumBy(todayTrips, (t) => metrics.get(t.id)!.returnLoadKg))} icon={CornerDownLeft} hint={`${pesoCompact(sumBy(todayTrips, (t) => metrics.get(t.id)!.procurementValue))} purchase value`} />
        <KPICard label="Return load resale value" value={pesoCompact(sumBy(todayTrips, (t) => sumBy(metrics.get(t.id)!.pos, resale)))} icon={Wallet} tone="success" hint="at wholesale prices in Lucena" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 md:grid-cols-2 xl:col-span-2">
          {active.map((t) => {
            const m = metrics.get(t.id)!;
            const route = routeById(t.routeId);
            return (
              <Card key={t.id} className="gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="size-2.5 rounded-full" style={{ background: truckById(t.truckId).color }} />
                      {truckById(t.truckId).code}
                      <span className="text-xs font-normal text-muted-foreground">· {fmtDay(t.date)}</span>
                    </div>
                    <Link href={`/trips/${t.id}`} className="text-xs text-primary hover:underline">
                      {t.id}
                    </Link>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="grid gap-1 text-sm">
                  <div className="text-xs text-muted-foreground">Outbound</div>
                  <div className="font-medium">{route.name}</div>
                  <CapacityBar used={m.outboundLoadKg} capacity={m.capacityKg} label="Outbound load" size="sm" />
                </div>
                <div className="grid gap-1 rounded-lg bg-accent/40 p-3 text-sm">
                  <div className="text-xs text-muted-foreground">Return</div>
                  <div className="font-medium">{returnLegName(route)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Planned</div>
                  {m.returnCargo.length ? (
                    <ul className="grid gap-0.5">
                      {m.returnCargo.map((c) => (
                        <li key={c.productId} className="flex justify-between">
                          <span>{productById(c.productId).name.split(" / ")[0]}</span>
                          <span className="tabular">{kg(c.quantity)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground">Nothing planned yet</div>
                  )}
                  <CapacityBar used={m.returnLoadKg} capacity={m.capacityKg} label="Return load" size="sm" className="mt-2" />
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Available return capacity</span>
                    <span className="text-base font-semibold tabular">{kg(m.capacityKg - m.returnLoadKg)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Loaded km</div>
                    <div className="font-medium tabular">{num(route.roundTripKm / 2 + (m.returnLoadKg ? route.roundTripKm / 2 : 0))}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Empty capacity</div>
                    <div className="font-medium tabular">{num(((m.capacityKg - m.returnLoadKg) / 1000) * (route.roundTripKm / 2))} t·km</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Backhaul value</div>
                    <div className="font-medium tabular">{pesoCompact(sumBy(m.pos, resale))}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="content-start">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-[oklch(0.65_0.14_75)]" /> Recommendations
              </CardTitle>
              <CardDescription>Rule-based: open POs on the return route, remaining payload, and today&apos;s supplier quotes. No AI involved.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {suggestions.length === 0 && <EmptyState title="Return legs are well used" description="No open backhaul opportunities right now." />}
            {suggestions.map((s) => (
              <div key={s.key} className="grid gap-2 rounded-lg border p-3">
                <div className="flex gap-2 text-sm">
                  {s.kind === "capacity" ? <Gauge className="mt-0.5 size-4 shrink-0 text-[oklch(0.6_0.14_65)]" /> : s.kind === "assign" ? <Truck className="mt-0.5 size-4 shrink-0 text-primary" /> : <PackagePlus className="mt-0.5 size-4 shrink-0 text-[var(--chart-3)]" />}
                  <p>{s.text}</p>
                </div>
                {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                {s.action && (
                  <Button size="sm" variant="outline" className="justify-self-start" onClick={s.action.run}>
                    {s.action.label} <ArrowRight />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Return utilization by day</CardTitle>
              <CardDescription>Last 12 operating days · average {pct(avgRet)} of configured payload</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns data={history} xKey="date" series={[{ key: "Truck 01", name: "Truck 01", color: SERIES[0] }, { key: "Truck 02", name: "Truck 02", color: SERIES[1] }]} valueFormat={(v) => `${v}%`} xFormat={fmtDateShort} labelFormat={fmtDateShort} height={240} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Unassigned backhaul POs</CardTitle>
              <CardDescription>Confirmed with suppliers, not yet on a truck</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {openPOs.length === 0 ? (
              <p className="text-sm text-muted-foreground">All backhaul POs are assigned to trips.</p>
            ) : (
              openPOs.map((p) => (
                <div key={p.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Link href={`/purchase-orders?po=${p.id}`} className="font-medium text-primary hover:underline">
                      {p.id}
                    </Link>
                    <StatusBadge status={p.status} />
                  </div>
                  <div>{supplierById(p.supplierId).name}</div>
                  <div className="text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline size-3" />
                    {areaName(p.pickupAreaId)} · {poSummary(p)} · {peso(poTotal(p))} · pickup {fmtDateShort(p.pickupDate)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      <SectionTitle className="mt-6">Why backhaul matters</SectionTitle>
      <p className="max-w-3xl text-sm text-muted-foreground">
        The diesel, tolls and crew for the return leg are spent whether the truck is full or empty. Every kilo of onion, garlic or luya hauled back to Lucena turns an empty-running cost into resale margin for the bodega and our Quezon buyers.
      </p>
    </>
  );
}
