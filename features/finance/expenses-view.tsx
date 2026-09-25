"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Fuel, Plus, Route, Wrench, Wallet } from "lucide-react";
import type { Expense } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { routeById } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { fmtDate, fmtDateShort, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, KPICard, PageHeader } from "@/components/shared/common";
import { RankedBars } from "@/components/charts/charts";
import { FilterSelect } from "@/features/orders/orders-view";
import { AddExpenseDialog, EXPENSE_CATEGORIES } from "./add-expense-dialog";

export function ExpensesView() {
  const expenses = useAppStore((s) => s.expenses);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [adding, setAdding] = React.useState(false);
  const total = sumBy(expenses, (e) => e.amount);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ label: c, value: sumBy(expenses.filter((e) => e.category === c), (e) => e.amount) })).filter((r) => r.value).sort((a, b) => b.value - a.value);
  const tripRows = trips.filter((t) => metrics.get(t.id)!.expenses.length > 0).sort((a, b) => b.departure.localeCompare(a.departure));
  const completed = tripRows.filter((t) => t.status === "Completed");
  const g = (tid: string, cats: string[]) => sumBy(metrics.get(tid)!.expenses.filter((e) => cats.includes(e.category)), (e) => e.amount);

  const columns: ColumnDef<Expense, unknown>[] = [
    { id: "d", header: "Date", accessorFn: (e) => e.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.date)}</span> },
    { id: "c", header: "Category", accessorFn: (e) => e.category, cell: ({ getValue }) => <span className="font-medium whitespace-nowrap">{getValue() as string}</span> },
    { id: "desc", header: "Description", accessorFn: (e) => e.description, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { id: "trip", header: "Trip / truck", accessorFn: (e) => e.tripId ?? e.truckId ?? "", cell: ({ row }) => (row.original.tripId ? <Link className="whitespace-nowrap text-primary hover:underline" href={`/trips/${row.original.tripId}`}>{row.original.tripId}</Link> : row.original.truckId ? truckById(row.original.truckId).code : row.original.orderId ? <Link className="hover:underline" href={`/orders/${row.original.orderId}`}>{row.original.orderId}</Link> : "—") },
    { id: "to", header: "Paid to", accessorFn: (e) => e.paidTo },
    { id: "amt", header: "Amount", accessorFn: (e) => e.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.amount)}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Diesel, tolls, allowances, ice, loading fees and truck maintenance — charged to trips so every trip shows its true contribution."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Record expense
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Expenses (30 days)" value={pesoCompact(total)} icon={Wallet} hint={`${expenses.length} entries`} />
        <KPICard label="Average cost per trip" value={peso(completed.length ? sumBy(completed, (t) => metrics.get(t.id)!.tripCost) / completed.length : 0)} icon={Route} />
        <KPICard label="Diesel share" value={pct(sumBy(expenses.filter((e) => e.category === "Diesel"), (e) => e.amount) / total)} icon={Fuel} hint="of all operating expenses" />
        <KPICard label="Maintenance & repairs" value={pesoCompact(sumBy(expenses.filter((e) => e.category === "Maintenance" || e.category === "Repairs"), (e) => e.amount))} icon={Wrench} href="/trucks" />
      </div>
      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Per trip</TabsTrigger>
          <TabsTrigger value="all">All expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="trips">
          <div className="grid gap-4 xl:grid-cols-4">
            <Card className="overflow-hidden xl:col-span-3">
              <DataTable
                columns={[
                  { id: "t", header: "Trip", accessorFn: (t) => t.id, cell: ({ row }) => <Link href={`/trips/${row.original.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{row.original.id}</Link> },
                  { id: "d", header: "Date", accessorFn: (t) => t.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateShort(row.original.date)}</span> },
                  { id: "r", header: "Route", accessorFn: (t) => routeById(t.routeId).name, cell: ({ row }) => <div className="max-w-[200px] truncate">{truckById(row.original.truckId).code} · {routeById(row.original.routeId).name.replace("Lucena → ", "")}</div> },
                  { id: "diesel", header: "Diesel", accessorFn: (t) => g(t.id, ["Diesel"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
                  { id: "toll", header: "Toll", accessorFn: (t) => g(t.id, ["Toll"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
                  { id: "crew", header: "Allowances & meals", accessorFn: (t) => g(t.id, ["Driver Allowance", "Helper Allowance", "Meals"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
                  { id: "ice", header: "Ice & packaging", accessorFn: (t) => g(t.id, ["Ice", "Packaging"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
                  { id: "other", header: "Loading & other", accessorFn: (t) => g(t.id, ["Loading Fee", "Unloading Fee", "Parking", "Miscellaneous"]), meta: { align: "right" }, cell: ({ getValue }) => peso(getValue() as number) },
                  { id: "total", header: "Total", accessorFn: (t) => metrics.get(t.id)!.tripCost, meta: { align: "right" }, cell: ({ getValue }) => <b>{peso(getValue() as number)}</b> },
                  { id: "share", header: "% of revenue", accessorFn: (t) => metrics.get(t.id)!.tripCost / Math.max(1, metrics.get(t.id)!.revenue), meta: { align: "right" }, cell: ({ getValue }) => pct(getValue() as number, 1) },
                ]}
                data={tripRows}
                initialSorting={[{ id: "d", desc: true }]}
              />
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
            </FilterBar>
            <DataTable columns={columns} data={expenses.filter((e) => cat === "all" || e.category === cat)} search={q} searchText={(e) => `${e.category} ${e.description} ${e.tripId ?? ""} ${e.paidTo}`} initialSorting={[{ id: "d", desc: true }]} />
          </Card>
        </TabsContent>
      </Tabs>
      <AddExpenseDialog open={adding} onOpenChange={setAdding} trips={trips.filter((t) => t.date >= "2026-09-20").map((t) => ({ id: t.id, label: `${t.id} · ${truckById(t.truckId).code}` }))} />
    </>
  );
}
