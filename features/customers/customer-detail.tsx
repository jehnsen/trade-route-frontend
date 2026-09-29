"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, FileText, MessageCircle, Pause, Phone, Play, Plus, Route, Send, UserRound } from "lucide-react";
import type { FreightQuote, Invoice, LogisticsJob, Payment, StandingOrder } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerStats, useInvoices } from "@/hooks/use-data";
import { productById } from "@/data/products";
import { areaById } from "@/data/areas";
import { staffById } from "@/data/company";
import { frequencyLabel, jobPaymentStatus, jobTotal } from "@/lib/logistics";
import { jobLane } from "@/lib/domain";
import { fmtDate, fmtDateShort, fmtDateTime, kg, peso, pesoCompact, pct, qty } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { AddressDisplay, CapacityBar, EmptyState, JobSourceBadge, KPICard, MoneyDisplay, PageHeader, Stat, Timeline } from "@/components/shared/common";
import { LegBadge, ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { RankedBars, Columns } from "@/components/charts/charts";
import { RecordNotFound } from "@/components/shared/states";
import { quoteStatus, quoteTotal } from "@/features/quotes/quotes-view";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const customer = useAppStore((s) => s.customers.find((c) => c.id === id));
  const jobs = useAppStore((s) => s.jobs);
  const payments = useAppStore((s) => s.payments);
  const quotes = useAppStore((s) => s.quotes);
  const standing = useAppStore((s) => s.standingOrders);
  const setSO = useAppStore((s) => s.setStandingOrderStatus);
  const leads = useAppStore((s) => s.leads);
  const stats = useCustomerStats().get(id);
  const invoices = useInvoices();

  if (!customer || !stats) return <RecordNotFound kind="Customer" id={id} backHref="/customers" backLabel="Back to customers" />;

  const cJobs = jobs.filter((j) => j.customerId === id).sort((a, b) => b.pickupAt.localeCompare(a.pickupAt));
  const live = cJobs.filter((j) => j.status !== "Cancelled" && j.status !== "Inquiry");
  const cInvoices = invoices.filter((i) => i.customerId === id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const invMap = new Map(cInvoices.map((i) => [i.jobId, i]));
  const cPayments = payments.filter((p) => p.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  const cQuotes = quotes.filter((q) => q.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const cStanding = standing.filter((s) => s.customerId === id);
  const sp = staffById(customer.salespersonId);
  const area = areaById(customer.areaId);
  const lead = leads.find((l) => l.convertedCustomerId === id);
  const creditUse = customer.creditLimit ? stats.outstanding / customer.creditLimit : 0;

  const weeks = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].map((start, i, arr) => {
    const end = arr[i + 1] ?? "2026-09-28";
    return { week: `Wk of ${fmtDateShort(start)}`, Freight: sumBy(live.filter((j) => j.pickupAt >= start && j.pickupAt < end && !j.notes?.startsWith("Opening balance")), jobTotal) };
  });
  const lanes = new Map<string, number>();
  const cargo = new Map<string, number>();
  const days = new Array(7).fill(0) as number[];
  for (const j of live) {
    lanes.set(jobLane(j), (lanes.get(jobLane(j)) ?? 0) + 1);
    const key = j.cargoDescription.split(" + ")[0];
    cargo.set(key, (cargo.get(key) ?? 0) + j.weightKg);
    days[new Date(j.pickupAt).getDay()] += 1;
  }
  const busiest = days.map((n, i) => ({ d: WEEKDAYS[i], n })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);

  const jobCols: ColumnDef<LogisticsJob, unknown>[] = [
    { id: "id", header: "Job No.", accessorFn: (j) => j.id, cell: ({ row }) => <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/jobs/${row.original.id}`}>{row.original.id}</Link> },
    { id: "date", header: "Pickup", accessorFn: (j) => j.pickupAt, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.pickupAt)}</span> },
    { id: "lane", header: "Lane", accessorFn: (j) => jobLane(j), cell: ({ row }) => <div className="grid gap-0.5 whitespace-nowrap"><span>{jobLane(row.original)}</span><LegBadge leg={row.original.leg} /></div> },
    { id: "cargo", header: "Cargo", accessorFn: (j) => j.weightKg, cell: ({ row }) => <span className="block max-w-[220px] truncate text-muted-foreground">{row.original.cargoDescription} · {kg(row.original.weightKg)}</span> },
    { id: "source", header: "Source", accessorFn: (j) => j.source, cell: ({ row }) => <JobSourceBadge source={row.original.source} /> },
    { id: "total", header: "Freight", accessorFn: (j) => jobTotal(j), meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={jobTotal(row.original)} /> },
    { id: "pay", header: "Payment", cell: ({ row }) => <StatusBadge status={jobPaymentStatus(row.original, invMap.get(row.original.id))} icon={false} /> },
    { id: "status", header: "Status", accessorFn: (j) => j.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];
  const invCols: ColumnDef<Invoice, unknown>[] = [
    { id: "id", header: "Invoice", accessorFn: (i) => i.id, cell: ({ row }) => <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/accounts-receivable/${row.original.id}`}>{row.original.id}</Link> },
    { id: "job", header: "Job", accessorFn: (i) => i.jobId, cell: ({ row }) => <Link className="text-xs whitespace-nowrap hover:underline" href={`/jobs/${row.original.jobId}`}>{row.original.jobId}</Link> },
    { id: "issue", header: "Issued", accessorFn: (i) => i.issueDate, cell: ({ row }) => fmtDate(row.original.issueDate) },
    { id: "due", header: "Due", accessorFn: (i) => i.dueDate, cell: ({ row }) => fmtDate(row.original.dueDate) },
    { id: "total", header: "Amount", accessorFn: (i) => i.total, meta: { align: "right" }, cell: ({ row }) => peso(row.original.total) },
    { id: "paid", header: "Paid", accessorFn: (i) => i.paid, meta: { align: "right" }, cell: ({ row }) => peso(row.original.paid) },
    { id: "bal", header: "Balance", accessorFn: (i) => i.balance, meta: { align: "right" }, cell: ({ row }) => <span className={row.original.daysOverdue > 0 ? "font-medium text-danger" : "font-medium"}>{peso(row.original.balance)}</span> },
    { id: "aging", header: "Aging", accessorFn: (i) => i.daysOverdue, cell: ({ row }) => <ReceivableBadge daysOverdue={row.original.daysOverdue} balance={row.original.balance} /> },
  ];
  const payCols: ColumnDef<Payment, unknown>[] = [
    { id: "r", header: "Receipt No.", accessorFn: (p) => p.receiptNo, cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.receiptNo}</span> },
    { id: "date", header: "Date", accessorFn: (p) => p.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateTime(row.original.date)}</span> },
    { id: "job", header: "Job", accessorFn: (p) => p.jobId, cell: ({ row }) => <Link className="text-primary hover:underline" href={`/jobs/${row.original.jobId}`}>{row.original.jobId}</Link> },
    { id: "m", header: "Method", accessorFn: (p) => p.method },
    { id: "ref", header: "Reference", accessorFn: (p) => p.reference, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { id: "amt", header: "Amount", accessorFn: (p) => p.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.amount)}</span> },
  ];
  const quoteCols: ColumnDef<FreightQuote, unknown>[] = [
    { id: "id", header: "Quote", accessorFn: (q) => q.id, cell: ({ row }) => <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/quotes?q=${row.original.id}`}>{row.original.id}</Link> },
    { id: "lane", header: "Lane", accessorFn: (q) => jobLane(q), cell: ({ row }) => <span className="whitespace-nowrap">{jobLane(row.original)}</span> },
    { id: "cargo", header: "Cargo", accessorFn: (q) => q.cargoDescription, cell: ({ row }) => <span className="text-muted-foreground">{row.original.cargoDescription} · {kg(row.original.weightKg)}</span> },
    { id: "total", header: "Quoted", accessorFn: (q) => quoteTotal(q), meta: { align: "right" }, cell: ({ row }) => peso(quoteTotal(row.original)) },
    { id: "valid", header: "Valid until", accessorFn: (q) => q.validUntil, cell: ({ row }) => fmtDate(row.original.validUntil) },
    { id: "status", header: "Status", accessorFn: (q) => quoteStatus(q), cell: ({ row }) => <StatusBadge status={quoteStatus(row.original)} /> },
  ];

  const activity = [
    ...cJobs.slice(0, 10).map((j) => ({ at: j.createdAt, title: `Booking ${j.id} — ${jobLane(j)}, ${kg(j.weightKg)}`, meta: `${j.source} · ${j.status} · ${peso(jobTotal(j))}` })),
    ...cPayments.slice(0, 6).map((p) => ({ at: p.date, title: `Payment ${peso(p.amount)} via ${p.method}`, meta: `${p.receiptNo} · ${p.jobId}` })),
    ...cQuotes.map((q) => ({ at: q.createdAt, title: `Quote ${q.id} — ${peso(quoteTotal(q))}`, meta: `${quoteStatus(q)} · ${q.createdBy}` })),
    ...(lead ? lead.activities.map((a) => ({ at: a.at, title: a.note, meta: `Lead ${lead.id} · ${a.by}` })) : []),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 14);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {customer.name} <StatusBadge status={customer.status} icon={false} />
          </span>
        }
        description={`${customer.type} · ${area.name}, ${area.province} · ${customer.id} · customer since ${fmtDate(customer.customerSince)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${customer.contacts[0].phone.replace(/\s/g, "")}`}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("Statement queued", { description: `Statement of account will be sent to ${customer.contacts[0].name} via Messenger/SMS (demo).` })} disabled={!stats.outstanding}>
              <Send /> Send statement
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/quotes?customer=${customer.id}`}>
                <FileText /> New quote
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/jobs/new?customer=${customer.id}`}>
                <ClipboardList /> New job
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Outstanding balance" value={<MoneyDisplay amount={stats.outstanding} />} hint={stats.overdue ? <span className="text-danger">{peso(stats.overdue)} overdue</span> : "Nothing overdue"} tone={stats.overdue ? "danger" : "default"} />
        <KPICard label="Lifetime freight" value={pesoCompact(stats.lifetimeRevenue)} hint="incl. pre-go-live ledger" />
        <KPICard label="Freight, last 30 days" value={pesoCompact(stats.windowRevenue)} hint={`${stats.jobs} jobs · ${kg(stats.kgShipped)}`} />
        <KPICard label="Average job" value={stats.avgJob ? peso(stats.avgJob) : "—"} />
        <KPICard label="Booking frequency" value={frequencyLabel(stats.jobsPerWeek)} hint={busiest.length ? `mostly ${busiest.map((b) => b.d).join(", ")}` : undefined} />
        <KPICard label="Last booking" value={stats.lastJob ? fmtDateShort(stats.lastJob) : "—"} hint={customer.paymentTerms} />
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs">Jobs ({cJobs.length})</TabsTrigger>
            <TabsTrigger value="invoices">Invoices ({cInvoices.filter((i) => i.balance > 0).length} open)</TabsTrigger>
            <TabsTrigger value="payments">Payments ({cPayments.length})</TabsTrigger>
            <TabsTrigger value="quotes">Quotes ({cQuotes.length})</TabsTrigger>
            <TabsTrigger value="activity">Account activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid content-start gap-4 xl:col-span-2">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Freight per week</CardTitle>
                    <CardDescription>Booked jobs since go-live</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Columns data={weeks} xKey="week" series={[{ key: "Freight", name: "Freight" }]} height={200} />
                </CardContent>
              </Card>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Route className="size-4 text-primary" /> Usual lanes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lanes.size ? <RankedBars data={[...lanes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, value]) => ({ label, value }))} valueFormat={(v) => `${v} jobs`} /> : <p className="text-sm text-muted-foreground">No bookings yet.</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Usual cargo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {cargo.size ? <RankedBars data={[...cargo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, value]) => ({ label, value }))} valueFormat={kg} /> : <p className="text-sm text-muted-foreground">No bookings yet.</p>}
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Recent jobs</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/jobs?q=${encodeURIComponent(customer.name)}`)}>
                    All jobs
                  </Button>
                </CardHeader>
                <DataTable columns={jobCols} data={cJobs.slice(0, 6)} pageSize={6} dense onRowClick={(j) => router.push(`/jobs/${j.id}`)} empty={<EmptyState title="No jobs yet" />} />
              </Card>
            </div>
            <div className="grid content-start gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Credit & terms</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Payment terms" value={customer.paymentTerms} />
                    <Stat label="Credit limit" value={customer.creditLimit ? peso(customer.creditLimit) : "Cash / COD only"} />
                  </div>
                  {customer.creditLimit > 0 && <CapacityBar used={stats.outstanding} capacity={customer.creditLimit} label={`Credit used · ${pct(creditUse)}`} showNumbers={false} />}
                  <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
                    {(["current", "d1_7", "d8_30", "d31_60", "d60p"] as const).map((b, i) => (
                      <div key={b} className="rounded-md bg-muted/60 p-1.5">
                        <div className="text-muted-foreground">{["Current", "1–7", "8–30", "31–60", "60+"][i]}</div>
                        <div className={`font-semibold tabular ${i > 1 && stats.aging[b] ? "text-danger" : ""}`}>{pesoCompact(stats.aging[b])}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {customer.contacts.map((c) => (
                    <div key={c.name} className="flex items-start justify-between gap-2">
                      <div className="flex gap-2">
                        <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">
                            {c.name} {c.primary && <Badge variant="teal" className="ml-1">Primary</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.position} · {c.phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" asChild aria-label={`Call ${c.name}`}>
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`}>
                            <Phone />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Message ${c.name}`} onClick={() => toast("Opening Messenger thread (demo)")}>
                          <MessageCircle />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pickup & drop-off points</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {customer.addresses.map((a) => (
                    <AddressDisplay key={a.id} address={a} />
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Stat label="Sales rep" value={sp?.name ?? "—"} sub={sp?.phone} />
                  <Stat label="Lead source" value={customer.leadSource} sub={lead ? `from lead ${lead.id}` : undefined} />
                  <Stat label="Customer since" value={fmtDate(customer.customerSince)} />
                  <Stat label="Freight shipped (30 days)" value={kg(stats.kgShipped)} />
                  {customer.notes && <p className="col-span-2 rounded-md bg-muted/60 p-3 text-sm">{customer.notes}</p>}
                </CardContent>
              </Card>
              {cStanding.length > 0 && (
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarClock className="size-4 text-muted-foreground" /> Standing product orders
                      </CardTitle>
                      <CardDescription>Trading module (Phase 2) — not freight bookings</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    {cStanding.map((so) => (
                      <StandingRow key={so.id} so={so} onStatus={(st) => { setSO(so.id, st); toast.success(`Standing order ${st === "active" ? "resumed" : st}`); }} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="overflow-hidden">
            <DataTable
              columns={jobCols}
              data={cJobs}
              onRowClick={(j) => router.push(`/jobs/${j.id}`)}
              empty={<EmptyState title="No jobs yet" action={<Button asChild size="sm"><Link href={`/jobs/new?customer=${customer.id}`}><Plus /> Book first job</Link></Button>} />}
            />
          </Card>
        </TabsContent>
        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <DataTable columns={invCols} data={cInvoices} initialSorting={[{ id: "bal", desc: true }]} onRowClick={(i) => router.push(`/accounts-receivable/${i.id}`)} empty={<EmptyState title="No invoices yet" description="Freight is invoiced when a job is delivered." />} />
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="overflow-hidden">
            <DataTable columns={payCols} data={cPayments} empty={<EmptyState title="No payments recorded" />} />
          </Card>
        </TabsContent>
        <TabsContent value="quotes">
          <Card className="overflow-hidden">
            <DataTable columns={quoteCols} data={cQuotes} empty={<EmptyState title="No quotes yet" action={<Button asChild size="sm"><Link href={`/quotes?customer=${customer.id}`}><Plus /> New quote</Link></Button>} />} />
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-5">
              <Timeline items={activity.map((a) => ({ title: a.title, meta: a.meta, at: fmtDateTime(a.at), state: "done" }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function StandingRow({ so, onStatus }: { so: StandingOrder; onStatus: (s: StandingOrder["status"]) => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md border p-2.5 text-sm">
      <div>
        <div className="font-medium">
          {so.day} <StatusBadge status={so.status} icon={false} className="ml-1 text-[10px]" />
        </div>
        <div className="text-xs text-muted-foreground">
          {so.lines.map((l) => `${productById(l.productId).localName ?? productById(l.productId).name} ${qty(l.quantity, productById(l.productId).unit)}`).join(" + ")}
        </div>
      </div>
      {so.status === "active" ? (
        <Button size="sm" variant="ghost" onClick={() => onStatus("paused")} aria-label="Pause">
          <Pause />
        </Button>
      ) : so.status === "paused" ? (
        <Button size="sm" variant="ghost" onClick={() => onStatus("active")} aria-label="Resume">
          <Play />
        </Button>
      ) : null}
    </div>
  );
}
