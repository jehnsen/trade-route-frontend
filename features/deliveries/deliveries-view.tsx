"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, Camera, CheckCircle2, Clock, List, PackageCheck, Route as RouteIcon, Truck } from "lucide-react";
import type { Customer, Delivery, LogisticsJob, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { AREAS, areaName } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { DELIVERY_DONE } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDateShort, fmtTime, kg, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, KPICard, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

interface Row {
  d: Delivery;
  j: LogisticsJob;
  c: Customer;
  t: Trip;
  late: boolean;
}

const STATUSES = ["Scheduled", "Loading", "Ready", "In Transit", "Arrived", "Delivered", "Failed", "Returned"];

export function DeliveriesView({ initialArea }: { initialArea?: string }) {
  const router = useRouter();
  const deliveries = useAppStore((s) => s.deliveries);
  const jobs = useAppStore((s) => s.jobs);
  const trips = useAppStore((s) => s.trips);
  const customers = useCustomerMap();
  const [q, setQ] = React.useState("");
  const [date, setDate] = React.useState<string>(TODAY);
  const [status, setStatus] = React.useState("all");
  const [area, setArea] = React.useState(initialArea ?? "all");

  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const tripMap = React.useMemo(() => new Map(trips.map((t) => [t.id, t])), [trips]);
  const rows: Row[] = deliveries
    .map((d) => {
      const j = jobMap.get(d.jobId);
      const t = tripMap.get(d.tripId);
      const c = customers.get(d.customerId);
      if (!j || !t || !c) return null;
      const arrival = d.arrivedAt ?? d.eta;
      return { d, j, c, t, late: !DELIVERY_DONE.includes(d.status) ? d.eta > j.requiredBy : arrival > j.requiredBy };
    })
    .filter((r): r is Row => !!r);
  const filtered = rows.filter((r) => (date === "all" || r.t.date === date) && (status === "all" || (status === "issues" ? r.d.issues.length > 0 || r.d.status === "Failed" : r.d.status === status)) && (area === "all" || r.j.dropoff.areaId === area));
  const today = rows.filter((r) => r.t.date === TODAY);
  const dateOptions = [
    { value: "all", label: "All dates" },
    ...Array.from({ length: 9 }, (_, i) => format(addDays(parseISO(TODAY), 1 - i), "yyyy-MM-dd")).map((d) => ({ value: d, label: `${relativeDay(d)} · ${fmtDateShort(d)}` })),
  ];

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "id",
      header: "Delivery",
      accessorFn: (r) => r.d.id,
      cell: ({ row }) => (
        <Link href={`/deliveries/${row.original.d.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.d.id}
        </Link>
      ),
    },
    {
      id: "job",
      header: "Job",
      accessorFn: (r) => r.j.id,
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.j.id}`} className="text-xs whitespace-nowrap hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.j.id}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer / consignee",
      accessorFn: (r) => r.c.name,
      cell: ({ row }) => (
        <div className="max-w-[210px]">
          <div className="truncate font-medium">{row.original.c.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.original.j.cargoDescription} · {kg(row.original.j.weightKg)}
          </div>
        </div>
      ),
    },
    { id: "dest", header: "Destination", accessorFn: (r) => r.j.dropoff.name, cell: ({ row }) => <div className="max-w-[200px] truncate">{row.original.j.dropoff.name}</div> },
    { id: "truck", header: "Truck / driver", accessorFn: (r) => truckById(r.t.truckId).code, cell: ({ row }) => <div className="text-xs whitespace-nowrap"><div className="font-medium">{truckById(row.original.t.truckId).code}</div><div className="text-muted-foreground">{driverById(row.original.t.driverId).name}</div></div> },
    { id: "eta", header: "ETA", accessorFn: (r) => r.d.eta, cell: ({ row }) => <div className="text-xs whitespace-nowrap tabular"><div>{fmtTime(row.original.d.eta)}</div><div className="text-muted-foreground">due {fmtTime(row.original.j.requiredBy)}</div></div> },
    {
      id: "arr",
      header: "Arrived",
      accessorFn: (r) => r.d.arrivedAt ?? "",
      cell: ({ row }) => (row.original.d.arrivedAt ? <span className={cn("tabular", row.original.late && "font-medium text-[oklch(0.55_0.13_65)]")}>{fmtTime(row.original.d.arrivedAt)}</span> : <span className="text-muted-foreground">—</span>),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.d.status,
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge status={row.original.d.status} />
          {row.original.late && !DELIVERY_DONE.includes(row.original.d.status) && <span className="rounded bg-danger-soft px-1.5 text-[11px] font-medium text-danger">Late risk</span>}
          {row.original.d.issues.length > 0 && <AlertTriangle className="size-3.5 text-[oklch(0.6_0.14_65)]" aria-label="Has issues" />}
        </div>
      ),
    },
    {
      id: "pod",
      header: "POD",
      accessorFn: (r) => (r.d.pod ? 1 : 0),
      cell: ({ row }) =>
        row.original.d.pod ? (
          <span className="inline-flex items-center gap-1 text-xs text-[oklch(0.45_0.13_150)]">
            <Camera className="size-3.5" /> {row.original.d.pod.photoCount} · {row.original.d.pod.receiptNo}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  const byTrip = [...new Set(filtered.map((r) => r.t.id))].map((id) => tripMap.get(id)!).sort((a, b) => a.departure.localeCompare(b.departure));

  return (
    <>
      <PageHeader title="Deliveries" description="Every drop linked to its job, trip, truck, driver and customer — with ETA, actual arrival, issues and proof of delivery." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Deliveries today" value={today.length} icon={PackageCheck} hint={`${today.filter((r) => r.d.status === "Delivered").length} delivered`} />
        <KPICard label="In transit / next" value={today.filter((r) => ["In Transit", "Arrived", "Scheduled"].includes(r.d.status)).length} icon={Truck} />
        <KPICard label="Late risk" value={today.filter((r) => r.late && !DELIVERY_DONE.includes(r.d.status)).length} icon={Clock} tone={today.some((r) => r.late && !DELIVERY_DONE.includes(r.d.status)) ? "danger" : "success"} hint="ETA after receiving window" />
        <KPICard label="POD captured (today)" value={`${today.filter((r) => r.d.pod).length}/${today.filter((r) => r.d.status === "Delivered").length}`} icon={CheckCircle2} tone="success" />
      </div>
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">
            <List /> List
          </TabsTrigger>
          <TabsTrigger value="route">
            <RouteIcon /> By trip
          </TabsTrigger>
        </TabsList>
        <Card className="mt-3 overflow-hidden">
          <FilterBar search={q} onSearch={setQ} placeholder="Search delivery, job, customer, place…">
            <FilterSelect value={date} onChange={setDate} label="Trip date" options={dateOptions} className="w-full sm:w-48" />
            <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "All statuses" }, { value: "issues", label: "With issues" }, ...STATUSES.map((s) => ({ value: s, label: s }))]} />
            <FilterSelect value={area} onChange={setArea} label="Destination area" options={[{ value: "all", label: "All areas" }, ...AREAS.filter((a) => !a.interIsland).map((a) => ({ value: a.id, label: a.name }))]} />
          </FilterBar>
          <TabsContent value="list" className="mt-0">
            <DataTable
              columns={columns}
              data={filtered}
              search={q}
              searchText={(r) => `${r.d.id} ${r.j.id} ${r.c.name} ${r.j.dropoff.name} ${areaName(r.j.dropoff.areaId)} ${r.t.id} ${r.j.consignee.name}`}
              onRowClick={(r) => router.push(`/deliveries/${r.d.id}`)}
              initialSorting={[{ id: "eta", desc: false }]}
              empty={<EmptyState title="No deliveries for the selected filters." description="Try another date or clear the status filter." />}
              renderCard={(r) => (
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary">{r.d.id}</span>
                    <StatusBadge status={r.d.status} />
                  </div>
                  <div className="font-medium">{r.c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.j.dropoff.name} · ETA {fmtTime(r.d.eta)} · {truckById(r.t.truckId).code}
                  </div>
                </div>
              )}
            />
          </TabsContent>
          <TabsContent value="route" className="mt-0 grid gap-4 p-4 lg:grid-cols-2">
            {byTrip.length === 0 && <EmptyState className="lg:col-span-2" title="No deliveries for the selected filters." />}
            {byTrip.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <div>
                    <CardTitle>
                      <Link href={`/trips/${t.id}`} className="hover:underline">
                        {truckById(t.truckId).code} · {t.id}
                      </Link>
                    </CardTitle>
                    <CardDescription>{tripRouteLine(t)}</CardDescription>
                  </div>
                  <StatusBadge status={t.status} />
                </CardHeader>
                <CardContent>
                  <ol className="grid gap-2">
                    {filtered
                      .filter((r) => r.t.id === t.id)
                      .sort((a, b) => a.d.eta.localeCompare(b.d.eta))
                      .map((r, i) => (
                        <li key={r.d.id}>
                          <Link href={`/deliveries/${r.d.id}`} className="flex items-center gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/40">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.c.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {areaName(r.j.dropoff.areaId)} · {r.j.cargoDescription}
                              </div>
                            </div>
                            <div className="text-right text-xs tabular">
                              <div>{r.d.arrivedAt ? fmtTime(r.d.arrivedAt) : `ETA ${fmtTime(r.d.eta)}`}</div>
                              <StatusBadge status={r.d.status} icon={false} className="text-[10px]" />
                            </div>
                          </Link>
                        </li>
                      ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Card>
      </Tabs>
    </>
  );
}
