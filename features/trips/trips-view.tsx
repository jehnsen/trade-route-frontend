"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ArrowRight, CalendarDays, Kanban, List, Route, Truck, Undo2, Wallet, X, type LucideIcon } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import type { Trip, TripStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { TRUCKS, truckById, driverById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { ACTIVE_TRIP_STATUSES, type TripMetrics } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, num, pct, pesoCompact, relativeDay } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { CapacityBar, EmptyState, FilterBar, FilterSelect, MoneyDisplay, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { TripScheduleCard } from "./trip-schedule-card";

interface Row {
  t: Trip;
  m: TripMetrics;
}

const STATUSES: TripStatus[] = ["Planned", "Loading", "Ready", "Dispatched", "In Transit", "Returning", "Completed", "Cancelled"];

export function TripsView() {
  const router = useRouter();
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [tab, setTab] = React.useState("active");
  const [truck, setTruck] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");

  const active = trips.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status) || (t.status === "Planned" && t.date <= TODAY));
  const upcoming = trips.filter((t) => t.status === "Planned" && t.date > TODAY);
  const history = trips.filter((t) => t.status === "Completed" || t.status === "Cancelled");
  const periodStart = format(subDays(parseISO(TODAY), 30), "yyyy-MM-dd");
  const done = trips.filter((t) => t.status === "Completed" && t.date >= periodStart && t.date < TODAY);
  const source = tab === "active" ? active : tab === "upcoming" ? upcoming : tab === "history" ? history : trips;
  const searchTerms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const rows: Row[] = source
    .filter((t) => (truck === "all" || t.truckId === truck) && (status === "all" || t.status === status))
    .filter((t) => {
      const haystack = `${t.id} ${tripRouteLine(t)} ${driverById(t.driverId).name} ${truckById(t.truckId).code} ${truckById(t.truckId).plateNo}`.toLowerCase();
      return searchTerms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => a.departure.localeCompare(b.departure))
    .map((t) => ({ t, m: metrics.get(t.id)! }));
  const avg = (f: (m: TripMetrics) => number) => (done.length ? sumBy(done, (t) => f(metrics.get(t.id)!)) / done.length : 0);
  const hasFilters = Boolean(q || truck !== "all" || status !== "all");
  const clearFilters = () => { setQ(""); setTruck("all"); setStatus("all"); };
  const views = [
    { value: "active", label: "Active trips", count: active.length, icon: Truck },
    { value: "upcoming", label: "Upcoming", count: upcoming.length, icon: CalendarDays },
    { value: "history", label: "History", count: history.length, icon: Archive },
    { value: "all", label: "All trips", count: trips.length, icon: List },
  ];
  const visibleStatuses = tab === "active" ? STATUSES.filter((s) => ACTIVE_TRIP_STATUSES.includes(s) || s === "Planned") : tab === "upcoming" ? ["Planned"] : tab === "history" ? ["Completed", "Cancelled"] : STATUSES;
  const tableView = tab === "history" || tab === "all";

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "id",
      header: "Trip",
      accessorFn: (r) => r.t.id,
      cell: ({ row }) => (
        <Link href={`/trips/${row.original.t.id}`} className="font-mono text-xs font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.t.id}
        </Link>
      ),
    },
    {
      id: "date",
      header: "Date",
      accessorFn: (r) => r.t.departure,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {fmtDay(row.original.t.date)}
          <div className="text-xs text-muted-foreground">{relativeDay(row.original.t.date)}</div>
        </div>
      ),
    },
    { id: "truck", header: "Truck / crew", accessorFn: (r) => truckById(r.t.truckId).code, cell: ({ row }) => <div className="whitespace-nowrap"><div className="font-medium">{truckById(row.original.t.truckId).code}</div><div className="mt-1 text-[11px] text-muted-foreground">{driverById(row.original.t.driverId).name}</div></div> },
    { id: "driver", header: "Driver", accessorFn: (r) => driverById(r.t.driverId).name, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "route", header: "Route", accessorFn: (r) => tripRouteLine(r.t), cell: ({ getValue }) => <span title={getValue() as string} className="block max-w-[210px] truncate text-xs">{getValue() as string}</span> },
    { id: "jobs", header: "Jobs", accessorFn: (r) => r.m.jobs.length, meta: { align: "right" } },
    {
      id: "out",
      header: "Outbound",
      accessorFn: (r) => r.m.outUtil,
      cell: ({ row }) => (
        <div className="w-24">
          <CapacityBar used={row.original.m.outboundKg} capacity={row.original.m.capacityKg} showNumbers={false} size="sm" />
          <span className="text-xs text-muted-foreground tabular">{pct(row.original.m.outUtil)}</span>
        </div>
      ),
    },
    {
      id: "ret",
      header: "Return",
      accessorFn: (r) => r.m.retUtil,
      cell: ({ row }) => (
        <div className="w-24">
          <CapacityBar used={row.original.m.returnKg} capacity={row.original.m.capacityKg} showNumbers={false} size="sm" />
          <span className="text-xs text-muted-foreground tabular">{pct(row.original.m.retUtil)}</span>
        </div>
      ),
    },
    { id: "km", header: "Km", accessorFn: (r) => r.m.distanceKm, meta: { align: "right" }, cell: ({ row }) => <span className={row.original.m.distanceIsActual ? "" : "text-muted-foreground"}>{num(row.original.m.distanceKm)}</span> },
    { id: "rev", header: "Freight revenue", accessorFn: (r) => r.m.revenue, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.revenue} compact /> },
    { id: "cost", header: "Trip expenses", accessorFn: (r) => r.m.expenseTotal + r.m.estimatedDiesel, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.expenseTotal + row.original.m.estimatedDiesel} compact className="text-muted-foreground" /> },
    { id: "contrib", header: "Contribution", accessorFn: (r) => r.m.contribution, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.contribution} compact className="font-medium" /> },
    { id: "status", header: "Status", accessorFn: (r) => r.t.status, cell: ({ row }) => <StatusBadge status={row.original.t.status} /> },
  ];

  const empty = (
    <EmptyState
      icon={tableView ? Archive : Truck}
      title={hasFilters ? "No trips match these filters" : tab === "active" ? "No active trips" : tab === "upcoming" ? "No upcoming trips" : "No trips to show"}
      description={hasFilters ? "Try another truck, status or search term." : tableView ? "Trip records will appear here as your fleet gets moving." : "Plan a trip in Dispatch to schedule your next run."}
      className="bg-card"
      action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : <Button asChild><Link href="/dispatch">Open Dispatch <ArrowRight /></Link></Button>}
    />
  );

  return (
    <div className="trips-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><Route className="size-3.5" /> Fleet operations</div>
      <PageHeader
        title="Trips"
        description="Keep every route on track. Manage your fleet from departure to return."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/backhaul"><Undo2 /> Backhaul</Link></Button>
            <Button asChild><Link href="/dispatch"><Kanban /> Plan a trip</Link></Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium">Fleet performance</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />Last 30 completed calendar days</span>
      </div>
      <div className="trip-summary mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <TripMetric label="Completed trips" value={done.length} icon={Route} hint={`${pesoCompact(sumBy(done, (t) => metrics.get(t.id)!.revenue))} freight revenue`} featured />
        <TripMetric label="Avg. outbound fill" value={pct(avg((m) => m.outUtil))} icon={Truck} hint="Configured payload utilization" />
        <TripMetric label="Avg. return fill" value={pct(avg((m) => m.retUtil))} icon={Undo2} hint="Backhaul on completed trips" />
        <TripMetric label="Avg. contribution / trip" value={pesoCompact(avg((m) => m.contribution))} icon={Wallet} hint={`${pesoCompact(avg((m) => m.expenseTotal + m.estimatedDiesel))} average trip expenses`} />
      </div>

      <Tabs value={tab} onValueChange={(value) => { setTab(value); setStatus("all"); }}>
        <div className="mb-4 border-b pb-4">
          <TabsList aria-label="Trip views" className="trip-view-tabs h-auto max-w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            {views.map((view) => <TabsTrigger key={view.value} value={view.value} aria-controls="trip-results" className="px-3 py-2 text-xs"><view.icon />{view.label}<span className="trip-view-count">{view.count}</span></TabsTrigger>)}
          </TabsList>
        </div>
        <div id="trip-results" role="tabpanel" aria-label={views.find((v) => v.value === tab)?.label}>
          <div className="mb-4 rounded-xl border bg-card">
            <FilterBar search={q} onSearch={setQ} placeholder="Search trip, route, driver or plate…" className="border-0">
              <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "All trucks" }, ...TRUCKS.map((t) => ({ value: t.id, label: `${t.code} · ${t.make}` }))]} className="w-full sm:w-44" />
              {tab !== "upcoming" && <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "Any status" }, ...visibleStatuses.map((s) => ({ value: s, label: s }))]} />}
              {hasFilters && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearFilters}><X /> Clear filters</Button>}
            </FilterBar>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{tab === "active" ? "On the road & preparing" : tab === "upcoming" ? "Scheduled departures" : tab === "history" ? "Trip history" : "Trip register"}</h2>
            <span className="text-[11px] text-muted-foreground" aria-live="polite">{rows.length} {rows.length === 1 ? "trip" : "trips"}{hasFilters ? " match your filters" : tab === "active" ? ` · ${fmtDay(TODAY)}` : ""}</span>
          </div>
          {tableView ? (
            <Card className="overflow-hidden">
              <DataTable
                key={tab}
                columns={columns}
                data={rows}
                initialSorting={[{ id: "date", desc: true }]}
                initialHidden={{ driver: false, jobs: false, out: false, ret: false, km: false, cost: false }}
                columnToggle
                toolbar={<div className="px-4 py-3 text-[11px] text-muted-foreground">Select a trip for stops, cargo and expenses.</div>}
                className="trip-register"
                onRowClick={(r) => router.push(`/trips/${r.t.id}`)}
                empty={empty}
                renderCard={(r) => (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/trips/${r.t.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-primary hover:underline">{r.t.id}</Link><StatusBadge status={r.t.status} className="text-[10px]" /></div>
                    <div className="text-[11px] text-muted-foreground">{fmtDay(r.t.date)} · {truckById(r.t.truckId).code} · {driverById(r.t.driverId).name}</div>
                    <div className="text-xs leading-relaxed">{tripRouteLine(r.t)}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground"><span>Outbound {pct(r.m.outUtil)}</span><span>Return {pct(r.m.retUtil)}</span><span className="font-medium text-primary">{pesoCompact(r.m.contribution)} contribution</span></div>
                  </div>
                )}
              />
            </Card>
          ) : rows.length ? (
            <div className="trip-schedule-grid grid items-start gap-4">{rows.map(({ t, m }) => <TripScheduleCard key={t.id} trip={t} metrics={m} />)}</div>
          ) : empty}
        </div>
      </Tabs>
    </div>
  );
}

function TripMetric({ label, value, hint, icon: Icon, featured }: { label: string; value: React.ReactNode; hint: string; icon: LucideIcon; featured?: boolean }) {
  return (
    <div className={cn("trip-metric min-w-0 p-4 sm:p-5", featured && "trip-metric-featured")}>
      <div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div>
      <div className="my-3 text-[26px] leading-none font-semibold tracking-tight tabular sm:text-[30px]">{value}</div>
      <p className="text-[11px] leading-relaxed opacity-75">{hint}</p>
    </div>
  );
}
