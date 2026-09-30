"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO, subDays } from "date-fns";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight, BarChart3, Building2, CalendarDays, CheckCircle2, Handshake, PackagePlus, Plus, Route as RouteIcon, Truck, Undo2 } from "lucide-react";
import type { LogisticsJob, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useBoardMatches, useCapacityViews, useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, returnLegName, routeById } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { canAddReturnCargo, jobTotal, type TripMetrics } from "@/lib/logistics";
import { isGoodMatch } from "@/lib/load-board";
import { fmtDateShort, fmtDay, kg, num, peso, pct, pesoCompact } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Columns } from "@/components/charts/charts";
import { EmptyState, PageHeader } from "@/components/shared/common";
import { BackhaulMetric, ReturnLegCard } from "./backhaul-panels";

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
  const [date, setDate] = useState(TODAY);
  const [view, setView] = useState("operations");
  const periodStart = format(subDays(parseISO(TODAY), 30), "yyyy-MM-dd");
  const periodEnd = format(subDays(parseISO(TODAY), 1), "yyyy-MM-dd");
  const current = trips.filter((t) => t.date === date && t.status !== "Cancelled").sort((a, b) => a.departure.localeCompare(b.departure));
  const done = trips.filter((t) => t.status === "Completed" && t.date >= periodStart && t.date < TODAY);
  const opportunities = findOpportunities(jobs, current, metrics);
  const boardViews = useCapacityViews();
  const { byCapacity } = useBoardMatches();
  const boardFits = new Set(
    [...byCapacity.entries()]
      .filter(([capId]) => {
        const v = boardViews.get(capId);
        return v?.post.fleet === "internal" && v.post.leg === "return" && v.trip?.date === date;
      })
      .flatMap(([, ms]) => ms.filter(isGoodMatch).map((m) => m.loadId)),
  );
  const selectedMetrics = current.map((t) => metrics.get(t.id)!);
  const unused = sumBy(selectedMetrics, (m) => Math.max(0, m.capacityKg - m.returnKg));
  const avgRet = done.length ? sumBy(done, (t) => metrics.get(t.id)!.retUtil) / done.length : 0;
  const historicFreight = sumBy(done, (t) => sumBy(metrics.get(t.id)!.jobs.filter((j) => j.leg === "return"), jobTotal));
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
    <div className="backhaul-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><Undo2 className="size-3.5" /> Return operations</div>
      <PageHeader
        title="Backhaul"
        description="Make room for more on the way home. Plan cargo and manage every return leg."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/loads"><Plus /> Add company cargo</Link></Button>
            <Button asChild><Link href="/load-board?tab=capacity"><ArrowLeftRight /> Find return loads</Link></Button>
          </>
        }
      />
      <Tabs value={view} onValueChange={setView}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <TabsList className="backhaul-view-tabs h-auto gap-1 bg-transparent p-0" aria-label="Backhaul view">
            <TabsTrigger value="operations" className="px-3 py-2"><Truck /> Return trips</TabsTrigger>
            <TabsTrigger value="performance" className="px-3 py-2"><BarChart3 /> Performance</TabsTrigger>
          </TabsList>
          {view === "operations" ? (
            <div className="flex items-center gap-2">
              <CalendarDays className="hidden size-4 text-muted-foreground sm:block" />
              <div role="group" aria-label="Return trip date" className="backhaul-dates flex rounded-lg border bg-card p-1">
                {[TODAY, TOMORROW].map((d) => (
                  <button key={d} type="button" aria-pressed={date === d} onClick={() => setDate(d)} className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors">
                    {d === TODAY ? "Today" : "Tomorrow"}<span className="ml-1.5 font-normal opacity-75">{fmtDateShort(d)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : <span className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-3.5" />{fmtDateShort(periodStart)} – {fmtDateShort(periodEnd)} · Last 30 days</span>}
        </div>

        <TabsContent value="operations" className="space-y-5">
          <div className="backhaul-summary grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4" role="region" aria-label={`Return summary for ${fmtDay(date)}`}>
            <BackhaulMetric label="Available return space" value={kg(unused)} icon={Undo2} hint={`Across ${current.length} trips · ${date === TODAY ? "today" : "tomorrow"}`} featured />
            <BackhaulMetric label="Return utilization" value={pct(sumBy(selectedMetrics, (m) => m.returnKg) / Math.max(1, sumBy(selectedMetrics, (m) => m.capacityKg)))} icon={RouteIcon} hint={`30-day average ${pct(avgRet)}`} />
            <BackhaulMetric label="Paid backhaul freight" value={pesoCompact(sumBy(selectedMetrics, (m) => sumBy(m.jobs.filter((j) => j.leg === "return"), jobTotal)))} icon={Handshake} hint="Customer & third-party freight" />
            <BackhaulMetric label="Company cargo value" value={pesoCompact(sumBy(selectedMetrics, (m) => m.companyCargoValue))} icon={Building2} hint="Purchase value, not freight revenue" />
          </div>

          {(opportunities.length > 0 || boardFits.size > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/15 bg-accent/50 px-4 py-3">
              <div className="flex items-center gap-2.5 text-xs"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><PackagePlus className="size-4" /></span><div><div className="font-semibold">Fill the return leg</div><div className="mt-0.5 text-[11px] text-muted-foreground">{opportunities.length > 0 ? `${opportunities.length} unassigned jobs fit your trucks.` : "Find cargo for your available return space."}{boardFits.size > 0 && ` ${boardFits.size} matching loads on the Load Board.`}</div></div></div>
              <div className="flex flex-wrap items-center gap-2">
                {opportunities.length > 0 && <Button size="sm" variant="ghost" asChild><a href="#backhaul-matches">Review jobs <ArrowRight /></a></Button>}
                {boardFits.size > 0 && <Button size="sm" variant="outline" asChild><Link href="/load-board">Browse matches <ArrowRight /></Link></Button>}
              </div>
            </div>
          )}

          <section aria-label="Scheduled return trips">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">Return schedule <span className="backhaul-count">{current.length} trips</span></h2>
              <span className="text-[11px] text-muted-foreground">{fmtDay(date)} · Returning to Lucena</span>
            </div>
            {current.length === 0 ? <EmptyState icon={Truck} title="No return trips scheduled" description={`There are no trips for ${fmtDay(date)}. Plan one in Dispatch to start assigning return cargo.`} className="bg-card" action={<Button asChild><Link href="/dispatch">Open Dispatch <ArrowRight /></Link></Button>} /> : (
              <div className="backhaul-trip-grid grid gap-4">{current.map((t) => <ReturnLegCard key={t.id} trip={t} m={metrics.get(t.id)!} />)}</div>
            )}
          </section>

          {opportunities.length > 0 && (
            <section id="backhaul-matches" aria-labelledby="backhaul-matches-heading" className="scroll-mt-24">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="backhaul-matches-heading" className="flex items-center gap-2 text-sm font-semibold">Ready to assign <span className="backhaul-count">{opportunities.length} jobs</span></h2><span className="text-[11px] text-muted-foreground">Pickup route & available payload</span></div>
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {opportunities.map((o) => {
                    const truck = truckById(o.trip.truckId);
                    return (
                      <li key={o.job.id} className="backhaul-match grid items-center gap-3 p-4 sm:px-5">
                        <div className="min-w-0">
                          <Link href={`/jobs/${o.job.id}`} className="text-[13px] font-semibold hover:text-primary hover:underline">{customers.get(o.job.customerId)?.name}</Link>
                          <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{o.job.cargoDescription}</div>
                          <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{o.job.id} · {o.job.pickup.name} → {o.job.dropoff.name}</div>
                        </div>
                        <div className="text-xs"><div className="font-semibold tabular">{kg(o.job.weightKg)} <span className="ml-2 font-normal text-muted-foreground">{peso(jobTotal(o.job))}</span></div><div className="mt-1 text-[11px] text-muted-foreground">{o.onRoute ? `${areaName(o.job.pickup.areaId)} · on route` : "Off route · review pickup"}</div><div className="mt-1 text-[11px] text-primary">{kg(o.freeAfter)} free after assignment</div></div>
                        <Button size="sm" className="justify-self-start text-xs sm:justify-self-end" onClick={() => {
                          assign(o.job.id, o.trip.id);
                          toast.success(`${o.job.id} added to ${truck.code}'s return leg`, { description: `${o.trip.id} · ${kg(o.freeAfter)} return capacity left` });
                        }}><CheckCircle2 /> Assign to {truck.code}</Button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">Capacity uses gross cargo weight against each truck’s configured payload. Expand a cargo manifest to see individual loads.</p>
        </TabsContent>

        <TabsContent value="performance" className="space-y-5">
          <div className="backhaul-summary grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
            <BackhaulMetric label="Paid return freight" value={pesoCompact(historicFreight)} hint="Across completed trips · last 30 days" icon={Handshake} featured />
            <BackhaulMetric label="Average return fill" value={pct(avgRet)} hint="Average utilization per completed trip" icon={RouteIcon} />
            <BackhaulMetric label="Completed trips" value={done.length} hint="Last 30 completed calendar days" icon={CheckCircle2} />
            <BackhaulMetric label="Company cargo value" value={pesoCompact(sumBy(done, (t) => metrics.get(t.id)!.companyCargoValue))} hint="Purchase value, not freight revenue" icon={Building2} />
          </div>
          {done.length === 0 ? <EmptyState icon={BarChart3} title="No completed trips in this period" description="Return capacity and lane performance will appear once trips are completed." className="bg-card" /> : (
      <div className="grid items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Return capacity by day</CardTitle>
              <CardDescription>Paid cargo, company cargo and unused payload · tonnes per day</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Columns
              data={trend}
              xKey="date"
              stacked
              height={320}
              valueFormat={(v) => `${num(v / 1000)}t`}
              xFormat={(d) => fmtDateShort(d)}
              labelFormat={(d) => fmtDay(d)}
              series={[
                { key: "paid", name: "Paid backhaul", color: "var(--chart-1)" },
                { key: "company", name: "Company-owned", color: "var(--chart-3)" },
                { key: "empty", name: "Empty capacity", color: "var(--chart-grid)" },
              ]}
            />
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
              {[
                { label: "Paid cargo", value: sumBy(trend, (d) => d.paid) },
                { label: "Company cargo", value: sumBy(trend, (d) => d.company) },
                { label: "Unused space", value: sumBy(trend, (d) => d.empty) },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 text-sm font-semibold tabular">{num(item.value / 1000)} t</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Lane performance</CardTitle>
              <CardDescription>Compare fill rates and paid freight by return route</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Return lane performance">
              <table className="ops-table w-full text-xs"><caption className="sr-only">Return lane performance for the last 30 completed calendar days</caption>
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
                      <tr key={r.label} className="border-b transition-colors last:border-0 hover:bg-muted/30">
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
