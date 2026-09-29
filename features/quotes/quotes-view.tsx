"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FileText, Handshake, Plus, Send, XCircle } from "lucide-react";
import type { FreightQuote, QuoteStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { areaName } from "@/data/areas";
import { daysAgo, fmtDate, fmtDateShort, fmtDateTime, kg, peso, pct, pesoCompact } from "@/lib/format";
import { jobLane } from "@/lib/domain";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Separator, Textarea } from "@/components/ui/primitives";
import { Field, Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, KPICard, LineItem, MoneyDisplay, PageHeader, Stat } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { QuoteFormDialog } from "./quote-form";

/** Sent quotes past their validity date are shown as Expired. */
export const quoteStatus = (q: FreightQuote): QuoteStatus => (q.status === "Sent" && q.validUntil < TODAY ? "Expired" : q.status);
export const quoteTotal = (q: FreightQuote) => q.freightCharge + sumBy(q.additionalCharges, (c) => c.amount);

const TABS: { value: string; label: string; match: (s: QuoteStatus) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "Draft", label: "Draft", match: (s) => s === "Draft" },
  { value: "Sent", label: "Sent", match: (s) => s === "Sent" },
  { value: "Accepted", label: "Accepted", match: (s) => s === "Accepted" },
  { value: "Rejected", label: "Rejected", match: (s) => s === "Rejected" },
  { value: "Expired", label: "Expired", match: (s) => s === "Expired" },
];

export function QuotesView({ initialQ, newForLead, newForCustomer }: { initialQ?: string; newForLead?: string; newForCustomer?: string }) {
  const quotes = useAppStore((s) => s.quotes);
  const customers = useAppStore((s) => s.customers);
  const leads = useAppStore((s) => s.leads);
  const [tab, setTab] = React.useState("all");
  const [q, setQ] = React.useState(initialQ ?? "");
  const [creating, setCreating] = React.useState(!!(newForLead || newForCustomer));
  const [selected, setSelected] = React.useState<string | null>(initialQ && quotes.some((x) => x.id === initialQ) ? initialQ : null);

  const partyName = React.useCallback((x: FreightQuote) => (x.customerId ? customers.find((c) => c.id === x.customerId)?.name : leads.find((l) => l.id === x.leadId)?.businessName) ?? "—", [customers, leads]);
  const rows = quotes.map((x) => ({ quote: x, status: quoteStatus(x), party: partyName(x), total: quoteTotal(x) }));
  const filtered = rows.filter((r) => (TABS.find((t) => t.value === tab) ?? TABS[0]).match(r.status));

  const open = rows.filter((r) => r.status === "Sent");
  const acceptedNoJob = rows.filter((r) => r.status === "Accepted" && !r.quote.jobId);
  const decided = rows.filter((r) => ["Accepted", "Rejected", "Expired"].includes(r.status));
  const won = decided.filter((r) => r.status === "Accepted");

  const columns: ColumnDef<(typeof rows)[number], unknown>[] = [
    { id: "id", header: "Quote No.", accessorFn: (r) => r.quote.id, cell: ({ row }) => <span className="font-medium whitespace-nowrap text-primary">{row.original.quote.id}</span> },
    {
      id: "party",
      header: "Customer / lead",
      accessorFn: (r) => r.party,
      cell: ({ row }) => (
        <div className="max-w-[210px]">
          <div className="truncate font-medium">{row.original.party}</div>
          <div className="text-xs text-muted-foreground">{row.original.quote.customerId ? "Customer" : "Lead"}</div>
        </div>
      ),
    },
    { id: "lane", header: "Lane", accessorFn: (r) => jobLane(r.quote), cell: ({ row }) => <span className="whitespace-nowrap">{jobLane(row.original.quote)}</span> },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (r) => r.quote.weightKg,
      cell: ({ row }) => (
        <div className="max-w-[180px]">
          <div className="truncate">{row.original.quote.cargoDescription}</div>
          <div className="text-xs text-muted-foreground tabular">{kg(row.original.quote.weightKg)}</div>
        </div>
      ),
    },
    { id: "pickup", header: "Pickup", accessorFn: (r) => r.quote.pickupDate, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateShort(row.original.quote.pickupDate)}</span> },
    { id: "total", header: "Quoted", accessorFn: (r) => r.total, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.total} className="font-medium" /> },
    {
      id: "valid",
      header: "Valid until",
      accessorFn: (r) => r.quote.validUntil,
      cell: ({ row }) => {
        const d = -daysAgo(row.original.quote.validUntil);
        return (
          <div className="whitespace-nowrap">
            {fmtDateShort(row.original.quote.validUntil)}
            {row.original.status === "Sent" && d <= 2 && <div className="text-xs font-medium text-[oklch(0.55_0.13_65)]">{d === 0 ? "Expires today" : `${d} day${d > 1 ? "s" : ""} left`}</div>}
          </div>
        );
      },
    },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "job",
      header: "Job",
      accessorFn: (r) => r.quote.jobId ?? "",
      cell: ({ row }) =>
        row.original.quote.jobId ? (
          <Link href={`/jobs/${row.original.quote.jobId}`} className="text-xs whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.original.quote.jobId}
          </Link>
        ) : row.original.status === "Accepted" ? (
          <span className="text-xs font-medium text-[oklch(0.55_0.13_65)]">Create job</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Freight quotations for customers and leads. Accepted quotes convert into logistics jobs in one click."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> New quote
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Open quotes (sent)" value={pesoCompact(sumBy(open, (r) => r.total))} icon={Send} hint={`${open.length} awaiting customer reply`} />
        <KPICard label="Accepted — job not created" value={acceptedNoJob.length} icon={Handshake} hint={acceptedNoJob.length ? "Convert to jobs so dispatch can plan them" : "All accepted quotes converted"} tone={acceptedNoJob.length ? "warning" : "success"} />
        <KPICard label="Win rate" value={pct(won.length / Math.max(1, decided.length))} icon={CheckCircle2} hint={`${won.length} of ${decided.length} decided quotes`} />
        <KPICard label="Expiring in 2 days" value={open.filter((r) => -daysAgo(r.quote.validUntil) <= 2).length} icon={CalendarClock} hint="Follow up before they lapse" />
      </div>
      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3 h-auto flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{rows.filter((r) => t.match(r.status)).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search quote no., customer, lead, cargo…" />
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(r) => `${r.quote.id} ${r.party} ${r.quote.cargoDescription} ${r.quote.pickup.name} ${r.quote.dropoff.name} ${areaName(r.quote.dropoff.areaId)}`}
          onRowClick={(r) => setSelected(r.quote.id)}
          initialSorting={[{ id: "id", desc: true }]}
          empty={<EmptyState icon={FileText} title="No quotes in this view." description="Create a quote from a lead or customer inquiry." />}
          renderCard={(r) => (
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">{r.quote.id}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="font-medium">{r.party}</div>
              <div className="text-xs text-muted-foreground">
                {jobLane(r.quote)} · {r.quote.cargoDescription} · {kg(r.quote.weightKg)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-xs text-muted-foreground">Valid to {fmtDateShort(r.quote.validUntil)}</span>
                <span className="font-semibold tabular">{peso(r.total)}</span>
              </div>
            </div>
          )}
        />
      </Card>
      <QuoteFormDialog open={creating} onOpenChange={setCreating} initialParty={newForLead ?? newForCustomer} onCreated={setSelected} />
      <QuoteSheet id={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function QuoteSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const router = useRouter();
  const quote = useAppStore((s) => s.quotes.find((x) => x.id === id));
  const customer = useAppStore((s) => s.customers.find((c) => c.id === quote?.customerId));
  const lead = useAppStore((s) => s.leads.find((l) => l.id === quote?.leadId));
  const setStatus = useAppStore((s) => s.setQuoteStatus);
  const convert = useAppStore((s) => s.convertQuoteToJob);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    setRejecting(false);
    setReason("");
  }, [id]);
  const status = quote ? quoteStatus(quote) : undefined;
  return (
    <Sheet open={!!quote} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {quote && status && (
          <div className="grid gap-4 p-5">
            <div>
              <SheetTitle className="flex items-center gap-2">
                {quote.id} <StatusBadge status={status} />
              </SheetTitle>
              <SheetDescription>
                {customer ? (
                  <Link href={`/customers/${customer.id}`} className="hover:underline">
                    {customer.name}
                  </Link>
                ) : (
                  <>Lead: {lead?.businessName}</>
                )}{" "}
                · created {fmtDateTime(quote.createdAt)} by {quote.createdBy}
              </SheetDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Pickup" value={quote.pickup.name} sub={fmtDate(quote.pickupDate)} className="col-span-2" />
              <Stat label="Drop-off" value={quote.dropoff.name} sub={`Required ${fmtDate(quote.requiredDate)}`} className="col-span-2" />
              <Stat label="Cargo" value={quote.cargoDescription} sub={`${quote.cargoCategory} · ${kg(quote.weightKg)}`} />
              <Stat label="Truck" value={quote.truckRequirement} />
            </div>
            <div className="grid gap-1.5 rounded-lg border p-3 text-sm">
              <LineItem label="Freight" value={peso(quote.freightCharge)} />
              {quote.additionalCharges.map((c) => (
                <LineItem key={c.label} label={c.label} value={peso(c.amount)} muted />
              ))}
              <Separator className="my-1" />
              <LineItem label="Total quoted" value={peso(quoteTotal(quote))} strong />
              <div className="text-xs text-muted-foreground">Valid until {fmtDate(quote.validUntil)}</div>
            </div>
            {quote.notes && <div className="rounded-md bg-muted/60 px-3 py-2 text-sm">{quote.notes}</div>}
            {quote.rejectReason && <div className="rounded-md bg-danger-soft px-3 py-2 text-sm">Rejected: {quote.rejectReason}</div>}
            {quote.jobId && (
              <Button variant="outline" asChild>
                <Link href={`/jobs/${quote.jobId}`}>
                  <ClipboardList /> Open {quote.jobId} <ArrowRight />
                </Link>
              </Button>
            )}
            {rejecting ? (
              <div className="grid gap-2">
                <Field label="Why did the customer reject?" htmlFor="rej">
                  <Textarea id="rej" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Found a cheaper hauler" />
                </Field>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRejecting(false)}>
                    Back
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={reason.trim().length < 3}
                    onClick={() => {
                      setStatus(quote.id, "Rejected", reason.trim());
                      toast(`${quote.id} marked rejected`);
                      setRejecting(false);
                    }}
                  >
                    <XCircle /> Mark rejected
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                {status === "Draft" && (
                  <Button
                    onClick={() => {
                      setStatus(quote.id, "Sent");
                      toast.success(`${quote.id} marked as sent`);
                    }}
                  >
                    <Send /> Mark as sent
                  </Button>
                )}
                {(status === "Sent" || status === "Expired") && (
                  <Button
                    onClick={() => {
                      setStatus(quote.id, "Accepted");
                      toast.success(`${quote.id} accepted`, { description: "Create the job so dispatch can plan it." });
                    }}
                  >
                    <Handshake /> Customer accepted
                  </Button>
                )}
                {status === "Accepted" && !quote.jobId && (
                  <Button
                    onClick={() => {
                      const jobId = convert(quote.id);
                      toast.success(`Job ${jobId} created from ${quote.id}`, { description: lead ? `${lead.businessName} converted to a customer.` : "It now appears on the Dispatch board." });
                      router.push(`/jobs/${jobId}`);
                    }}
                  >
                    <ClipboardList /> Create logistics job
                  </Button>
                )}
                {(status === "Sent" || status === "Draft") && (
                  <Button variant="ghost" className="text-danger" onClick={() => setRejecting(true)}>
                    <XCircle /> Customer rejected
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
