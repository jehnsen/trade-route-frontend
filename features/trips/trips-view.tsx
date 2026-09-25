"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Kanban, Route, Truck, Undo2, Wallet } from "lucide-react";
import type { Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import type { TripMetrics } from "@/lib/selectors";
import { fmtDay, pct, pesoCompact, relativeDay } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { CapacityBar, FilterBar, KPICard, MoneyDisplay, PageHeader, SectionTitle } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { TripCard } from "@/components/shared/trip-card";
import { FilterSelect } from "@/features/orders/orders-view";

interface Row {
  t: Trip;
  m: TripMetrics;
}

export function TripsView() {
  const router = useRouter();
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [tab, setTab] = React.useState("all");
  const [truck, setTruck] = React.useState("all");
  const [q, setQ] = React.useState("");

  const live = trips.filter((t) => t.date >= TODAY).sort((a, b) => a.departure.localeCompare(b.departure));
  const done = trips.filter((t) => t.status === "Completed");
  const rows: Row[] = trips
    .filter((t) => (tab === "all" ? true : tab === "active" ? t.date >= TODAY : t.status === "Completed") && (truck === "all" || t.truckId === truck))
    .map((t) => ({ t, m: metrics.get(t.id)! }));

  const avg = (f: (m: TripMetrics) => number) => (done.length ? sumBy(done, (t) => f(metrics.get(t.id)!)) / done.length : 0);

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "id", header: "Trip", accessorFn: (r) => r.t.id, cell: ({ row }) => <Link href={`/trips/${row.original.t.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.t.id}</Link> },
    { id: "date", header: "Date", accessorFn: (r) => r.t.departure, cell: ({ row }) => <div className="whitespace-nowrap">{fmtDay(row.original.t.date)}<div className="text-xs text-muted-foreground">{relativeDay(row.original.t.date)}</div></div> },
    { id: "truck", header: "Truck", accessorFn: (r) => truckById(r.t.truckId).code, cell: ({ row }) => <span className="whitespace-nowrap">{truckById(row.original.t.truckId).code}</span> },
    { id: "driver", header: "Driver", accessorFn: (r) => driverById(r.t.driverId).name, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "route", header: "Route", accessorFn: (r) => routeById(r.t.routeId).name, cell: ({ getValue }) => <span className="block max-w-[240px] truncate">{getValue() as string}</span> },
    { id: "drops", header: "Drops", accessorFn: (r) => r.m.deliveries.length, meta: { align: "right" } },
    { id: "out", header: "Outbound", accessorFn: (r) => r.m.outUtil, cell: ({ row }) => <div className="w-24"><CapacityBar used={row.original.m.outboundLoadKg} capacity={row.original.m.capacityKg} showNumbers={false} size="sm" /><span className="text-xs tabular text-muted-foreground">{pct(row.original.m.outUtil)}</span></div> },
    { id: "ret", header: "Return", accessorFn: (r) => r.m.retUtil, cell: ({ row }) => <div className="w-24"><CapacityBar used={row.original.m.returnLoadKg} capacity={row.original.m.capacityKg} showNumbers={false} size="sm" /><span className="text-xs tabular text-muted-foreground">{pct(row.original.m.retUtil)}</span></div> },
    { id: "rev", header: "Revenue", accessorFn: (r) => r.m.revenue, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.revenue} compact /> },
    { id: "cost", header: "Trip cost", accessorFn: (r) => r.m.tripCost, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.tripCost} compact className="text-muted-foreground" /> },
    { id: "contrib", header: "Contribution", accessorFn: (r) => r.m.contribution, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.m.contribution} compact className="font-medium" /> },
    { id: "status", header: "Status", accessorFn: (r) => r.t.status, cell: ({ row }) => <StatusBadge status={row.original.t.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Trips"
        description="Each trip ties together the truck, crew, outbound drops, backhaul pickups, expenses and contribution."
        actions={
          <Button asChild>
            <Link href="/dispatch">
              <Kanban /> Plan on Dispatch Board
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Completed trips (30 days)" value={done.length} icon={Route} hint={`${pesoCompact(sumBy(done, (t) => metrics.get(t.id)!.revenue))} revenue carried`} />
        <KPICard label="Avg. outbound utilization" value={pct(avg((m) => m.outUtil))} icon={Truck} tone="success" />
        <KPICard label="Avg. return utilization" value={pct(avg((m) => m.retUtil))} icon={Undo2} tone={avg((m) => m.retUtil) < 0.6 ? "warning" : "success"} href="/backhaul" />
        <KPICard label="Avg. contribution / trip" value={pesoCompact(avg((m) => m.contribution))} icon={Wallet} hint={`avg trip cost ${pesoCompact(avg((m) => m.tripCost))}`} />
      </div>

      <SectionTitle>Today & upcoming</SectionTitle>
      <div className="mb-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {live.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              <TabsTrigger value="all">All trips ({trips.length})</TabsTrigger>
              <TabsTrigger value="active">Today & upcoming ({live.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({done.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search trip, route, driver…">
          <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, { value: "TRK-01", label: "Truck 01 — Isuzu Giga" }, { value: "TRK-02", label: "Truck 02 — Hino 500" }]} className="w-full sm:w-56" />
        </FilterBar>
        <DataTable
          columns={columns}
          data={rows}
          search={q}
          searchText={(r) => `${r.t.id} ${routeById(r.t.routeId).name} ${driverById(r.t.driverId).name} ${truckById(r.t.truckId).code}`}
          initialSorting={[{ id: "date", desc: true }]}
          onRowClick={(r) => router.push(`/trips/${r.t.id}`)}
          renderCard={(r) => (
            <div className="grid gap-1.5">
              <div className="flex justify-between"><span className="font-semibold text-primary">{r.t.id}</span><StatusBadge status={r.t.status} /></div>
              <div className="text-sm">{routeById(r.t.routeId).name}</div>
              <div className="text-xs text-muted-foreground">{truckById(r.t.truckId).code} · {driverById(r.t.driverId).name} · out {pct(r.m.outUtil)} / return {pct(r.m.retUtil)}</div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
