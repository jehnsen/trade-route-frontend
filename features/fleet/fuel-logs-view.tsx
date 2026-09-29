"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Droplets, Fuel, Gauge, Info, Plus, Receipt } from "lucide-react";
import type { FuelLog } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { TRUCKS, truckById, driverById } from "@/data/fleet";
import { areaName } from "@/data/areas";
import { fuelEfficiencyByLog } from "@/lib/logistics";
import { fmtDateShort, fmtTime, num, peso, pesoCompact } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { DemoRateNote, EmptyState, FilterBar, FilterSelect, KPICard, LineItem, PageHeader } from "@/components/shared/common";
import { FuelLogDialog } from "./fuel-log-dialog";

const WINDOW_START = "2026-08-26";

export function FuelLogsView() {
  const logs = useAppStore((s) => s.fuelLogs);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [truck, setTruck] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  const eff = React.useMemo(() => fuelEfficiencyByLog(logs), [logs]);
  const inWindow = logs.filter((f) => f.date >= WINDOW_START);
  const filtered = logs.filter((f) => truck === "all" || f.truckId === truck);
  const fueledTrips = trips.filter((t) => t.status === "Completed" && logs.some((f) => f.tripId === t.id));
  const perTrip = fueledTrips.map((t) => {
    const tl = logs.filter((f) => f.tripId === t.id);
    return { trip: t, liters: sumBy(tl, (f) => f.liters), cost: sumBy(tl, (f) => f.totalCost), km: metrics.get(t.id)!.distanceKm };
  });
  const perTruck = TRUCKS.map((t) => {
    const mine = logs.filter((f) => f.truckId === t.id);
    const values = mine.map((f) => eff.get(f.id)).filter((x): x is number => x !== undefined);
    const tt = perTrip.filter((p) => p.trip.truckId === t.id);
    return { truck: t, avg: values.length ? sumBy(values, (x) => x) / values.length : undefined, samples: values.length, last: [...mine].sort((a, b) => b.date.localeCompare(a.date))[0], litersPerTrip: tt.length ? sumBy(tt, (p) => p.liters) / tt.length : 0, costPerTrip: tt.length ? sumBy(tt, (p) => p.cost) / tt.length : 0 };
  });

  const columns: ColumnDef<FuelLog, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (f) => f.date, cell: ({ row }) => <div className="whitespace-nowrap">{fmtDateShort(row.original.date)}<div className="text-xs text-muted-foreground">{fmtTime(row.original.date)}</div></div> },
    { id: "truck", header: "Truck", accessorFn: (f) => truckById(f.truckId).code, cell: ({ row }) => <span className="whitespace-nowrap">{truckById(row.original.truckId).code}</span> },
    { id: "trip", header: "Trip", accessorFn: (f) => f.tripId ?? "", cell: ({ row }) => (row.original.tripId ? <Link href={`/trips/${row.original.tripId}`} className="text-xs whitespace-nowrap text-primary hover:underline">{row.original.tripId}</Link> : <span className="text-xs text-muted-foreground">—</span>) },
    { id: "driver", header: "Driver", accessorFn: (f) => driverById(f.driverId).name, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "odo", header: "Odometer", accessorFn: (f) => f.odometerKm, meta: { align: "right" }, cell: ({ row }) => num(row.original.odometerKm) },
    { id: "liters", header: "Litres", accessorFn: (f) => f.liters, meta: { align: "right" }, cell: ({ row }) => num(row.original.liters) },
    { id: "price", header: "₱/L", accessorFn: (f) => f.pricePerLiter, meta: { align: "right" }, cell: ({ row }) => row.original.pricePerLiter.toFixed(2) },
    { id: "total", header: "Total", accessorFn: (f) => f.totalCost, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.totalCost)}</span> },
    { id: "station", header: "Station / location", accessorFn: (f) => f.station, cell: ({ row }) => <div className="max-w-[220px]"><div className="truncate">{row.original.station}</div><div className="text-xs text-muted-foreground">{areaName(row.original.areaId)}{row.original.fullTank ? " · full tank" : " · top-up"}</div></div> },
    {
      id: "eff",
      header: "km/L",
      accessorFn: (f) => eff.get(f.id) ?? 0,
      meta: { align: "right" },
      cell: ({ row }) => {
        const v = eff.get(row.original.id);
        return v !== undefined ? (
          <span className="font-medium">{v.toFixed(2)}</span>
        ) : (
          <Tip content={row.original.fullTank ? "Needs a previous full-tank fill-up to compute" : "Top-ups are included in the next full-tank figure"}>
            <span className="text-muted-foreground">—</span>
          </Tip>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Fuel Logs"
        description="Diesel fill-ups by truck and trip. Each log also posts a Diesel trip expense."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Log fuel
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Diesel spend (30 days)" value={pesoCompact(sumBy(inWindow, (f) => f.totalCost))} icon={Receipt} hint={`${inWindow.length} fill-ups`} />
        <KPICard label="Litres (30 days)" value={`${num(sumBy(inWindow, (f) => f.liters))} L`} icon={Droplets} />
        <KPICard label="Fuel cost per trip" value={peso(perTrip.length ? sumBy(perTrip, (p) => p.cost) / perTrip.length : 0)} icon={Fuel} hint={`${num(perTrip.length ? sumBy(perTrip, (p) => p.liters) / perTrip.length : 0)} L per trip average`} />
        <KPICard label="Fleet fuel efficiency" value={(() => { const v = [...eff.values()]; return v.length ? `${(sumBy(v, (x) => x) / v.length).toFixed(2)} km/L` : "—"; })()} icon={Gauge} hint="full-to-full method" />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {perTruck.map((p) => (
          <Card key={p.truck.id}>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: p.truck.color }} /> {p.truck.code}
                </CardTitle>
                <CardDescription>{p.truck.make} {p.truck.model}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <LineItem label="Avg efficiency" value={p.avg ? `${p.avg.toFixed(2)} km/L` : "—"} strong />
              <LineItem label="Litres per trip" value={`${num(p.litersPerTrip)} L`} muted />
              <LineItem label="Fuel cost per trip" value={peso(p.costPerTrip)} muted />
              <LineItem label="Last fill-up" value={p.last ? `${fmtDateShort(p.last.date)} · ${num(p.last.odometerKm)} km` : "—"} muted />
              <p className="text-xs text-muted-foreground">Based on {p.samples} full-to-full intervals.</p>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="size-4 text-primary" /> How efficiency is computed
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs text-muted-foreground">
            <p>km/L = distance between two full-tank fill-ups ÷ litres added since the previous full tank (including any top-ups).</p>
            <p>Logs without an earlier full-tank reading show “—” rather than a guessed figure.</p>
            <p className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Always fill to full at the Lucena station after each trip for accurate numbers.</p>
            <DemoRateNote />
          </CardContent>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search trip, station, driver…">
          <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, ...TRUCKS.map((t) => ({ value: t.id, label: t.code }))]} />
        </FilterBar>
        <DataTable columns={columns} data={filtered} search={q} searchText={(f) => `${f.id} ${f.tripId ?? ""} ${f.station} ${driverById(f.driverId).name} ${truckById(f.truckId).code}`} initialSorting={[{ id: "date", desc: true }]} empty={<EmptyState icon={Fuel} title="No fuel logs yet." description="Log the first fill-up to start tracking efficiency." />} />
      </Card>
      {adding && <FuelLogDialog open onOpenChange={setAdding} />}
    </>
  );
}
