"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { Camera, CalendarDays, List, Route as RouteIcon, Warehouse, Flag } from "lucide-react";
import type { Customer, Delivery, Order, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { AREAS, areaName, routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { buildTripStops } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDateShort, fmtDay, fmtTime, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, PageHeader, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/features/orders/orders-view";

interface Row {
  d: Delivery;
  o: Order;
  c: Customer;
  t: Trip;
}

const STATUSES = ["Scheduled", "Loading", "Ready", "In Transit", "Arrived", "Delivered", "Failed", "Returned"];

export function DeliveriesView({ initialArea }: { initialArea?: string }) {
  const router = useRouter();
  const deliveries = useAppStore((s) => s.deliveries);
  const orders = useAppStore((s) => s.orders);
  const trips = useAppStore((s) => s.trips);
  const customers = useCustomerMap();
  const [q, setQ] = React.useState("");
  const [date, setDate] = React.useState<string>(TODAY);
  const [status, setStatus] = React.useState("all");
  const [area, setArea] = React.useState(initialArea ?? "all");

  const orderMap = React.useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const tripMap = React.useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);
  const rows: Row[] = deliveries
    .map((d) => {
      const o = orderMap.get(d.orderId);
      const t = tripMap.get(d.tripId);
      if (!o || !t) return null;
      return { d, o, c: customers.get(o.customerId)!, t };
    })
    .filter((r): r is Row => !!r);
  const filtered = rows.filter((r) => (date === "all" || r.t.date === date) && (status === "all" || r.d.status === status) && (area === "all" || r.c.areaId === area));

  const dateOptions = [
    { value: "all", label: "All dates" },
    ...Array.from({ length: 9 }, (_, i) => format(addDays(parseISO(TODAY), 1 - i), "yyyy-MM-dd")).map((d) => ({ value: d, label: `${relativeDay(d)} · ${fmtDateShort(d)}` })),
  ];

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "id", header: "Delivery No.", accessorFn: (r) => r.d.id, cell: ({ row }) => <Link href={`/deliveries/${row.original.d.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.d.id}</Link> },
    { id: "order", header: "Order", accessorFn: (r) => r.o.id, cell: ({ row }) => <Link href={`/orders/${row.original.o.id}`} className="whitespace-nowrap hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.o.id}</Link> },
    { id: "customer", header: "Customer", accessorFn: (r) => r.c.name, cell: ({ row }) => <div className="max-w-[200px]"><div className="truncate font-medium">{row.original.c.name}</div><div className="truncate text-xs text-muted-foreground">{orderSummary(row.original.o)}</div></div> },
    { id: "dest", header: "Destination", accessorFn: (r) => areaName(r.c.areaId), cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "truck", header: "Truck", accessorFn: (r) => truckById(r.t.truckId).code, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "driver", header: "Driver", accessorFn: (r) => driverById(r.t.driverId).name, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "dep", header: "Departure", accessorFn: (r) => r.t.actualDeparture ?? r.t.departure, cell: ({ row }) => <span className="whitespace-nowrap tabular">{fmtDateShort(row.original.t.date)} {fmtTime(row.original.t.actualDeparture ?? row.original.t.departure)}</span> },
    { id: "eta", header: "ETA", accessorFn: (r) => r.d.eta, cell: ({ row }) => <span className="tabular">{fmtTime(row.original.d.eta)}</span> },
    { id: "arr", header: "Actual Arrival", accessorFn: (r) => r.d.arrivedAt ?? "", cell: ({ row }) => (row.original.d.arrivedAt ? <span className={cn("tabular", row.original.d.arrivedAt > row.original.d.eta && "text-[oklch(0.55_0.13_65)]")}>{fmtTime(row.original.d.arrivedAt)}</span> : <span className="text-muted-foreground">—</span>) },
    { id: "status", header: "Status", accessorFn: (r) => r.d.status, cell: ({ row }) => <StatusBadge status={row.original.d.status} /> },
    { id: "pod", header: "POD", accessorFn: (r) => (r.d.pod ? 1 : 0), cell: ({ row }) => (row.original.d.pod ? <span className="inline-flex items-center gap-1 text-xs text-[oklch(0.45_0.13_150)]"><Camera className="size-3.5" /> {row.original.d.pod.photoCount}</span> : <span className="text-xs text-muted-foreground">—</span>) },
  ];

  return (
    <>
      <PageHeader title="Deliveries" description="Every truck drop with ETA, actual arrival and proof of delivery." />
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <List /> List
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays /> Calendar
          </TabsTrigger>
          <TabsTrigger value="route">
            <RouteIcon /> Route view
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <Card className="overflow-hidden">
            <FilterBar search={q} onSearch={setQ} placeholder="Search delivery, order, customer…">
              <FilterSelect value={date} onChange={setDate} label="Date" options={dateOptions} />
              <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
              <FilterSelect value={area} onChange={setArea} label="Destination" options={[{ value: "all", label: "All destinations" }, ...AREAS.filter((a) => !a.interIsland && a.distanceKm > 50).map((a) => ({ value: a.id, label: a.name }))]} />
            </FilterBar>
            <DataTable
              columns={columns}
              data={filtered}
              search={q}
              searchText={(r) => `${r.d.id} ${r.o.id} ${r.c.name} ${areaName(r.c.areaId)} ${r.t.id}`}
              initialSorting={[{ id: "eta", desc: false }]}
              onRowClick={(r) => router.push(`/deliveries/${r.d.id}`)}
              empty={<EmptyState title="No deliveries for the selected filters." />}
              renderCard={(r) => (
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.c.name}</span>
                    <StatusBadge status={r.d.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.d.id} · {areaName(r.c.areaId)} · {truckById(r.t.truckId).code} · ETA {fmtTime(r.d.eta)}
                  </div>
                </div>
              )}
            />
          </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView rows={rows} trips={trips} />
        </TabsContent>
        <TabsContent value="route">
          <RouteView trips={trips.filter((t) => t.date === (date === "all" ? TODAY : date))} date={date === "all" ? TODAY : date} onDate={setDate} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CalendarView({ rows, trips }: { rows: Row[]; trips: Trip[] }) {
  const start = parseISO("2026-09-14");
  const days = Array.from({ length: 14 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dayTrips = trips.filter((t) => t.date === d);
          const dayRows = rows.filter((r) => r.t.date === d);
          const delivered = dayRows.filter((r) => r.d.status === "Delivered").length;
          return (
            <div key={d} className={cn("min-h-28 border-r border-b p-1.5 text-xs last:border-r-0 sm:p-2", d === TODAY && "bg-accent/40", d > TODAY && "bg-muted/20")}>
              <div className={cn("mb-1 font-semibold tabular", d === TODAY && "text-primary")}>{format(parseISO(d), "d")}</div>
              {dayTrips.length === 0 ? (
                <div className="text-muted-foreground">{parseISO(d).getDay() === 0 ? "Rest day" : "No trips"}</div>
              ) : (
                <div className="grid gap-1">
                  {dayTrips.map((t) => (
                    <Link key={t.id} href={`/trips/${t.id}`} className="truncate rounded px-1 py-0.5 text-[11px] font-medium text-white hover:opacity-90" style={{ background: truckById(t.truckId).color }} title={routeById(t.routeId).name}>
                      <span className="hidden sm:inline">{truckById(t.truckId).code}: </span>
                      {routeById(t.routeId).outboundAreas.map((a) => areaName(a).replace(" City", "")).slice(0, 2).join(", ")}
                    </Link>
                  ))}
                  <div className="hidden text-muted-foreground sm:block">
                    {dayRows.length} drops{dayRows.length ? ` · ${delivered} done` : ""}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RouteView({ trips, date, onDate }: { trips: Trip[]; date: string; onDate: (d: string) => void }) {
  const metrics = useTripMetrics();
  const customers = useAppStore((s) => s.customers);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => format(addDays(parseISO(TODAY), 1 - i), "yyyy-MM-dd")).map((d) => (
          <button key={d} type="button" onClick={() => onDate(d)} className={cn("rounded-full border px-3 py-1 text-xs cursor-pointer", d === date ? "border-primary bg-accent font-medium text-primary" : "bg-card hover:bg-muted")}>
            {relativeDay(d)} · {fmtDateShort(d)}
          </button>
        ))}
      </div>
      {trips.length === 0 && <EmptyState title="No trips scheduled for this day." className="bg-card" />}
      {trips.map((t) => {
        const m = metrics.get(t.id)!;
        const stops = buildTripStops(t, m, customers);
        return (
          <Card key={t.id}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: truckById(t.truckId).color }} />
                  {truckById(t.truckId).code} · {routeById(t.routeId).name}
                </CardTitle>
                <CardDescription>
                  <Link href={`/trips/${t.id}`} className="hover:underline">
                    {t.id}
                  </Link>{" "}
                  · {fmtDay(t.date)} · {driverById(t.driverId).name}
                </CardDescription>
              </div>
              <StatusBadge status={t.status} />
            </CardHeader>
            <CardContent className="overflow-x-auto pb-6">
              <ol className="flex min-w-max items-start">
                {stops.map((s, i) => (
                  <li key={i} className="flex items-start">
                    <div className="flex w-28 flex-col items-center text-center">
                      <span
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full border-2 text-xs font-semibold",
                          s.status === "done" ? "border-primary bg-primary text-white" : s.status === "current" ? "border-primary bg-card text-primary ring-4 ring-primary/15" : "border-border bg-card text-muted-foreground",
                          s.type === "pickup" && s.status !== "done" && "border-[var(--chart-3)] text-[var(--chart-3)]",
                        )}
                      >
                        {s.type === "depart" ? <Warehouse className="size-4" /> : s.type === "arrive" ? <Flag className="size-4" /> : s.type === "pickup" ? "P" : i}
                      </span>
                      <div className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-tight">{s.label}</div>
                      <div className="text-[10.5px] text-muted-foreground">{areaName(s.areaId).replace(" City", "")}</div>
                      <div className="text-[10.5px] tabular text-muted-foreground">{fmtTime(s.actual ?? s.eta)}</div>
                    </div>
                    {i < stops.length - 1 && <div className={cn("mt-[18px] h-0.5 w-6", stops[i + 1].status === "done" || s.status === "done" ? "bg-primary/50" : "bg-border", stops[i + 1].type === "pickup" && "bg-[var(--chart-3)]/40")} />}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
