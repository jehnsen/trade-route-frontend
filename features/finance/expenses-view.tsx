"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, ArrowUpRight, ChevronDown, Fuel, Gauge, List, Plus, ReceiptText, Route, Truck, Wallet, X, type LucideIcon } from "lucide-react";
import type { Expense, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { truckById, driverById, TRUCKS } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { tripRouteLine } from "@/lib/domain";
import { fmtDate, fmtDateShort, peso, pesoCompact, pct } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { AddExpenseDialog, EXPENSE_CATEGORIES } from "./add-expense-dialog";
import { FuelLogDialog } from "@/features/fleet/fuel-log-dialog";

const WINDOW_START = "2026-08-26";

export function ExpensesView() {
  const expenses = useAppStore((s) => s.expenses);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [view, setView] = React.useState("trips");
  const [q, setQ] = React.useState("");
  const [tripQ, setTripQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [truck, setTruck] = React.useState("all");
  const [selected, setSelected] = React.useState<string>();
  const [showCategories, setShowCategories] = React.useState(false);
  const [dialog, setDialog] = React.useState<{ kind: "expense" | "fuel"; tripId?: string } | null>(null);

  const windowExp = expenses.filter((e) => e.date >= WINDOW_START && e.date <= TODAY);
  const total = sumBy(windowExp, (e) => e.amount);
  const byCat = EXPENSE_CATEGORIES.map((category) => ({ category, value: sumBy(windowExp.filter((e) => e.category === category), (e) => e.amount) })).filter((r) => r.value).sort((a, b) => b.value - a.value);
  const completed = trips.filter((t) => t.status === "Completed");
  const avgCostPerKm = completed.length ? sumBy(completed, (t) => metrics.get(t.id)!.costPerKm) / completed.length : 0;
  const tripTerms = tripQ.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const tripRows = trips.filter((t) => metrics.get(t.id)!.expenses.length > 0 && (truck === "all" || t.truckId === truck) && tripTerms.every((term) => `${t.id} ${tripRouteLine(t)} ${truckById(t.truckId).code} ${driverById(t.driverId).name}`.toLowerCase().includes(term)));
  const expenseRows = expenses.filter((e) => (cat === "all" || e.category === cat) && (truck === "all" || e.truckId === truck) && terms.every((term) => `${e.id} ${e.category} ${e.description} ${e.tripId ?? ""} ${e.paidTo} ${e.receiptRef ?? ""} ${e.truckId ? truckById(e.truckId).code : ""} ${e.driverId ? driverById(e.driverId).name : ""}`.toLowerCase().includes(term)));
  const hasFilters = truck !== "all" || (view === "trips" ? !!tripQ : !!q || cat !== "all");
  const resetFilters = () => { setQ(""); setTripQ(""); setCat("all"); setTruck("all"); };
  const selectedTrip = trips.find((t) => t.id === selected);
  const selectedMetrics = selectedTrip ? metrics.get(selectedTrip.id) : undefined;
  const dialogTrip = trips.find((t) => t.id === dialog?.tripId);
  const viewEntries = (id: string) => { setSelected(undefined); setView("all"); setQ(id); setCat("all"); setTruck("all"); };
  const fuelState = (t: Trip) => metrics.get(t.id)!.dieselLogged
    ? <span className="text-[10px] text-muted-foreground">Fuel logged</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[oklch(0.55_0.13_65)]"><Fuel className="size-3" /> Fuel not logged</span>;
  const tripCols: ColumnDef<Trip, unknown>[] = [
    {
      id: "date", header: "Trip / route", accessorFn: (t) => t.date, meta: { headerClassName: "w-[35%]" },
      cell: ({row: {original: t}}) => <div className="grid gap-1.5"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><Link href={`/trips/${t.id}`} onClick={(e)=>e.stopPropagation()} className="font-mono text-[11px] font-medium text-primary hover:underline">{t.id}</Link><span className="text-[10px] text-muted-foreground">{fmtDateShort(t.date)}</span></div><div className="text-xs font-medium leading-relaxed">{tripRouteLine(t)}</div><StatusBadge status={t.status} className="text-[10px]" /></div>,
    },
    {
      id: "truck", header: "Truck / driver", accessorFn: (t) => truckById(t.truckId).code, meta: { headerClassName: "w-[20%]" },
      cell: ({row: {original: t}}) => <div className="grid gap-1.5"><span className="flex items-center gap-1.5 text-xs font-medium"><Truck className="size-3.5 text-primary/70" />{truckById(t.truckId).code}</span><span className="text-[11px] text-muted-foreground">{driverById(t.driverId).name}</span></div>,
    },
    {
      id: "total", header: "Recorded cost", accessorFn: (t) => metrics.get(t.id)!.expenseTotal, meta: { align: "right", headerClassName: "w-[21%]" },
      cell: ({row: {original: t}}) => <div className="grid justify-items-end gap-1.5"><span className="text-[13px] font-semibold tabular">{peso(metrics.get(t.id)!.expenseTotal)}</span><span className="text-[10px] text-muted-foreground">{metrics.get(t.id)!.expenses.length} {metrics.get(t.id)!.expenses.length === 1 ? "entry" : "entries"}</span>{fuelState(t)}</div>,
    },
    {
      id: "revenue", header: "Freight revenue", accessorFn: (t) => metrics.get(t.id)!.revenue, meta: { align: "right", headerClassName: "w-[24%]" },
      cell: ({row: {original: t}}) => <div className="grid justify-items-end gap-1.5"><span className="text-xs font-medium tabular">{peso(metrics.get(t.id)!.revenue)}</span><span className="text-[10px] text-muted-foreground">{metrics.get(t.id)!.revenue > 0 ? `${pct(metrics.get(t.id)!.expenseTotal / metrics.get(t.id)!.revenue, 1)} spent on recorded costs` : "No freight revenue"}</span></div>,
    },
    { id: "actions", header: () => <span className="sr-only">Cost breakdown</span>, enableSorting: false, meta: { headerClassName: "w-12" }, cell: ({row}) => <Button variant="ghost" size="icon-sm" aria-label={`Cost breakdown for ${row.original.id}`} onClick={()=>setSelected(row.original.id)}><ArrowUpRight /></Button> },
  ];
  const columns: ColumnDef<Expense, unknown>[] = [
    {
      id: "date", header: "Date / category", accessorFn: (e) => e.date, meta: { headerClassName: "w-[19%]" },
      cell: ({row: {original: e}}) => <div className="grid gap-1.5"><span className="text-[11px] text-muted-foreground">{fmtDateShort(e.date)}</span><span className="text-xs font-semibold">{e.category}</span></div>,
    },
    {
      id: "description", header: "Expense / payee", accessorFn: (e) => e.description, meta: { headerClassName: "w-[34%]" },
      cell: ({row: {original: e}}) => <div className="grid gap-1.5"><span className="text-xs font-medium leading-relaxed">{e.description}</span><span className="text-[11px] text-muted-foreground">Paid to {e.paidTo || "—"}</span>{e.receiptRef && <span className="font-mono text-[10px] text-muted-foreground">Ref: {e.receiptRef}</span>}</div>,
    },
    {
      id: "trip", header: "Trip / crew", accessorFn: (e) => e.tripId ?? "", meta: { headerClassName: "w-[30%]" },
      cell: ({row: {original: e}}) => <div className="grid gap-1.5">{e.tripId ? <Link className="w-fit font-mono text-[11px] text-primary hover:underline" href={`/trips/${e.tripId}`}>{e.tripId}</Link> : <span className="text-[11px] text-muted-foreground">Not trip-related</span>}<span className="text-[11px] text-muted-foreground">{[e.truckId && truckById(e.truckId).code,e.driverId && driverById(e.driverId).name].filter(Boolean).join(" · ") || "—"}</span></div>,
    },
    { id: "amount", header: "Amount", accessorFn: (e) => e.amount, meta: { align: "right", headerClassName: "w-[17%]" }, cell: ({row}) => <span className="text-[13px] font-semibold tabular">{peso(row.original.amount)}</span> },
  ];
  const empty = <EmptyState icon={ReceiptText} title="No matching expenses" description="Try another search or clear the filters." action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Reset filters</Button> : <Button onClick={()=>setDialog({kind:"expense"})}><Plus /> Record expense</Button>} />;

  return (
    <div className="expenses-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><Wallet className="size-3.5" /> Fleet operating costs</div>
      <PageHeader title="Trip Expenses" description="Track spending, review trip costs, and keep every expense accounted for." actions={<><Button variant="outline" onClick={()=>setDialog({kind:"fuel"})}><Fuel /> Log fuel</Button><Button onClick={()=>setDialog({kind:"expense"})}><Plus /> Record expense</Button></>} />
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <ExpenseMetric label="Expenses · 30 days" value={pesoCompact(total)} icon={Wallet} hint={`${windowExp.length} recorded entries · all trucks`} featured />
        <ExpenseMetric label="Average cost per trip" value={peso(completed.length ? sumBy(completed,(t)=>metrics.get(t.id)!.expenseTotal)/completed.length : 0)} icon={Route} hint={`${completed.length} completed trips · all time`} />
        <ExpenseMetric label="Diesel share" value={pct(sumBy(windowExp.filter((e)=>e.category==="Diesel"),(e)=>e.amount)/Math.max(1,total))} icon={Fuel} hint="Of recorded expenses · 30 days" href="/fuel-logs" />
        <ExpenseMetric label="Average cost per km" value={peso(avgCostPerKm,true)} icon={Gauge} hint="Completed trips · all time" />
      </div>
      <Tabs value={view} onValueChange={setView}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3 border-b pb-4"><TabsList aria-label="Expense views" className="expenses-view-tabs h-auto gap-1 bg-transparent p-0"><TabsTrigger value="trips" className="px-3 py-2 text-xs"><Route /> Per trip</TabsTrigger><TabsTrigger value="all" className="px-3 py-2 text-xs"><List /> All expenses</TabsTrigger></TabsList><span className="text-[11px] text-muted-foreground">All recorded dates</span></div>
        <div className="rounded-xl border bg-card"><FilterBar search={view === "trips" ? tripQ : q} onSearch={view === "trips" ? setTripQ : setQ} placeholder={view === "trips" ? "Search trip, route or driver…" : "Search expense, trip or payee…"} className="border-0"><FilterSelect value={truck} onChange={setTruck} label="Truck" options={[{value:"all",label:"All trucks"},...TRUCKS.map((t)=>({value:t.id,label:t.code}))]} />{view === "all" && <FilterSelect value={cat} onChange={setCat} label="Category" options={[{value:"all",label:"All categories"},...EXPENSE_CATEGORIES.map((c)=>({value:c,label:c}))]} />}{hasFilters && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={resetFilters}><X /> Reset</Button>}</FilterBar></div>
        <TabsContent value="trips">
          <div className="my-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Trip cost overview</h2><span aria-live="polite" className="text-[11px] text-muted-foreground">{tripRows.length} {tripRows.length === 1 ? "trip" : "trips"} · {pesoCompact(sumBy(tripRows,(t)=>metrics.get(t.id)!.expenseTotal))} recorded</span></div>
          <Card className="overflow-hidden"><DataTable columns={tripCols} data={tripRows} className="expenses-register" pageSize={10} initialSorting={[{id:"date",desc:true}]} onRowClick={(t)=>setSelected(t.id)} empty={empty} renderCard={(t)=><div className="grid gap-3"><div className="flex items-center justify-between gap-2"><Link href={`/trips/${t.id}`} onClick={(e)=>e.stopPropagation()} className="font-mono text-[11px] font-medium text-primary hover:underline">{t.id}</Link><Button variant="ghost" size="icon-sm" aria-label={`Cost breakdown for ${t.id}`} onClick={(e)=>{e.stopPropagation();setSelected(t.id);}}><ArrowUpRight /></Button></div><div className="text-xs font-medium leading-relaxed">{tripRouteLine(t)}</div><div className="text-[11px] text-muted-foreground">{fmtDateShort(t.date)} · {truckById(t.truckId).code} · {driverById(t.driverId).name}</div><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={t.status} className="text-[10px]" />{fuelState(t)}</div><div className="flex items-center justify-between gap-3 border-t pt-3"><span className="text-[11px] text-muted-foreground">Recorded expenses</span><span className="text-sm font-semibold tabular">{peso(metrics.get(t.id)!.expenseTotal)}</span></div></div>} /></Card>
        </TabsContent>
        <TabsContent value="all">
          <div className="my-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Expense ledger</h2><span aria-live="polite" className="text-[11px] text-muted-foreground">{expenseRows.length} {expenseRows.length === 1 ? "entry" : "entries"} · {pesoCompact(sumBy(expenseRows,(e)=>e.amount))} recorded</span></div>
          <Card className="overflow-hidden"><DataTable columns={columns} data={expenseRows} className="expenses-register" pageSize={10} initialSorting={[{id:"date",desc:true}]} empty={empty} renderCard={(e)=><div className="grid gap-3"><div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold">{e.category}</span><span className="text-sm font-semibold tabular">{peso(e.amount)}</span></div><p className="text-xs leading-relaxed">{e.description}</p><div className="text-[11px] text-muted-foreground">{fmtDateShort(e.date)} · Paid to {e.paidTo || "—"}</div>{e.receiptRef && <div className="font-mono text-[10px] text-muted-foreground">Ref: {e.receiptRef}</div>}<div className="grid gap-1 border-t pt-3">{e.tripId ? <Link href={`/trips/${e.tripId}`} className="font-mono text-[11px] text-primary hover:underline">{e.tripId}</Link> : <span className="text-[11px] text-muted-foreground">Not trip-related</span>}<span className="text-[10px] text-muted-foreground">{[e.truckId && truckById(e.truckId).code,e.driverId && driverById(e.driverId).name].filter(Boolean).join(" · ")}</span></div></div>} /></Card>
        </TabsContent>
      </Tabs>
      <Card className="mt-6 p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">Spending by category</h2><p className="mt-1 text-[11px] text-muted-foreground">Last 30 days · all trucks · share of recorded expenses</p></div>{byCat.length > 4 && <Button variant="ghost" size="sm" className="text-xs" aria-expanded={showCategories} aria-controls="expense-category-breakdown" onClick={()=>setShowCategories(!showCategories)}>{showCategories ? "Show top categories" : "Show all categories"}<ChevronDown className={cn(showCategories && "rotate-180")} /></Button>}</div>
        <div id="expense-category-breakdown" className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">{(showCategories ? byCat : byCat.slice(0,4)).map((r)=><div key={r.category}><div className="mb-2 flex items-center justify-between gap-3 text-xs"><span>{r.category}</span><span className="font-semibold tabular">{pesoCompact(r.value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{width:`${total > 0 ? (r.value/total)*100 : 0}%`}} /></div><p className="mt-1.5 text-[10px] text-muted-foreground">{pct(r.value/Math.max(1,total),1)} of total</p></div>)}</div>{byCat.length === 0 && <p className="text-xs text-muted-foreground">No expenses recorded in this period.</p>}
      </Card>
      <Sheet open={!!selectedTrip} onOpenChange={(v)=>!v && setSelected(undefined)}><SheetContent className="admin-shell w-full overflow-y-auto bg-background sm:max-w-xl">{selectedTrip && selectedMetrics && <div className="grid gap-5 p-5 sm:p-6"><div className="border-b pb-5"><div className="ops-eyebrow mb-3">Trip cost breakdown</div><SheetTitle className="pr-6 text-xl tracking-tight">{selectedTrip.id}</SheetTitle><SheetDescription>{fmtDate(selectedTrip.date)} · {truckById(selectedTrip.truckId).code} · {driverById(selectedTrip.driverId).name}</SheetDescription><p className="mt-3 text-xs leading-relaxed">{tripRouteLine(selectedTrip)}</p></div><div className="rounded-xl bg-[#203a3c] p-4 text-white"><div className="text-[11px] text-white/75">Recorded expenses</div><div className="mt-2 text-[28px] font-semibold tracking-tight tabular">{peso(selectedMetrics.expenseTotal)}</div><div className="mt-1 text-xs text-white/75">{selectedMetrics.expenses.length} {selectedMetrics.expenses.length === 1 ? "entry" : "entries"}</div></div><div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-4"><div><div className="text-[11px] text-muted-foreground">Freight revenue</div><div className="mt-1 text-sm font-semibold">{peso(selectedMetrics.revenue)}</div></div><div><div className="text-[11px] text-muted-foreground">Cost per km</div><div className="mt-1 text-sm font-semibold">{peso(selectedMetrics.costPerKm,true)}</div></div><p className="col-span-2 text-[10px] leading-relaxed text-muted-foreground">{selectedMetrics.distanceIsActual ? "Odometer distance" : "Planned distance"}: {selectedMetrics.distanceKm.toLocaleString()} km.{selectedMetrics.estimatedDiesel > 0 && ` Cost per km includes ${peso(selectedMetrics.estimatedDiesel)} estimated diesel; recorded expenses exclude this estimate.`}</p></div>{!selectedMetrics.dieselLogged && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><span className="text-xs text-amber-800">Fuel has not been logged for this trip.</span><Button variant="outline" size="sm" onClick={()=>{setDialog({kind:"fuel",tripId:selectedTrip.id});setSelected(undefined);}}><Fuel /> Log fuel</Button></div>}<div className="rounded-xl border bg-card p-4"><h3 className="mb-3 text-xs font-semibold">Recorded costs by category</h3><dl className="divide-y">{EXPENSE_CATEGORIES.map((category)=>{const amount=sumBy(selectedMetrics.expenses.filter((e)=>e.category===category),(e)=>e.amount);return <div key={category} className="flex items-center justify-between gap-4 py-2.5 text-xs"><dt className={cn(!amount && "text-muted-foreground")}>{category}</dt><dd className="font-medium tabular">{category === "Diesel" && !selectedMetrics.dieselLogged ? "Not logged" : peso(amount)}</dd></div>;})}</dl></div><div className="flex flex-wrap gap-2"><Button onClick={()=>{setDialog({kind:"expense",tripId:selectedTrip.id});setSelected(undefined);}}><Plus /> Record expense</Button><Button variant="outline" onClick={()=>viewEntries(selectedTrip.id)}><List /> View entries</Button><Button variant="ghost" asChild><Link href={`/trips/${selectedTrip.id}`}>Open trip <ArrowRight /></Link></Button></div></div>}</SheetContent></Sheet>
      <AddExpenseDialog key={dialog?.tripId ?? "general"} open={dialog?.kind === "expense"} tripId={dialog?.tripId} onOpenChange={(v)=>!v && setDialog(null)} />
      {dialog?.kind === "fuel" && <FuelLogDialog open tripId={dialog.tripId} truckId={dialogTrip?.truckId} onOpenChange={(v)=>!v && setDialog(null)} />}
    </div>
  );
}

function ExpenseMetric({label,value,hint,icon:Icon,featured,href}:{label:string;value:React.ReactNode;hint:string;icon:LucideIcon;featured?:boolean;href?:string}) {
  const content=<><div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div><div className="my-3 text-[30px] leading-none font-semibold tracking-tight tabular">{value}</div><p className="text-[11px] leading-relaxed opacity-75">{hint}</p></>;
  const className=cn("expense-metric min-w-0 p-4 sm:p-5",featured && "expense-metric-featured");
  return href ? <Link href={href} className={cn(className,"transition-colors hover:bg-accent/40")}>{content}</Link> : <div className={className}>{content}</div>;
}
