"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, Route, X, type LucideIcon, CalendarClock, CheckCircle2, ClipboardList, FileText, Handshake, Plus, Send, XCircle } from "lucide-react";
import type { FreightQuote, QuoteStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { areaName } from "@/data/areas";
import { daysAgo, fmtDate, fmtDateShort, fmtDateTime, kg, peso, pct, pesoCompact } from "@/lib/format";
import { jobLane } from "@/lib/domain";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Separator, Textarea } from "@/components/ui/primitives";
import { Field, Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, LineItem, PageHeader, Stat } from "@/components/shared/common";
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
  const [partyType, setPartyType] = React.useState("all");
  const [attention, setAttention] = React.useState("all");
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const base = rows.filter((r) =>
    (partyType === "all" || (partyType === "customer" ? !!r.quote.customerId : !r.quote.customerId)) &&
    (attention === "all" || (attention === "expiring" ? r.status === "Sent" && -daysAgo(r.quote.validUntil) <= 2 : r.status === "Accepted" && !r.quote.jobId)) &&
    terms.every((term) => `${r.quote.id} ${r.party} ${r.quote.cargoDescription} ${r.quote.pickup.name} ${r.quote.dropoff.name} ${areaName(r.quote.pickup.areaId)} ${areaName(r.quote.dropoff.areaId)} ${r.quote.jobId ?? ""}`.toLowerCase().includes(term)),
  );
  const tabDef = TABS.find((t) => t.value === tab) ?? TABS[0];
  const filtered = base.filter((r) => tabDef.match(r.status));
  const hasFilters = Boolean(q || tab !== "all" || partyType !== "all" || attention !== "all");
  const resetFilters = () => { setQ(""); setTab("all"); setPartyType("all"); setAttention("all"); };

  const open = rows.filter((r) => r.status === "Sent");
  const acceptedNoJob = rows.filter((r) => r.status === "Accepted" && !r.quote.jobId);
  const decided = rows.filter((r) => ["Accepted", "Rejected", "Expired"].includes(r.status));
  const won = decided.filter((r) => r.status === "Accepted");

  const nextStep = (r: (typeof rows)[number]) => r.quote.jobId ? (
    <Link href={`/jobs/${r.quote.jobId}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">View job <ArrowUpRight className="size-3" /><span className="sr-only">{r.quote.jobId}</span></Link>
  ) : r.status === "Accepted" ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(r.quote.id); }} className="cursor-pointer text-left text-[11px] font-medium text-primary hover:underline">Create job →</button>
  ) : <span className="text-[10px] text-muted-foreground">{r.status === "Draft" ? "Ready to send" : r.status === "Sent" ? "Awaiting reply" : r.status === "Expired" ? "Validity ended" : "Not proceeding"}</span>;
  const columns: ColumnDef<(typeof rows)[number], unknown>[] = [
    {
      id: "id", header: "Quote / customer", accessorFn: (r) => r.quote.id, meta: { headerClassName: "w-[27%]" },
      cell: ({row: {original: r}}) => <div className="grid gap-1.5"><button type="button" onClick={(e) => {e.stopPropagation();setSelected(r.quote.id);}} className="w-fit cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline">{r.quote.id}</button><div className="text-[13px] font-semibold leading-relaxed">{r.party}</div><span className="text-[10px] text-muted-foreground">{r.quote.customerId ? "Customer" : "Lead"}</span></div>,
    },
    {
      id: "lane", header: "Route / cargo", accessorFn: (r) => jobLane(r.quote), meta: { headerClassName: "w-[27%]" },
      cell: ({row: {original: r}}) => <div className="grid gap-1.5"><div className="flex items-start gap-1.5 text-xs font-medium leading-relaxed"><Route className="mt-0.5 size-3.5 shrink-0 text-primary/70" />{jobLane(r.quote)}</div><p className="text-[11px] leading-relaxed text-muted-foreground">{r.quote.cargoDescription}</p><span className="text-[10px] text-muted-foreground tabular">{kg(r.quote.weightKg)}</span></div>,
    },
    {
      id: "pickup", header: "Pickup", accessorFn: (r) => r.quote.pickupDate, meta: { headerClassName: "w-[12%]" },
      cell: ({row: {original: r}}) => <span className="text-xs font-medium tabular">{fmtDateShort(r.quote.pickupDate)}</span>,
    },
    {
      id: "total", header: "Quoted amount", accessorFn: (r) => r.total, meta: { align: "right", headerClassName: "w-[16%]" },
      cell: ({row: {original: r}}) => <span className="text-[13px] font-semibold tabular">{peso(r.total)}</span>,
    },
    {
      id: "valid", header: "Status / validity", accessorFn: (r) => r.quote.validUntil, meta: { headerClassName: "w-[18%]" },
      cell: ({row: {original: r}}) => <div className="grid justify-items-start gap-1.5"><StatusBadge status={r.status} className="text-[10px]" /><QuoteValidity quote={r.quote} />{nextStep(r)}</div>,
    },
    {id:"actions",header:()=><span className="sr-only">Open quote</span>,enableSorting:false,meta:{headerClassName:"w-12"},cell:({row})=><Button variant="ghost" size="icon-sm" aria-label={`Open ${row.original.quote.id}`} onClick={(e)=>{e.stopPropagation();setSelected(row.original.quote.id);}}><ArrowUpRight /></Button>},
  ];

  return (
    <div className="quotes-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><FileText className="size-3.5" /> Freight quotations</div>
      <PageHeader title="Quotes" description="Price each shipment, follow up with customers, and turn accepted quotes into jobs." actions={<Button onClick={() => setCreating(true)}><Plus /> New quote</Button>} />
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <QuoteMetric label="Awaiting reply" value={pesoCompact(sumBy(open, (r) => r.total))} icon={Send} hint={`${open.length} sent quotes awaiting a decision`} featured />
        <QuoteMetric label="Ready to book" value={acceptedNoJob.length} icon={Handshake} hint="Accepted quotes without a job" />
        <QuoteMetric label="Quote win rate" value={pct(won.length / Math.max(1, decided.length))} icon={CheckCircle2} hint={`${won.length} accepted · ${decided.length - won.length} rejected or expired`} />
        <QuoteMetric label="Expiring soon" value={open.filter((r) => -daysAgo(r.quote.validUntil) <= 2).length} icon={CalendarClock} hint="Sent quotes expiring within 2 days" />
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList aria-label="Quote status" className="quotes-status-tabs h-auto w-full gap-1 rounded-none border-b bg-transparent p-0 pb-3">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value} className="px-3 py-2 text-xs">{t.label}<span className="rounded bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] tabular">{base.filter((r) => t.match(r.status)).length}</span></TabsTrigger>)}
        </TabsList>
      </Tabs>
      <div className="mb-5 rounded-xl border bg-card">
        <FilterBar search={q} onSearch={setQ} placeholder="Search quotes, customers or cargo…" className="border-0">
          <FilterSelect value={partyType} onChange={setPartyType} label="Quote party" options={[{value:"all",label:"Customers & leads"},{value:"customer",label:"Customers"},{value:"lead",label:"Leads"}]} />
          <FilterSelect value={attention} onChange={setAttention} label="Follow-up" options={[{value:"all",label:"All follow-ups"},{value:"expiring",label:"Expiring within 2 days"},{value:"ready",label:"Ready to book"}]} className="w-full sm:w-48" />
          {hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground"><X /> Reset</Button>}
        </FilterBar>
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{tab === "all" ? "All quotations" : `${tabDef.label} quotations`}</h2><span aria-live="polite" className="text-[11px] text-muted-foreground">{filtered.length} {filtered.length === 1 ? "quote" : "quotes"} · {pesoCompact(sumBy(filtered, (r) => r.total))} quoted value</span></div>
      <Card className="overflow-hidden">
        <DataTable columns={columns} data={filtered} className="quotes-register" pageSize={10} onRowClick={(r) => setSelected(r.quote.id)} initialSorting={[{ id: "id", desc: true }]}
          empty={<EmptyState icon={FileText} title="No matching quotes" description="Try another search or filter, or create a new freight quote." action={hasFilters ? <Button variant="outline" onClick={resetFilters}>Reset filters</Button> : <Button onClick={()=>setCreating(true)}><Plus /> New quote</Button>} />}
          renderCard={(r) => (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2"><button type="button" onClick={(e)=>{e.stopPropagation();setSelected(r.quote.id);}} className="cursor-pointer font-mono text-[11px] font-medium text-primary hover:underline">{r.quote.id}</button><StatusBadge status={r.status} className="text-[10px]" /></div>
              <div><div className="text-sm font-semibold">{r.party}</div><div className="mt-1 text-[10px] text-muted-foreground">{r.quote.customerId ? "Customer" : "Lead"}</div></div>
              <div className="rounded-lg bg-accent/40 p-3"><div className="flex items-start gap-2 text-xs font-medium"><Route className="mt-0.5 size-3.5 shrink-0 text-primary" />{jobLane(r.quote)}</div><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{r.quote.cargoDescription} · {kg(r.quote.weightKg)}</p></div>
              <div className="flex items-start justify-between gap-2"><div className="text-xs"><div className="text-[10px] text-muted-foreground">Pickup</div><div className="mt-1">{fmtDateShort(r.quote.pickupDate)}</div></div><div className="text-sm font-semibold tabular">{peso(r.total)}</div></div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><QuoteValidity quote={r.quote} />{nextStep(r)}</div>
            </div>
          )}
        />
      </Card>
      <QuoteFormDialog open={creating} onOpenChange={setCreating} initialParty={newForLead ?? newForCustomer} onCreated={setSelected} />
      <QuoteSheet id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function QuoteValidity({quote}:{quote:FreightQuote}) {
  const days = -daysAgo(quote.validUntil);
  const urgent = quoteStatus(quote) === "Sent" && days <= 2;
  return <div className="text-[10px] text-muted-foreground"><span>Valid to {fmtDateShort(quote.validUntil)}</span>{urgent && <div className="mt-1 font-medium text-[oklch(0.55_0.13_65)]">{days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`}</div>}</div>;
}

function QuoteMetric({label,value,hint,icon:Icon,featured}:{label:string;value:React.ReactNode;hint:string;icon:LucideIcon;featured?:boolean}) {
  return <div className={cn("quote-metric min-w-0 p-4 sm:p-5",featured && "quote-metric-featured")}><div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div><div className="my-3 text-[30px] leading-none font-semibold tracking-tight tabular">{value}</div><p className="text-[11px] leading-relaxed opacity-75">{hint}</p></div>;
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
      <SheetContent className="admin-shell w-full overflow-y-auto bg-background sm:max-w-xl">
        {quote && status && (
          <div className="grid gap-5 p-5 sm:p-6">
            <div className="border-b pb-5">
              <div className="ops-eyebrow mb-3">Quote workspace</div>
              <SheetTitle className="flex flex-wrap items-center gap-2 pr-6 text-xl tracking-tight">
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
            <div className="rounded-xl bg-[#203a3c] p-4 text-white"><div className="text-[11px] text-white/75">Total freight quotation</div><div className="mt-2 text-[28px] font-semibold tracking-tight tabular">{peso(quoteTotal(quote))}</div><div className="mt-1 text-xs text-white/75">Valid until {fmtDate(quote.validUntil)}</div></div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-4 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Route & schedule</h3>
              <div className="relative ml-1 grid gap-5 border-l border-primary/20 pl-5"><div><span className="absolute -left-1.5 mt-1 size-2.5 rounded-full border-2 border-primary bg-card" /><Stat label={`Pickup · ${fmtDate(quote.pickupDate)}`} value={quote.pickup.name} sub={quote.pickup.address} /></div><div><span className="absolute -left-1.5 mt-1 size-2.5 rounded-full bg-primary" /><Stat label={`Drop-off · required ${fmtDate(quote.requiredDate)}`} value={quote.dropoff.name} sub={quote.dropoff.address} /></div></div>
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2"><Stat label="Cargo" value={quote.cargoDescription} sub={`${quote.cargoCategory} · ${kg(quote.weightKg)}`} /><Stat label="Truck requirement" value={quote.truckRequirement} /></div>
            <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm">
              <LineItem label="Freight" value={peso(quote.freightCharge)} />
              {quote.additionalCharges.map((c) => (
                <LineItem key={c.label} label={c.label} value={peso(c.amount)} muted />
              ))}
              <Separator className="my-1" />
              <LineItem label="Total quoted" value={peso(quoteTotal(quote))} strong />
              <QuoteValidity quote={quote} />
            </div>
            {quote.notes && <div className="rounded-lg border border-primary/15 bg-accent/50 p-4 text-xs leading-relaxed"><div className="mb-1 font-semibold">Quote notes</div>{quote.notes}</div>}
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
