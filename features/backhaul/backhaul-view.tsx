"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, Building2, CheckCircle2, Handshake, Lightbulb, MapPin, Plus, Route as RouteIcon, Undo2 } from "lucide-react";
import type { LogisticsJob, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, returnLegName, routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { canAddReturnCargo, jobTotal, truckLocation, type TripMetrics } from "@/lib/logistics";
import { fmtDateShort, fmtDay, fmtTime, kg, num, peso, pct, pesoCompact } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Columns } from "@/components/charts/charts";
import { CapacityBar, EmptyState, KPICard, LineItem, PageHeader, SectionTitle } from "@/components/shared/common";
import { LoadTypeBadge, StatusBadge } from "@/components/shared/status-badge";

interface Opportunity {
  job: LogisticsJob;
  trip: Trip;
  onRoute: boolean;
  freeAfter: number;
}

/** Simple, explainable matching: pickup on the trip's return leg first, then any trip that still fits. */
function findOpportunities(jobs: LogisticsJob[], trips: Trip[], metrics: Map<string, TripMetrics>): Opportunity[] {
  const out: Opportunity[] = [];
  const open = jobs.filter((j) => j.leg === "return" && !j.tripId && (j.status === "Confirmed" || j.status === "Awaiting Dispatch"));
  for (const job of open) {
    const date = job.pickupAt.slice(0, 10);
    const candidates = trips
      .filter((t) => t.date === date && canAddReturnCargo(t))
      .map((t) => {
        const m = metrics.get(t.id)!;
        return { trip: t, onRoute: routeById(t.routeId).returnAreas.includes(job.pickup.areaId), freeAfter: m.capacityKg - m.returnKg - job.weightKg };
      })
      .filter((c) => c.freeAfter >= 0)
      .sort((a, b) => Number(b.onRoute) - Number(a.onRoute) || b.freeAfter - a.freeAfter);
    if (candidates[0]) out.push({ job, ...candidates[0] });
  }
  return out;
}

export function BackhaulView() {
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const assign = useAppStore((s) => s.assignJobToTrip);
  const metrics = useTripMetrics();
  const customers = useCustomerMap();

  const current = trips.filter((t) => (t.date === TODAY || t.date === TOMORROW) && t.status !== "Cancelled").sort((a, b) => a.departure.localeCompare(b.departure));
  const today = current.filter((t) => t.date === TODAY);
  const done = trips.filter((t) => t.status === "Completed");
  const opportunities = findOpportunities(jobs, trips, metrics);
  const todayM = today.map((t) => metrics.get(t.id)!);
  const unusedToday = sumBy(todayM, (m) => Math.max(0, m.capacityKg - m.returnKg));
  const avgRet = done.length ? sumBy(done, (t) => metrics.get(t.id)!.retUtil) / done.length : 0;

  const byDay = new Map<string, { date: string; paid: number; company: number; empty: number }>();
  for (const t of done) {
    const m = metrics.get(t.id)!;
    const r = byDay.get(t.date) ?? { date: t.date, paid: 0, company: 0, empty: 0 };
    r.paid += m.paidReturnKg;
    r.company += m.companyReturnKg;
    r.empty += Math.max(0, m.capacityKg - m.returnKg);
    byDay.set(t.date, r);
  }
  const trend = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  const lanes = new Map<string, { label: string; trips: number; util: number; paid: number; value: number; emptyKm: number }>();
  for (const t of done) {
    const m = metrics.get(t.id)!;
    const route = routeById(t.routeId);
    const key = route.returnAreas.join("+");
    const r = lanes.get(key) ?? { label: returnLegName(route), trips: 0, util: 0, paid: 0, value: 0, emptyKm: 0 };
    r.trips += 1;
    r.util += m.retUtil;
    r.paid += sumBy(m.jobs.filter((j) => j.leg === "return"), jobTotal);
    r.value += m.companyCargoValue;
    r.emptyKm += m.returnKg === 0 ? m.distanceKm / 2 : 0;
    lanes.set(key, r);
  }

  return (
    <>
      <PageHeader
        title="Backhaul"
        description="Every truck comes home to Lucena. Fill the return leg with paid third-party cargo, customer pickups or company-owned produce — no purchase order required."
        actions={
          <Button variant="outline" asChild>
            <Link href="/loads">
              <Plus /> Add company cargo
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Unused return capacity today" value={kg(unusedToday)} icon={Undo2} tone={unusedToday > 6000 ? "warning" : "success"} hint={`across ${today.length} trips`} />
        <KPICard label="Return utilization today" value={pct(sumBy(todayM, (m) => m.returnKg) / Math.max(1, sumBy(todayM, (m) => m.capacityKg)))} icon={RouteIcon} hint={`30-day average ${pct(avgRet)}`} />
        <KPICard label="Paid backhaul freight today" value={pesoCompact(sumBy(today, (t) => sumBy(metrics.get(t.id)!.jobs.filter((j) => j.leg === "return"), jobTotal)))} icon={Handshake} hint="third-party & backhaul jobs" />
        <KPICard label="Company cargo value today" value={pesoCompact(sumBy(todayM, (m) => m.companyCargoValue))} icon={Building2} hint="purchase value, not freight revenue" />
      </div>

      {opportunities.length > 0 && (
        <Card className="mb-4 border-primary/30 bg-accent/20">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" /> Backhaul matches
              </CardTitle>
              <CardDescription>Rule-based: pickup is on the trip&apos;s return leg and the load fits the configured payload</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {opportunities.map((o) => {
              const truck = truckById(o.trip.truckId);
              return (
                <div key={o.job.id} className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-sm">
                    <div>
                      <Link href={`/jobs/${o.job.id}`} className="font-semibold text-primary hover:underline">
                        {o.job.id}
                      </Link>{" "}
                      can be assigned to <b>{truck.code}</b> without exceeding configured payload capacity.
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {customers.get(o.job.customerId)?.name} · {o.job.cargoDescription} {kg(o.job.weightKg)} · {o.job.pickup.name} → {o.job.dropoff.name} · {peso(jobTotal(o.job))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded bg-muted px-1.5 py-0.5">{o.onRoute ? `Pickup in ${areaName(o.job.pickup.areaId)} is on the return leg` : "Small detour from the return leg"}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{kg(o.freeAfter)} still free after</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      assign(o.job.id, o.trip.id);
                      toast.success(`${o.job.id} added to ${truck.code}'s return leg`, { description: `${o.trip.id} · ${kg(o.freeAfter)} return capacity left` });
                    }}
                  >
                    <CheckCircle2 /> Assign to {truck.code}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <SectionTitle>Return legs — today & tomorrow</SectionTitle>
      {current.length === 0 ? (
        <EmptyState title="No trips scheduled today." className="mb-4 bg-card" />
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          {current.map((t) => (
            <ReturnLegCard key={t.id} trip={t} m={metrics.get(t.id)!} />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Return load, last 30 days</CardTitle>
              <CardDescription>Paid vs company-owned backhaul vs empty space (kg per day, completed trips)</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns
              data={trend}
              xKey="date"
              stacked
              valueFormat={(v) => `${num(v / 1000)}t`}
              xFormat={(d) => fmtDateShort(d)}
              labelFormat={(d) => fmtDay(d)}
              series={[
                { key: "paid", name: "Paid backhaul", color: "var(--chart-1)" },
                { key: "company", name: "Company-owned", color: "var(--chart-3)" },
                { key: "empty", name: "Empty capacity", color: "var(--chart-grid)" },
              ]}
            />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>By return lane</CardTitle>
              <CardDescription>Completed trips · 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium sm:px-5">Lane</th>
                    <th className="px-2 py-2 text-right font-medium">Trips</th>
                    <th className="px-2 py-2 text-right font-medium">Avg fill</th>
                    <th className="px-4 py-2 text-right font-medium sm:px-5">Paid freight</th>
                  </tr>
                </thead>
                <tbody>
                  {[...lanes.values()]
                    .sort((a, b) => b.trips - a.trips)
                    .map((r) => (
                      <tr key={r.label} className="border-b last:border-0">
                        <td className="px-4 py-2 sm:px-5">
                          <div className="font-medium">{r.label}</div>
                          <div className="text-xs text-muted-foreground">company cargo {pesoCompact(r.value)}</div>
                        </td>
                        <td className="px-2 py-2 text-right tabular">{r.trips}</td>
                        <td className="px-2 py-2 text-right tabular">{pct(r.util / r.trips)}</td>
                        <td className="px-4 py-2 text-right tabular sm:px-5">{pesoCompact(r.paid)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ReturnLegCard({ trip, m }: { trip: Trip; m: TripMetrics }) {
  const customers = useCustomerMap();
  const truck = truckById(trip.truckId);
  const route = routeById(trip.routeId);
  const loc = truckLocation(trip);
  const free = Math.max(0, m.capacityKg - m.returnKg);
  const paid = sumBy(m.jobs.filter((j) => j.leg === "return"), jobTotal);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: truck.color }} />
            {truck.code}
            <StatusBadge status={trip.status} className="text-[10px]" />
          </CardTitle>
          <CardDescription>
            <Link href={`/trips/${trip.id}`} className="hover:underline">
              {trip.id}
            </Link>{" "}
            · {fmtDay(trip.date)} · {driverById(trip.driverId).name}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/trips/${trip.id}`}>
            Trip <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <div className="text-xs text-muted-foreground">Current</div>
              <div className="font-medium">{loc.label.replace(/^(At|En route to) /, "")}</div>
              {loc.detail && <div className="text-xs text-muted-foreground">{loc.detail}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            <Undo2 className="mt-0.5 size-4 shrink-0 text-[oklch(0.45_0.14_300)]" />
            <div>
              <div className="text-xs text-muted-foreground">Returning</div>
              <div className="font-medium">{returnLegName(route)}</div>
              <div className="text-xs text-muted-foreground">ETA Lucena {fmtTime(trip.actualReturn ?? trip.expectedReturn)}</div>
            </div>
          </div>
        </div>
        <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return capacity used" />
        <ul className="grid gap-1.5">
          {m.returnLoads.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {l.cargoDescription.split(/[,(]/)[0]} — <span className="text-muted-foreground">{l.jobId ? customers.get(l.customerId ?? "")?.name : `from ${l.pickup.name}`}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <LoadTypeBadge type={l.type} />
                <span className="w-20 text-right font-medium tabular">{kg(l.weightKg)}</span>
              </span>
            </li>
          ))}
          {m.returnLoads.length === 0 && <li className="text-sm text-muted-foreground">Nothing planned for the return leg yet.</li>}
        </ul>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-sm">
          <LineItem label="Used" value={kg(m.returnKg)} />
          <LineItem label="Remaining" value={kg(free)} strong />
          <LineItem label="Return utilization" value={pct(m.retUtil)} />
          <LineItem label="Paid backhaul" value={peso(paid)} />
          <LineItem label="Company cargo value" value={peso(m.companyCargoValue)} muted className="col-span-2" />
        </div>
        {free >= 1000 && trip.status !== "Completed" && (
          <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-[oklch(0.42_0.1_65)]">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {truck.code} has <b>{kg(free)}</b> unused return capacity. Offer it to Quezon traders or add company produce from {route.returnAreas.map(areaName).join(" / ")}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
