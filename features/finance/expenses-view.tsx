"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Fuel, Gauge, Plus, Route, Wallet } from "lucide-react";
import type { Expense, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { truckById, driverById, TRUCKS } from "@/data/fleet";
import { tripRouteLine } from "@/lib/domain";
import { fmtDate, fmtDateShort, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, KPICard, PageHeader } from "@/components/shared/common";
import { RankedBars } from "@/components/charts/charts";
import { AddExpenseDialog, EXPENSE_CATEGORIES } from "./add-expense-dialog";
import { FuelLogDialog } from "@/features/fleet/fuel-log-dialog";

const WINDOW_START = "2026-08-26";

export function ExpensesView() {
  const expenses = useAppStore((s) => s.expenses);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [truck, setTruck] = React.useState("all");
  const [dialog, setDialog] = React.useState<"expense" | "fuel" | null>(null);

  const windowExp = expenses.filter((e) => e.date >= WINDOW_START);
  const total = sumBy(windowExp, (e) => e.amount);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumBy(windowExp.filter((e) => e.category === c), (e) => e.amount) })).filter((r) => r.value).sort((a, b) => b.value - a.value);
  const tripRows = trips.filter((t) => metrics.get(t.id)!.expenses.length > 0 && (truck === "all" || t.truckId === truck)).sort((a, b) => b.departure.localeCompare(a.departure));
  const completed = trips.filter((t) => t.status === "Completed");
  const g = (tid: string, cats: string[]) => sumBy(metrics.get(tid)!.expenses.filter((e) => cats.includes(e.category)), (e) => e.amount);
  const avgCostPerKm = completed.length ? sumBy(completed, (t) => metrics.get(t.id)!.costPerKm) / completed.length : 0;

  const tripCols: ColumnDef<Trip, unknown>[] = [
    { id: "t", header: "Trip", accessorFn: (t) => t.id, cell: ({ row }) => <Link href={`/trips/${row.original.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{row.original.id}</Link> },
    { id: "d", header: "Date", accessorFn: (t) => t.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateShort(row.original.date)}</span> },
    { id: "r", header: "Truck / route", accessorFn: (t) => tripRouteLine(t), cell: ({ row }) => <div className="max-w-[220px] truncate">{truckById(row.original.truckId).code} · {tripRouteLine(row.original).replace("Lucena → ", "")}</div> },
    { id: "diesel", header: "Diesel", accessorFn: (t) => g(t.id, ["Diesel"]), meta: { align: "right" }, cell: ({ row, getValue }) => (metrics.get(row.original.id)!.dieselLogged ? peso(getValue() as number) : <span className="text-muted-foreground">not logged</span>) },
    { id: "toll", header: "Toll", accessorFn: (t) => g(t.id, ["Toll"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
    { id: "crew", header: "Allowances & meals", accessorFn: (t) => g(t.id, ["Driver Allowance", "Helper Allowance", "Meals"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
    { id: "handling", header: "Loading & unloading", accessorFn: (t) => g(t.id, ["Loading Fee", "Unloading Fee", "Parking"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
    { id: "other", header: "Port, repair & other", accessorFn: (t) => g(t.id, ["Port Fee", "Repair", "Other"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
    { id: "total", header: "Total", accessorFn: (t) => metrics.get(t.id)!.expenseTotal, meta: { align: "right" }, cell: ({ getValue }) => <b>{peso(getValue() as number)}</b> },
    { id: "rev", header: "Revenue", accessorFn: (t) => metrics.get(t.id)!.revenue, meta: { align: "right" }, cell: ({ getValue }) => <span className="text-muted-foreground">{pesoCompact(getValue() as number)}</span> },
    { id: "km", header: "Cost / km", accessorFn: (t) => metrics.get(t.id)!.costPerKm, meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number, true) },
    { id: "share", header: "% of revenue", accessorFn: (t) => metrics.get(t.id)!.expenseTotal / Math.max(1, metrics.get(t.id)!.revenue), meta: { align: "right" }, cell: ({ getValue }) => pct(getValue() as number, 1) },
  ];

  const columns: ColumnDef<Expense, unknown>[] = [
    { id: "d", header: "Date", accessorFn: (e) => e.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.date)}</span> },
    { id: "c", header: "Category", accessorFn: (e) => e.category, cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue() as string}</span> },
    { id: "desc", header: "Description", accessorFn: (e) => e.description, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { id: "trip", header: "Trip", accessorFn: (e) => e.tripId ?? "", cell: ({ row }) => (row.original.tripId ? <Link className="whitespace-nowrap text-primary hover:underline" href={`/trips/${row.original.tripId}`}>{row.original.tripId}</Link> : "—") },
    { id: "truck", header: "Truck", accessorFn: (e) => (e.truckId ? truckById(e.truckId).code : ""), cell: ({ getValue }) => <span className="whitespace-nowrap">{(getValue() as string) || "—"}</span> },
    { id: "driver", header: "Driver", accessorFn: (e) => (e.driverId ? driverById(e.driverId).name : ""), cell: ({ getValue }) => <span className="whitespace-nowrap">{(getValue() as string) || "—"}</span> },
    { id: "to", header: "Paid to", accessorFn: (e) => e.paidTo },
    { id: "amt", header: "Amount", accessorFn: (e) => e.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.amount)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Trip Expenses"
        description="Diesel, tolls, allowances, meals, parking, loading and port fees — each charged to a trip, truck and driver so every trip shows its true contribution."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog("fuel")}>
              <Fuel /> Log fuel
            </Button>
            <Button onClick={() => setDialog("expense")}>
              <Plus /> Record expense
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Trip expenses (30 days)" value={pesoCompact(total)} icon={Wallet} hint={`${windowExp.length} entries`} />
        <KPICard label="Average expense per trip" value={peso(completed.length ? sumBy(completed, (t) => metrics.get(t.id)!.expenseTotal) / completed.length : 0)} icon={Route} hint={`${completed.length} completed trips`} />
        <KPICard label="Diesel share" value={pct(sumBy(windowExp.filter((e) => e.category === "Diesel"), (e) => e.amount) / Math.max(1, total))} icon={Fuel} hint="of trip expenses" href="/fuel-logs" />
        <KPICard label="Average cost per km" value={peso(avgCostPerKm, true)} icon={Gauge} hint="odometer distance, completed trips" />
      </div>
      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Per trip</TabsTrigger>
          <TabsTrigger value="all">All expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="trips">
          <div className="grid gap-4 xl:grid-cols-4">
            <Card className="overflow-hidden xl:col-span-3">
              <FilterBar>
                <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, ...TRUCKS.map((t) => ({ value: t.id, label: t.code }))]} />
              </FilterBar>
              <DataTable columns={tripCols} data={tripRows} initialSorting={[{ id: "d", desc: true }]} onRowClick={undefined} empty={<EmptyState title="No trip expenses recorded." />} />
            </Card>
            <Card className="content-start">
              <CardHeader>
                <div>
                  <CardTitle>By category</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <RankedBars data={byCat} valueFormat={pesoCompact} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="all">
          <Card className="overflow-hidden">
            <FilterBar search={q} onSearch={setQ} placeholder="Search description, trip, payee…">
              <FilterSelect value={cat} onChange={setCat} label="Category" options={[{ value: "all", label: "All categories" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
              <FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{ value: "all", label: "Both trucks" }, ...TRUCKS.map((t) => ({ value: t.id, label: t.code }))]} />
            </FilterBar>
            <DataTable
              columns={columns}
              data={expenses.filter((e) => (cat === "all" || e.category === cat) && (truck === "all" || e.truckId === truck))}
              search={q}
              searchText={(e) => `${e.category} ${e.description} ${e.tripId ?? ""} ${e.paidTo}`}
              initialSorting={[{ id: "d", desc: true }]}
              empty={<EmptyState title="No expenses match these filters." />}
              renderCard={(e) => (
                <div className="grid gap-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{e.category}</span>
                    <span className="font-semibold tabular">{peso(e.amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDateShort(e.date)} · {e.tripId ?? "no trip"} · {e.description}
                  </div>
                </div>
              )}
            />
          </Card>
        </TabsContent>
      </Tabs>
      <AddExpenseDialog open={dialog === "expense"} onOpenChange={(v) => setDialog(v ? "expense" : null)} />
      {dialog === "fuel" && <FuelLogDialog open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
