"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Kanban, Route, Truck, Undo2, Wallet } from "lucide-react";
import type { Trip, TripStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { truckById, driverById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import type { TripMetrics } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, num, pct, pesoCompact, relativeDay } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { CapacityBar, EmptyState, FilterBar, FilterSelect, KPICard, MoneyDisplay, PageHeader, SectionTitle } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { TripCard } from "@/components/shared/trip-card";

interface Row {
  t: Trip;
  m: TripMetrics;
}

const STATUSES: TripStatus[] = ["Planned", "Loading", "Ready", "Dispatched", "In Transit", "Returning", "Completed", "Cancelled"];

export function TripsView() {
  const router = useRouter();
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [tab, setTab] = React.useState("all");
  const [truck, setTruck] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");

  const live = trips.filter((t) => (t.date >= TODAY || ["Loading", "Ready", "Dispatched", "In Transit", "Returning"].includes(t.status)) && t.status !== "Cancelled" && t.status !== "Completed").sort((a, b) => a.departure.localeCompare(b.departure));
  const done = trips.filter((t) => t.status === "Completed");
  const rows: Row[] = trips
    .filter((t) => (tab === "all" ? true : tab === "active" ? live.includes(t) : t.status === "Completed") && (truck === "all" || t.truckId === truck) && (status === "all" || t.status === status))
    .map((t) => ({ t, m: metrics.get(t.id)! }));
  const avg = (f: (m: TripMetrics) => number) => (done.length ? sumBy(done, (t) => f(metrics.get(t.id)!)) / done.length : 0);

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "id",
      header: "Trip",
      accessorFn: (r) => r.t.id,
      cell: ({ row }) => (
        <Link href={`/trips/${row.original.t.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
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
    { id: "truck", header: "Truck", accessorFn: (r) => truckById(r.t.truckId).code, cell: ({ row }) => <span className="whitespace-nowrap">{truckById(row.original.t.truckId).code}</span> },
    { id: "driver", header: "Driver", accessorFn: (r) => driverById(r.t.driverId).name, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "route", header: "Route", accessorFn: (r) => tripRouteLine(r.t), cell: ({ getValue }) => <span className="block max-w-[260px] truncate">{getValue() as string}</span> },
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

  return (
    <>
      <PageHeader
        title="Trips"
        description="Each trip ties together the truck, crew, stops, outbound jobs, backhaul, expenses and contribution."
        actions={
          <Button asChild>
            <Link href="/dispatch">
              <Kanban /> Plan on Dispatch
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Completed trips (30 days)" value={done.length} icon={Route} hint={`${pesoCompact(sumBy(done, (t) => metrics.get(t.id)!.revenue))} freight revenue`} />
        <KPICard label="Avg. outbound utilization" value={pct(avg((m) => m.outUtil))} icon={Truck} tone="success" />
        <KPICard label="Avg. return utilization" value={pct(avg((m) => m.retUtil))} icon={Undo2} tone={avg((m) => m.retUtil) < 0.5 ? "warning" : "success"} href="/backhaul" hint="backhaul fill on completed trips" />
        <KPICard label="Avg. contribution / trip" value={pesoCompact(avg((m) => m.contribution))} icon={Wallet} hint={`avg trip expenses ${pesoCompact(avg((m) => m.expenseTotal))}`} />
      </div>

      <SectionTitle>Active & upcoming</SectionTitle>
      {live.length === 0 ? (
        <EmptyState title="No trips scheduled today." description="Plan a trip from the Dispatch board." className="mb-6 bg-card" />
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {live.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="all">All trips ({trips.length})</TabsTrigger>
              <TabsTrigger value="active">Active & upcoming ({live.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({done.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search trip, route, driver…">
          <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, { value: "TRK-01", label: "Truck 01 — Isuzu Giga" }, { value: "TRK-02", label: "Truck 02 — Hino 500" }]} className="w-full sm:w-56" />
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={rows}
          search={q}
          searchText={(r) => `${r.t.id} ${tripRouteLine(r.t)} ${driverById(r.t.driverId).name} ${truckById(r.t.truckId).code}`}
          initialSorting={[{ id: "date", desc: true }]}
          onRowClick={(r) => router.push(`/trips/${r.t.id}`)}
          empty={<EmptyState title="No trips match these filters." />}
          renderCard={(r) => (
            <div className="grid gap-1.5">
              <div className="flex justify-between">
                <span className="font-semibold text-primary">{r.t.id}</span>
                <StatusBadge status={r.t.status} />
              </div>
              <div className="text-sm">{tripRouteLine(r.t)}</div>
              <div className="text-xs text-muted-foreground">
                {truckById(r.t.truckId).code} · {driverById(r.t.driverId).name} · out {pct(r.m.outUtil)} / return {pct(r.m.retUtil)} · {pesoCompact(r.m.contribution)} contribution
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
