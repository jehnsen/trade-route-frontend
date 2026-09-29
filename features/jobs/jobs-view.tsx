"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { Ban, CheckCircle2, ClipboardList, Download, Eye, MoreHorizontal, PackageCheck, Plus, Timer, Truck, Wallet } from "lucide-react";
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
import { downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, JOB_SOURCES, JobSourceBadge, KPICard, MoneyDisplay, PageHeader } from "@/components/shared/common";
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
  const [dialog, setDialog] = React.useState<{ kind: "assign" | "cancel" | "pay"; job: LogisticsJob } | null>(null);

  const tripTruck = React.useMemo(() => new Map(trips.map((t) => [t.id, truckById(t.truckId).code])), [trips]);
  const rows: Row[] = React.useMemo(
    () => jobs.map((j) => ({ job: j, customer: customers.get(j.customerId)?.name ?? j.customerId, total: jobTotal(j), payment: jobPaymentStatus(j, invoiceMap.get(j.id)), truck: j.tripId ? tripTruck.get(j.tripId) : undefined })),
    [jobs, customers, invoiceMap, tripTruck],
  );
  const base = rows.filter(
    (r) =>
      DATE_RANGES.find((d) => d.value === range)!.test(r.job.pickupAt.slice(0, 10)) &&
      (source === "all" || r.job.source === source) &&
      (leg === "all" || r.job.leg === leg) &&
      (area === "all" || r.job.dropoff.areaId === area || r.job.pickup.areaId === area) &&
      (pay === "all" || r.payment === pay),
  );
  const tabDef = TABS.find((t) => t.value === tab) ?? TABS[0];
  const filtered = base.filter((r) => tabDef.match(r.job.status));

  const awaiting = jobs.filter((j) => (j.status === "Confirmed" || j.status === "Awaiting Dispatch") && !j.tripId);
  const inTransit = jobs.filter((j) => j.status === "In Transit");
  const upcoming = jobs.filter((j) => j.pickupAt.slice(0, 10) >= TODAY && j.status !== "Cancelled" && j.status !== "Inquiry");
  const deliveredWeek = jobs.filter((j) => (j.status === "Delivered" || j.status === "Completed") && (j.deliveredAt ?? "") > iso(addDays(parseISO(TODAY), -7)));

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "id",
      header: "Job No.",
      accessorFn: (r) => r.job.id,
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.job.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.job.id}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      accessorFn: (r) => r.customer,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <div className="truncate font-medium">{row.original.customer}</div>
          {row.original.job.consignee.name && row.original.job.leg === "outbound" && <div className="truncate text-xs text-muted-foreground">to {row.original.job.consignee.name}</div>}
        </div>
      ),
    },
    { id: "source", header: "Source", accessorFn: (r) => r.job.source, cell: ({ row }) => <JobSourceBadge source={row.original.job.source} /> },
    {
      id: "lane",
      header: "Lane",
      accessorFn: (r) => jobLane(r.job),
      cell: ({ row }) => (
        <div className="grid gap-0.5 whitespace-nowrap">
          <span>{jobLane(row.original.job)}</span>
          <LegBadge leg={row.original.job.leg} />
        </div>
      ),
    },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (r) => r.job.weightKg,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <div className="truncate">{row.original.job.cargoDescription}</div>
          <div className="text-xs text-muted-foreground tabular">{kg(row.original.job.weightKg)}</div>
        </div>
      ),
    },
    {
      id: "pickup",
      header: "Pickup",
      accessorFn: (r) => r.job.pickupAt,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {fmtDateShort(row.original.job.pickupAt)} · {fmtTime(row.original.job.pickupAt)}
          <div className="text-xs text-muted-foreground">{relativeDay(row.original.job.pickupAt.slice(0, 10))}</div>
        </div>
      ),
    },
    { id: "total", header: "Freight", accessorFn: (r) => r.total, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.total} className="font-medium" /> },
    {
      id: "payment",
      header: "Payment",
      accessorFn: (r) => r.payment,
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <StatusBadge status={row.original.payment} icon={false} />
          <span className="text-[11px] whitespace-nowrap text-muted-foreground">{row.original.job.paymentTerms}</span>
        </div>
      ),
    },
    { id: "status", header: "Status", accessorFn: (r) => r.job.status, cell: ({ row }) => <StatusBadge status={row.original.job.status} /> },
    {
      id: "trip",
      header: "Trip",
      accessorFn: (r) => r.job.tripId ?? "",
      cell: ({ row }) =>
        row.original.job.tripId ? (
          <Link href={`/trips/${row.original.job.tripId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs whitespace-nowrap hover:underline">
            <Truck className="size-3.5 text-muted-foreground" /> {row.original.truck}
          </Link>
        ) : row.original.job.status === "Cancelled" || row.original.job.status === "Inquiry" || row.original.job.status === "Quoted" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="text-xs font-medium text-[oklch(0.55_0.13_65)]">Unassigned</span>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const j = row.original.job;
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
                <DropdownMenuItem onSelect={() => setDialog({ kind: "pay", job: j })} disabled={j.status === "Cancelled" || j.status === "Inquiry" || row.original.payment === "Paid"}>
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
      },
    },
  ];

  const exportCsv = () => {
    downloadCsv(`tradeloop-jobs-${TODAY}.csv`, [
      ["Job No.", "Customer", "Source", "Pickup", "Drop-off", "Cargo", "Weight kg", "Pickup at", "Freight", "Payment", "Status", "Trip"],
      ...filtered.map((r) => [r.job.id, r.customer, r.job.source, r.job.pickup.name, r.job.dropoff.name, r.job.cargoDescription, r.job.weightKg, r.job.pickupAt, r.total, r.payment, r.job.status, r.job.tripId ?? ""]),
    ]);
    toast.success(`Exported ${filtered.length} jobs`, { description: "CSV saved to your downloads." });
  };

  return (
    <>
      <PageHeader
        title="Logistics Jobs"
        description="Every shipment booked by phone, Messenger, Facebook, sales staff or the portal. A job is the customer's request; trips are the truck movements that carry it."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                <Plus /> Create Job
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Awaiting dispatch" value={awaiting.length} icon={Timer} hint={`${kg(sumBy(awaiting, (j) => j.weightKg))} not yet on a truck`} tone={awaiting.length ? "warning" : "success"} href="/dispatch" />
        <KPICard label="In transit" value={inTransit.length} icon={Truck} hint={`${kg(sumBy(inTransit, (j) => j.weightKg))} on the road`} />
        <KPICard label="Booked freight (upcoming)" value={pesoCompact(sumBy(upcoming, jobTotal))} icon={ClipboardList} hint={`${upcoming.length} jobs from today`} />
        <KPICard label="Delivered (7 days)" value={deliveredWeek.length} icon={PackageCheck} hint={pesoCompact(sumBy(deliveredWeek, jobTotal)) + " billed"} tone="success" />
      </div>
      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3 h-auto flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{base.filter((r) => t.match(r.job.status)).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search job no., customer, cargo, place…">
          <FilterSelect value={range} onChange={setRange} label="Pickup date" options={DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))} />
          <FilterSelect value={leg} onChange={setLeg} label="Leg" options={[{ value: "all", label: "Both legs" }, { value: "outbound", label: "Outbound" }, { value: "return", label: "Return leg" }]} />
          <FilterSelect value={source} onChange={setSource} label="Source" options={[{ value: "all", label: "All sources" }, ...JOB_SOURCES.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={area} onChange={setArea} label="Area" options={[{ value: "all", label: "All areas" }, ...AREAS.filter((a) => !a.interIsland).map((a) => ({ value: a.id, label: a.name }))]} />
          <FilterSelect value={pay} onChange={setPay} label="Payment" options={[{ value: "all", label: "Any payment" }, ...["Unpaid", "Partial", "Paid", "Credit"].map((p) => ({ value: p, label: p }))]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(r) => `${r.job.id} ${r.customer} ${r.job.cargoDescription} ${r.job.pickup.name} ${r.job.dropoff.name} ${areaName(r.job.dropoff.areaId)} ${r.job.tripId ?? ""} ${r.job.consignee.name}`}
          onRowClick={(r) => router.push(`/jobs/${r.job.id}`)}
          initialSorting={[{ id: "pickup", desc: true }]}
          empty={<EmptyState title="No jobs found for the selected filters." description="Clear a filter or pick a different tab." />}
          renderCard={(r) => (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary">{r.job.id}</span>
                <StatusBadge status={r.job.status} />
              </div>
              <div className="font-medium">{r.customer}</div>
              <div className="text-xs text-muted-foreground">
                {jobLane(r.job)} · {fmtDateShort(r.job.pickupAt)} · {r.job.cargoDescription} · {kg(r.job.weightKg)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">{r.truck ? `${r.truck} · ${r.job.tripId}` : <span className="text-[oklch(0.55_0.13_65)]">Unassigned</span>}</span>
                <span className="font-semibold tabular">{peso(r.total)}</span>
              </div>
            </div>
          )}
        />
      </Card>
      {dialog?.kind === "assign" && <AssignJobDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "cancel" && <CancelJobDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "pay" && <RecordPaymentDialog job={dialog.job} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
