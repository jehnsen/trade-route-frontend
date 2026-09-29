"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Eye, MoreHorizontal, Printer, Send, Wallet } from "lucide-react";
import type { Invoice, LogisticsJob } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices } from "@/hooks/use-data";
import { agingBucket, type AgingBucket } from "@/lib/calc";
import { fmtDate, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, MoneyDisplay, PageHeader, EmptyState } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { FilterSelect } from "@/components/shared/common";

export const BUCKETS: { key: AgingBucket; label: string; color: string }[] = [
  { key: "current", label: "Current", color: "var(--chart-1)" },
  { key: "d1_7", label: "1–7 days", color: "var(--chart-4)" },
  { key: "d8_30", label: "8–30 days", color: "var(--chart-2)" },
  { key: "d31_60", label: "31–60 days", color: "var(--chart-8)" },
  { key: "d60p", label: "60+ days", color: "var(--chart-7)" },
];

interface CustRow {
  id: string;
  name: string;
  terms: string;
  total: number;
  aging: Record<AgingBucket, number>;
  oldest?: Invoice;
  overdue: number;
}

export function ReceivablesView() {
  const router = useRouter();
  const jobs = useAppStore((s) => s.jobs);
  const invoices = useInvoices();
  const customers = useCustomerMap();
  const stats = useCustomerStats();
  const [q, setQ] = React.useState("");
  const [bucket, setBucket] = React.useState("all");
  const [payFor, setPayFor] = React.useState<LogisticsJob | null>(null);

  const open = invoices.filter((i) => i.balance > 0);
  const total = sumBy(open, (i) => i.balance);
  const byBucket = Object.fromEntries(BUCKETS.map((b) => [b.key, sumBy(open.filter((i) => agingBucket(i.daysOverdue) === b.key), (i) => i.balance)])) as Record<AgingBucket, number>;

  const custRows: CustRow[] = [...stats.entries()]
    .filter(([, s]) => s.outstanding > 0)
    .map(([id, s]) => {
      const inv = open.filter((i) => i.customerId === id).sort((a, b) => a.issueDate.localeCompare(b.issueDate));
      return { id, name: customers.get(id)!.name, terms: customers.get(id)!.paymentTerms, total: s.outstanding, aging: s.aging, oldest: inv[0], overdue: s.overdue };
    })
    .filter((r) => bucket === "all" || r.aging[bucket as AgingBucket] > 0);

  const remind = (name: string) => toast.success(`Reminder sent to ${name}`, { description: "Statement of account sent via Messenger and SMS (demo)." });

  const custCols: ColumnDef<CustRow, unknown>[] = [
    { id: "name", header: "Customer", accessorFn: (r) => r.name, cell: ({ row }) => <div><Link href={`/customers/${row.original.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.name}</Link><div className="text-xs text-muted-foreground">{row.original.terms}</div></div> },
    { id: "total", header: "Total", accessorFn: (r) => r.total, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.total} className="font-semibold" /> },
    { id: "current", header: "Current", accessorFn: (r) => r.aging.current, meta: { align: "right" }, cell: ({ row }) => <Amt v={row.original.aging.current} /> },
    { id: "d1_7", header: "1–7", accessorFn: (r) => r.aging.d1_7, meta: { align: "right" }, cell: ({ row }) => <Amt v={row.original.aging.d1_7} warn /> },
    { id: "d8_30", header: "8–30", accessorFn: (r) => r.aging.d8_30, meta: { align: "right" }, cell: ({ row }) => <Amt v={row.original.aging.d8_30} danger /> },
    { id: "d31", header: "31+", accessorFn: (r) => r.aging.d31_60 + r.aging.d60p, meta: { align: "right" }, cell: ({ row }) => <Amt v={row.original.aging.d31_60 + row.original.aging.d60p} danger /> },
    { id: "oldest", header: "Oldest invoice", accessorFn: (r) => r.oldest?.issueDate ?? "", cell: ({ row }) => row.original.oldest ? <div className="whitespace-nowrap"><Link href={`/accounts-receivable/${row.original.oldest.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.oldest.id}</Link><div className="text-xs text-muted-foreground">{fmtDate(row.original.oldest.issueDate)}</div></div> : "—" },
    { id: "status", header: "Status", accessorFn: (r) => r.oldest?.daysOverdue ?? 0, cell: ({ row }) => <ReceivableBadge daysOverdue={Math.max(0, ...open.filter((i) => i.customerId === row.original.id).map((i) => i.daysOverdue))} balance={row.original.total} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => row.original.oldest && setPayFor(jobs.find((j) => j.id === row.original.oldest!.jobId)!)}>
                <Wallet /> Record payment (oldest)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => remind(row.original.name)}>
                <Send /> Send reminder
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push(`/customers/${row.original.id}`)}>
                <Eye /> View customer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => row.original.oldest && router.push(`/accounts-receivable/${row.original.oldest.id}?print=1`)}>
                <Printer /> Print statement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const invCols: ColumnDef<Invoice, unknown>[] = [
    { id: "id", header: "Invoice", accessorFn: (i) => i.id, cell: ({ row }) => <Link href={`/accounts-receivable/${row.original.id}`} className="font-medium whitespace-nowrap text-primary hover:underline">{row.original.id}</Link> },
    { id: "cust", header: "Customer", accessorFn: (i) => customers.get(i.customerId)?.name, cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
    { id: "job", header: "Job / trip", accessorFn: (i) => i.jobId, cell: ({ row }) => <div className="text-xs whitespace-nowrap"><Link href={`/jobs/${row.original.jobId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{row.original.jobId}</Link>{row.original.tripId && <div className="text-muted-foreground">{row.original.tripId}</div>}</div> },
    { id: "issue", header: "Issued", accessorFn: (i) => i.issueDate, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.issueDate)}</span> },
    { id: "due", header: "Due", accessorFn: (i) => i.dueDate, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.dueDate)}</span> },
    { id: "total", header: "Amount", accessorFn: (i) => i.total, meta: { align: "right" }, cell: ({ row }) => peso(row.original.total) },
    { id: "paid", header: "Paid", accessorFn: (i) => i.paid, meta: { align: "right" }, cell: ({ row }) => peso(row.original.paid) },
    { id: "bal", header: "Balance", accessorFn: (i) => i.balance, meta: { align: "right" }, cell: ({ row }) => <span className={row.original.daysOverdue ? "font-semibold text-danger" : "font-semibold"}>{peso(row.original.balance)}</span> },
    { id: "aging", header: "Aging", accessorFn: (i) => i.daysOverdue, cell: ({ row }) => <ReceivableBadge daysOverdue={row.original.daysOverdue} balance={row.original.balance} /> },
    { id: "status", header: "Status", accessorFn: (i) => i.status, cell: ({ row }) => <StatusBadge status={row.original.status} icon={false} /> },
  ];

  return (
    <>
      <PageHeader title="Receivables" description="Freight billed on delivered jobs — who owes what, and for how long. Payments recorded anywhere in TradeLoop (driver COD, accounting, job page) reduce these balances immediately." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Card className="col-span-2 gap-1 bg-[oklch(0.25_0.04_220)] p-4 text-white md:col-span-1">
          <div className="text-[13px] text-white/70">Total Outstanding</div>
          <div className="text-2xl font-semibold tabular">{peso(total)}</div>
          <div className="text-xs text-white/70">{open.length} open invoices</div>
        </Card>
        {BUCKETS.map((b) => (
          <button key={b.key} type="button" onClick={() => setBucket(bucket === b.key ? "all" : b.key)} className={`rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 cursor-pointer ${bucket === b.key ? "ring-2 ring-primary/30" : ""}`} aria-pressed={bucket === b.key}>
            <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ background: b.color }} />
              {b.label}
            </div>
            <div className={`mt-1 text-xl font-semibold tabular ${b.key !== "current" && byBucket[b.key] ? "text-danger" : ""}`}>{peso(byBucket[b.key])}</div>
            <div className="text-xs text-muted-foreground">{pct(total ? byBucket[b.key] / total : 0)} of total</div>
          </button>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>Aging distribution</CardTitle>
            <CardDescription>Overdue exposure: {peso(total - byBucket.current)} ({pct(total ? (total - byBucket.current) / total : 0)})</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-5 w-full overflow-hidden rounded-md" role="img" aria-label="Receivables aging distribution">
            {BUCKETS.map((b) => (byBucket[b.key] ? <div key={b.key} style={{ width: `${(byBucket[b.key] / total) * 100}%`, background: b.color }} className="h-full border-r-2 border-card last:border-r-0" title={`${b.label}: ${peso(byBucket[b.key])}`} /> : null))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {BUCKETS.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: b.color }} /> {b.label} · {pesoCompact(byBucket[b.key])}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="customers" className="mt-4">
        <TabsList>
          <TabsTrigger value="customers">Customer aging ({custRows.length})</TabsTrigger>
          <TabsTrigger value="invoices">Open invoices ({open.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="customers">
          <Card className="overflow-hidden">
            <FilterBar search={q} onSearch={setQ} placeholder="Search customer…">
              <FilterSelect value={bucket} onChange={setBucket} label="Aging bucket" options={[{ value: "all", label: "All buckets" }, ...BUCKETS.map((b) => ({ value: b.key, label: b.label }))]} />
            </FilterBar>
            <DataTable
              columns={custCols}
              data={custRows}
              search={q}
              searchText={(r) => r.name}
              initialSorting={[{ id: "total", desc: true }]}
              onRowClick={(r) => router.push(`/customers/${r.id}`)}
              empty={<EmptyState title="No overdue receivables." />}
              renderCard={(r) => (
                <div className="grid gap-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="font-semibold tabular">{peso(r.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.terms}</span>
                    {r.overdue > 0 ? <span className="font-medium text-danger">{peso(r.overdue)} overdue</span> : <span>Current</span>}
                  </div>
                </div>
              )}
            />
          </Card>
        </TabsContent>
        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <DataTable columns={invCols} data={open.filter((i) => bucket === "all" || agingBucket(i.daysOverdue) === bucket)} initialSorting={[{ id: "aging", desc: true }]} onRowClick={(i) => router.push(`/accounts-receivable/${i.id}`)} empty={<EmptyState title="No open invoices." />} />
          </Card>
        </TabsContent>
      </Tabs>
      {payFor && <RecordPaymentDialog job={payFor} open onOpenChange={(v) => !v && setPayFor(null)} />}
    </>
  );
}

function Amt({ v, warn, danger }: { v: number; warn?: boolean; danger?: boolean }) {
  if (!v) return <span className="text-muted-foreground/60">—</span>;
  return <span className={danger ? "text-danger" : warn ? "text-[oklch(0.55_0.13_65)]" : ""}>{peso(v)}</span>;
}
