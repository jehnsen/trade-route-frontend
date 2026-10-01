"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { Ban, CheckCircle2, ClipboardList, Download, Eye, MoreHorizontal, PackageCheck, Plus, Route, SlidersHorizontal, Timer, Truck, Wallet, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { JobStatus, LogisticsJob, PaymentStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useInvoiceMap } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { AREAS, areaName } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { jobPaymentStatus, jobTotal } from "@/lib/logistics";
import { jobLane } from "@/lib/domain";
import { fmtDateShort, fmtTime, kg, peso, pesoCompact, relativeDay } from "@/lib/format";
import { cn, downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, JOB_SOURCES, PageHeader } from "@/components/shared/common";
import { LegBadge, StatusBadge } from "@/components/shared/status-badge";
import { AssignJobDialog, CancelJobDialog } from "./job-dialogs";
import { RecordPaymentDialog } from "@/features/finance/record-payment-dialog";

interface Row {
  job: LogisticsJob;
  customer: string;
  total: number;
  payment: PaymentStatus;
  truck?: string;
}

const TABS: { value: string; label: string; match: (s: JobStatus) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "inquiry", label: "Inquiries & quoted", match: (s) => s === "Inquiry" || s === "Quoted" },
  { value: "open", label: "Awaiting dispatch", match: (s) => s === "Confirmed" || s === "Awaiting Dispatch" },
  { value: "assigned", label: "Assigned", match: (s) => s === "Assigned" },
  { value: "transit", label: "In transit", match: (s) => s === "In Transit" },
  { value: "done", label: "Delivered", match: (s) => s === "Delivered" || s === "Completed" },
  { value: "cancelled", label: "Cancelled", match: (s) => s === "Cancelled" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const DATE_RANGES: { value: string; label: string; test: (d: string) => boolean }[] = [
  { value: "all", label: "Any pickup date", test: () => true },
  { value: "today", label: "Today (Sep 25)", test: (d) => d === TODAY },
  { value: "tomorrow", label: "Tomorrow (Sep 26)", test: (d) => d === TOMORROW },
  { value: "upcoming", label: "Upcoming", test: (d) => d > TODAY },
  { value: "7d", label: "Last 7 days", test: (d) => d <= TODAY && d > iso(addDays(parseISO(TODAY), -7)) },
  { value: "30d", label: "Last 30 days", test: (d) => d <= TODAY && d > iso(addDays(parseISO(TODAY), -30)) },
];

export function JobsView({ initialTab, initialQ }: { initialTab?: string; initialQ?: string }) {
  const router = useRouter();
  const jobs = useAppStore((s) => s.jobs);
  const trips = useAppStore((s) => s.trips);
  const setStatus = useAppStore((s) => s.setJobStatus);
  const customers = useCustomerMap();
  const invoiceMap = useInvoiceMap();
  const [tab, setTab] = React.useState(initialTab ?? "all");
  const [q, setQ] = React.useState(initialQ ?? "");
  const [range, setRange] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [leg, setLeg] = React.useState("all");
  const [area, setArea] = React.useState("all");
  const [pay, setPay] = React.useState("all");
  const [moreFilters, setMoreFilters] = React.useState(false);
  const [dialog, setDialog] = React.useState<{ kind: "assign" | "cancel" | "pay"; job: LogisticsJob } | null>(null);

  const tripTruck = React.useMemo(() => new Map(trips.map((t) => [t.id, truckById(t.truckId).code])), [trips]);
  const rows: Row[] = React.useMemo(
    () => jobs.map((j) => ({ job: j, customer: customers.get(j.customerId)?.name ?? j.customerId, total: jobTotal(j), payment: jobPaymentStatus(j, invoiceMap.get(j.id)), truck: j.tripId ? tripTruck.get(j.tripId) : undefined })),
    [jobs, customers, invoiceMap, tripTruck],
  );
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const extraCount = [source, area, pay].filter((value) => value !== "all").length;
  const hasFilters = Boolean(q || range !== "all" || leg !== "all" || extraCount || tab !== "all");
  const resetFilters = () => { setQ(""); setRange("all"); setSource("all"); setLeg("all"); setArea("all"); setPay("all"); setTab("all"); };
  const base = rows.filter(
    (r) =>
      DATE_RANGES.find((d) => d.value === range)!.test(r.job.pickupAt.slice(0, 10)) &&
      (source === "all" || r.job.source === source) &&
      (leg === "all" || r.job.leg === leg) &&
      (area === "all" || r.job.dropoff.areaId === area || r.job.pickup.areaId === area) &&
      (pay === "all" || r.payment === pay) &&
      terms.every((term) => `${r.job.id} ${r.customer} ${r.job.cargoDescription} ${r.job.pickup.name} ${r.job.dropoff.name} ${areaName(r.job.pickup.areaId)} ${areaName(r.job.dropoff.areaId)} ${r.job.tripId ?? ""} ${r.job.consignee.name}`.toLowerCase().includes(term)),
  );
  const tabDef = TABS.find((t) => t.value === tab) ?? TABS[0];
  const filtered = base.filter((r) => tabDef.match(r.job.status));

  const awaiting = jobs.filter((j) => (j.status === "Confirmed" || j.status === "Awaiting Dispatch") && !j.tripId);
  const inTransit = jobs.filter((j) => j.status === "In Transit");
  const upcoming = jobs.filter((j) => j.pickupAt.slice(0, 10) >= TODAY && j.status !== "Cancelled" && j.status !== "Inquiry");
  const deliveredWeek = jobs.filter((j) => (j.status === "Delivered" || j.status === "Completed") && (j.deliveredAt ?? "") > iso(addDays(parseISO(TODAY), -7)));

  const jobActions = (row: Row) => {
    const j = row.job;
    const open = j.status === "Confirmed" || j.status === "Awaiting Dispatch" || j.status === "Assigned";
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${j.id}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => router.push(`/jobs/${j.id}`)}>
              <Eye /> View job
            </DropdownMenuItem>
            {(j.status === "Inquiry" || j.status === "Quoted") && (
              <DropdownMenuItem
                onSelect={() => {
                  setStatus(j.id, "Confirmed");
                  toast.success(`${j.id} confirmed`);
                }}
              >
                <CheckCircle2 /> Confirm booking
              </DropdownMenuItem>
            )}
            {open && (
              <DropdownMenuItem onSelect={() => setDialog({ kind: "assign", job: j })}>
                <Truck /> {j.tripId ? "Change trip" : "Assign to trip"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDialog({ kind: "pay", job: j })} disabled={j.status === "Cancelled" || j.status === "Inquiry" || row.payment === "Paid"}>
              <Wallet /> Record payment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!["Inquiry", "Quoted", "Confirmed", "Awaiting Dispatch", "Assigned"].includes(j.status)} onSelect={() => setDialog({ kind: "cancel", job: j })}>
              <Ban /> Cancel job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };
  const tripLabel = (row: Row) => row.job.tripId ? (
    <Link href={`/trips/${row.job.tripId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"><Truck className="size-3" />{row.truck ?? "View trip"}</Link>
  ) : <span className="text-[11px] text-muted-foreground">{["Confirmed", "Awaiting Dispatch", "Assigned"].includes(row.job.status) ? "Awaiting truck" : "No trip assigned"}</span>;
  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "customer", header: "Shipment / customer", accessorFn: (r) => r.customer,
      meta: { headerClassName: "w-[25%]" },
      cell: ({ row: { original: r } }) => <div className="grid gap-1.5">
        <Link href={`/jobs/${r.job.id}`} onClick={(e) => e.stopPropagation()} className="w-fit font-mono text-[11px] font-medium text-primary hover:underline">{r.job.id}</Link>
        <div className="text-[13px] font-semibold leading-relaxed">{r.customer}</div>
        <span className="text-[10px] text-muted-foreground">{r.job.source}</span>
      </div>,
    },
    {
      id: "lane", header: "Route / cargo", accessorFn: (r) => jobLane(r.job),
      meta: { headerClassName: "w-[27%]" },
      cell: ({ row: { original: r } }) => <div className="grid gap-1.5">
        <div className="flex items-start gap-1.5 text-xs font-medium leading-relaxed"><Route className="mt-0.5 size-3.5 shrink-0 text-primary/70" />{jobLane(r.job)}</div>
        <div className="text-[11px] leading-relaxed text-muted-foreground">{r.job.cargoDescription}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><LegBadge leg={r.job.leg} /><span className="text-[10px] text-muted-foreground tabular">{kg(r.job.weightKg)}</span></div>
      </div>,
    },
    {
      id: "pickup", header: "Pickup", accessorFn: (r) => r.job.pickupAt,
      meta: { headerClassName: "w-[14%]" },
      cell: ({ row: { original: r } }) => <div className="grid gap-1 text-xs"><span className="font-medium tabular">{fmtDateShort(r.job.pickupAt)}</span><span className="text-[11px] text-muted-foreground tabular">{fmtTime(r.job.pickupAt)}</span><span className="text-[10px] text-muted-foreground">{relativeDay(r.job.pickupAt.slice(0, 10))}</span></div>,
    },
    {
      id: "total", header: "Freight / payment", accessorFn: (r) => r.total,
      meta: { align: "right", headerClassName: "w-[17%]" },
      cell: ({ row: { original: r } }) => <div className="grid justify-items-end gap-1.5"><span className="text-[13px] font-semibold tabular">{peso(r.total)}</span><StatusBadge status={r.payment} icon={false} className="text-[10px]" /><span className="text-[10px] text-muted-foreground">{r.job.paymentTerms}</span></div>,
    },
    {
      id: "status", header: "Status / trip", accessorFn: (r) => r.job.status,
      meta: { headerClassName: "w-[17%]" },
      cell: ({ row: { original: r } }) => <div className="grid justify-items-start gap-2"><StatusBadge status={r.job.status} className="whitespace-normal text-[10px]" />{tripLabel(r)}</div>,
    },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, meta: { headerClassName: "w-12" }, cell: ({row}) => jobActions(row.original) },
  ];

  const exportCsv = () => {
    downloadCsv(`tradeloop-jobs-${TODAY}.csv`, [
      ["Job No.", "Customer", "Source", "Pickup", "Drop-off", "Cargo", "Weight kg", "Pickup at", "Freight", "Payment", "Status", "Trip"],
      ...filtered.map((r) => [r.job.id, r.customer, r.job.source, r.job.pickup.name, r.job.dropoff.name, r.job.cargoDescription, r.job.weightKg, r.job.pickupAt, r.total, r.payment, r.job.status, r.job.tripId ?? ""]),
    ]);
    toast.success(`Exported ${filtered.length} jobs`, { description: "CSV saved to your downloads." });
  };

  return (
    <div className="jobs-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><ClipboardList className="size-3.5" /> Shipment management</div>
      <PageHeader
        title="Logistics Jobs"
        description="Manage bookings, track cargo, and keep every shipment moving."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                <Plus /> Create job
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <JobMetric label="Awaiting dispatch" value={awaiting.length} icon={Timer} hint={`${kg(sumBy(awaiting, (j) => j.weightKg))} awaiting a truck`} featured href="/dispatch" />
        <JobMetric label="In transit" value={inTransit.length} icon={Truck} hint={`${kg(sumBy(inTransit, (j) => j.weightKg))} on the road`} />
        <JobMetric label="Upcoming freight" value={pesoCompact(sumBy(upcoming, jobTotal))} icon={ClipboardList} hint={`${upcoming.length} jobs from today`} />
        <JobMetric label="Delivered · 7 days" value={deliveredWeek.length} icon={PackageCheck} hint={`${pesoCompact(sumBy(deliveredWeek, jobTotal))} freight value`} />
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList aria-label="Job status" className="jobs-status-tabs h-auto w-full gap-1 rounded-none border-b bg-transparent p-0 pb-3">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value} className="px-3 py-2 text-xs">{t.label}<span className="rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] tabular">{base.filter((r) => t.match(r.job.status)).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="mb-5 overflow-hidden rounded-xl border bg-card">
        <FilterBar search={q} onSearch={setQ} placeholder="Search jobs, customers or cargo…" className="border-0">
          <FilterSelect value={range} onChange={setRange} label="Pickup date" options={DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))} />
          <FilterSelect value={leg} onChange={setLeg} label="Leg" options={[{ value: "all", label: "Both legs" }, { value: "outbound", label: "Outbound" }, { value: "return", label: "Return leg" }]} />
          <Button variant={moreFilters || extraCount ? "secondary" : "outline"} aria-expanded={moreFilters} aria-controls="job-extra-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal /> More filters{extraCount > 0 && <span className="rounded bg-primary/10 px-1.5 text-[10px] tabular">{extraCount}</span>}</Button>
          {hasFilters && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={resetFilters}><X /> Reset</Button>}
        </FilterBar>
        <div id="job-extra-filters" hidden={!moreFilters}>
          <div className="grid gap-3 border-t bg-muted/20 p-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">Booking source<FilterSelect className="w-full" value={source} onChange={setSource} label="Source" options={[{ value: "all", label: "All sources" }, ...JOB_SOURCES.map((s) => ({ value: s, label: s }))]} /></label>
            <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">Service area<FilterSelect className="w-full" value={area} onChange={setArea} label="Area" options={[{ value: "all", label: "All areas" }, ...AREAS.filter((a) => !a.interIsland).map((a) => ({ value: a.id, label: a.name }))]} /></label>
            <label className="grid gap-1.5 text-[10px] font-medium text-muted-foreground">Payment status<FilterSelect className="w-full" value={pay} onChange={setPay} label="Payment" options={[{ value: "all", label: "Any payment" }, ...["Unpaid", "Partial", "Paid", "Credit"].map((p) => ({ value: p, label: p }))]} /></label>
          </div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{tab === "all" ? "All shipments" : tabDef.label}</h2><span aria-live="polite" className="text-[11px] text-muted-foreground">{filtered.length} {filtered.length === 1 ? "job" : "jobs"} · {kg(sumBy(filtered, (r) => r.job.weightKg))} · {pesoCompact(sumBy(filtered, (r) => r.total))} freight</span></div>
      <Card className="overflow-hidden">
        <DataTable
          columns={columns}
          data={filtered}
          className="jobs-register"
          pageSize={10}
          onRowClick={(r) => router.push(`/jobs/${r.job.id}`)}
          initialSorting={[{ id: "pickup", desc: true }]}
          empty={<EmptyState icon={ClipboardList} title="No matching shipments" description="Try another search, status, or pickup date." action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Reset filters</Button> : <Button asChild><Link href="/jobs/new">Create job</Link></Button>} />}
          renderCard={(r) => (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2"><Link href={`/jobs/${r.job.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[11px] font-medium text-primary hover:underline">{r.job.id}</Link>{jobActions(r)}</div>
              <div className="text-sm font-semibold">{r.customer}</div>
              <div className="rounded-lg bg-accent/40 p-3"><div className="flex items-start gap-2 text-xs font-medium"><Route className="mt-0.5 size-3.5 shrink-0 text-primary" />{jobLane(r.job)}</div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{r.job.cargoDescription}</p><div className="mt-2 flex flex-wrap items-center gap-2"><LegBadge leg={r.job.leg} /><span className="text-[10px] text-muted-foreground">{kg(r.job.weightKg)}</span></div></div>
              <div className="flex items-start justify-between gap-2 text-xs"><div><div className="text-[10px] text-muted-foreground">Pickup</div><div className="mt-1">{fmtDateShort(r.job.pickupAt)} · {fmtTime(r.job.pickupAt)}</div></div><div className="grid justify-items-end gap-1"><span className="font-semibold tabular">{peso(r.total)}</span><StatusBadge status={r.payment} icon={false} className="text-[10px]" /></div></div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><StatusBadge status={r.job.status} className="text-[10px]" />{tripLabel(r)}</div>
            </div>
          )}
        />
      </Card>
      {dialog?.kind === "assign" && <AssignJobDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "cancel" && <CancelJobDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "pay" && <RecordPaymentDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
    </div>
  );
}

function JobMetric({ label, value, hint, icon: Icon, featured, href }: { label: string; value: React.ReactNode; hint: string; icon: LucideIcon; featured?: boolean; href?: string }) {
  const content = <><div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div><div className="my-3 text-[30px] leading-none font-semibold tracking-tight tabular">{value}</div><p className="text-[11px] leading-relaxed opacity-75">{hint}</p></>;
  const className = cn("job-list-metric min-w-0 p-4 sm:p-5", featured && "job-list-metric-featured");
  return href ? <Link href={href} className={cn(className, "transition-colors hover:bg-[#2b4b4b]")}>{content}</Link> : <div className={className}>{content}</div>;
}
