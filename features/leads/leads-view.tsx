"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, ArrowUpRight, FileText, Kanban, List, MapPin, MessageCircle, Phone, Plus, Route, UserCheck, Users, Megaphone, Target, X, type LucideIcon } from "lucide-react";
import type { AreaId, Lead, LeadSource, LeadStage, CustomerType } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { STAFF, staffById } from "@/data/company";
import { AREAS } from "@/data/areas";
import { fmtDate, fmtDateShort, fmtDateTime, peso, pesoCompact, pct } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { EmptyState, FilterBar, FilterSelect, PageHeader, Stat, Timeline } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { LeadPipeline } from "./leads-pipeline";
import { CUSTOMER_TYPES } from "@/features/customers/customers-view";

export const STAGES: LeadStage[] = ["New", "Contacted", "Quoted", "Sample Order", "Negotiating", "Won", "Lost"];
export const LEAD_SOURCES: LeadSource[] = ["Facebook Marketplace", "Facebook Group", "Facebook Page", "Messenger", "Referral", "Walk-in", "Existing Customer Referral"];


export function LeadsView() {
  const leads = useAppStore((s) => s.leads);
  const quotes = useAppStore((s) => s.quotes);
  const moveLead = useAppStore((s) => s.moveLead);
  const [selected, setSelected] = React.useState<string>();
  const [adding, setAdding] = React.useState(false);
  const [view, setView] = React.useState("list");
  const [source, setSource] = React.useState("all");
  const [owner, setOwner] = React.useState("all");
  const [stage, setStage] = React.useState("open");
  const [search, setSearch] = React.useState("");
  const stages = STAGES.filter((s) => stage === "all" || (stage === "open" ? s !== "Won" && s !== "Lost" : s === stage));
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visible = leads.filter((lead) =>
    (source === "all" || lead.source === source) &&
    (owner === "all" || lead.ownerId === owner) && stages.includes(lead.stage) &&
    terms.every((term) => `${lead.id} ${lead.businessName} ${lead.contactName} ${lead.phone} ${lead.location} ${lead.lane} ${lead.cargoInterest}`.toLowerCase().includes(term)),
  );
  const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const won = leads.filter((l) => l.stage === "Won").length;
  const lost = leads.filter((l) => l.stage === "Lost").length;
  const fb = leads.filter((l) => l.source.startsWith("Facebook") || l.source === "Messenger");
  const sel = leads.find((l) => l.id === selected);
  const filtered = Boolean(search || source !== "all" || owner !== "all" || stage !== "open");
  const reset = () => { setSearch(""); setSource("all"); setOwner("all"); setStage("open"); };
  const onMove = (id: string, next: LeadStage) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === next) return;
    void act(() => moveLead(id, next), () => toast.success(`${lead.businessName} → ${next}`));
  };
  const columns: ColumnDef<Lead, unknown>[] = [
    { id: "business", header: "Business / contact", accessorFn: (lead) => lead.businessName, cell: ({row}) => <div className="min-w-[170px] max-w-[240px]"><button type="button" onClick={(e) => { e.stopPropagation(); setSelected(row.original.id); }} className="cursor-pointer text-left text-[13px] font-semibold leading-relaxed hover:text-primary hover:underline">{row.original.businessName}</button><div className="mt-1 text-[11px] text-muted-foreground">{row.original.contactName}</div><div className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" />{row.original.location}</div></div> },
    { id: "lane", header: "Freight opportunity", accessorFn: (lead) => lead.lane, cell: ({row}) => <div className="min-w-[160px] max-w-[225px]"><div className="text-xs font-medium leading-relaxed">{row.original.lane}</div><div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{row.original.cargoInterest}</div><div className="mt-1 text-[10px] text-muted-foreground">{row.original.potentialVolume}</div></div> },
    { id: "stage", header: "Stage / source", accessorFn: (lead) => lead.stage, cell: ({row}) => <div className="grid gap-2"><StatusBadge status={row.original.stage} className="text-[10px]" /><span className="max-w-32 text-[10px] leading-relaxed text-muted-foreground">{row.original.source}</span></div> },
    { id: "potential", header: "Potential / mo", accessorFn: (lead) => lead.potentialMonthlyValue, meta: {align:"right"}, cell: ({row}) => <span className="whitespace-nowrap text-xs font-semibold text-primary tabular">{pesoCompact(row.original.potentialMonthlyValue)}</span> },
    { id: "lastContact", header: "Last contact / owner", accessorFn: (lead) => lead.lastContactAt, cell: ({row}) => <div><div className="whitespace-nowrap text-xs tabular">{fmtDateShort(row.original.lastContactAt)}</div><div className="mt-1 text-[11px] text-muted-foreground">{staffById(row.original.ownerId)?.name ?? "Unassigned"}</div></div> },
    { id: "actions", header: () => <span className="sr-only">Open lead</span>, enableSorting: false, cell: ({row}) => <Button variant="ghost" size="icon-sm" aria-label={`Open ${row.original.businessName}`} onClick={(e) => {e.stopPropagation(); setSelected(row.original.id);}}><ArrowUpRight /></Button> },
  ];
  const empty = <EmptyState icon={Target} title="No leads match this view" description="Try another search, owner, source or stage." action={filtered ? <Button variant="outline" onClick={reset}>Reset filters</Button> : <Button onClick={() => setAdding(true)}><Plus /> Add lead</Button>} className="bg-card" />;

  return (
    <div className="leads-workspace ops-enter">
      <div className="ops-eyebrow mb-2 flex items-center gap-2"><Target className="size-3.5" /> Sales & relationships</div>
      <PageHeader title="Leads" description="Turn freight inquiries into lasting customer relationships." actions={<><Button variant="outline" asChild><Link href="/quotes"><FileText /> View quotes</Link></Button><Button onClick={() => setAdding(true)}><Plus /> Add lead</Button></>} />
      <div className="lead-summary mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card lg:grid-cols-4">
        <LeadMetric label="Open leads" value={open.length} icon={Target} hint={`${pesoCompact(sumBy(open, (l) => l.potentialMonthlyValue))}/month freight potential`} featured />
        <LeadMetric label="Facebook & Messenger" value={fb.length} icon={Megaphone} hint={`${pct(fb.length / Math.max(1, leads.length))} of all leads`} />
        <LeadMetric label="Closed-lead win rate" value={pct(won / Math.max(1, won + lost))} icon={UserCheck} hint={`${won} won · ${lost} lost`} />
        <LeadMetric label="Quotes awaiting reply" value={quotes.filter((q) => q.leadId && q.status === "Sent").length} icon={FileText} hint="Sent quotes linked to leads" />
      </div>
      <Tabs value={view} onValueChange={setView}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <TabsList aria-label="Lead views" className="lead-view-tabs h-auto gap-1 bg-transparent p-0"><TabsTrigger value="list" className="px-3 py-2 text-xs"><List /> Lead list</TabsTrigger><TabsTrigger value="pipeline" className="px-3 py-2 text-xs"><Kanban /> Pipeline</TabsTrigger></TabsList>
          <span className="text-[11px] text-muted-foreground" aria-live="polite">{visible.length} {visible.length === 1 ? "lead" : "leads"} · {pesoCompact(sumBy(visible, (l) => l.potentialMonthlyValue))}/month potential</span>
        </div>
        <div className="mb-4 rounded-xl border bg-card">
          <FilterBar search={search} onSearch={setSearch} placeholder="Search business, contact or route…" className="border-0">
            <FilterSelect value={source} onChange={setSource} label="Lead source" options={[{value:"all",label:"All sources"},...LEAD_SOURCES.map((s)=>({value:s,label:s}))]} />
            <FilterSelect value={owner} onChange={setOwner} label="Lead owner" options={[{value:"all",label:"All owners"},...STAFF.filter((s)=>s.role === "sales" || leads.some((l)=>l.ownerId===s.id)).map((s)=>({value:s.id,label:s.name}))]} />
            <FilterSelect value={stage} onChange={setStage} label="Lead stage" options={[{value:"open",label:"Open stages"},{value:"all",label:"All stages"},...STAGES.map((s)=>({value:s,label:s}))]} />
            {filtered && <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={reset}><X /> Reset filters</Button>}
          </FilterBar>
        </div>
        <TabsContent value="list">
          <Card className="overflow-hidden"><DataTable columns={columns} data={visible} pageSize={10} initialSorting={[{id:"lastContact",desc:true}]} className="lead-register" onRowClick={(lead)=>setSelected(lead.id)} empty={empty} renderCard={(lead)=>(
            <div className="grid gap-2"><div className="flex items-start justify-between gap-2"><button type="button" onClick={(e)=>{e.stopPropagation();setSelected(lead.id);}} className="cursor-pointer text-left text-sm font-semibold hover:text-primary">{lead.businessName}</button><StatusBadge status={lead.stage} className="text-[10px]" /></div><div className="text-[11px] text-muted-foreground">{lead.contactName} · {lead.location}</div><div className="rounded-md bg-accent/40 p-2.5 text-xs"><div className="font-medium">{lead.lane}</div><div className="mt-1 text-muted-foreground">{lead.cargoInterest}</div></div><div className="flex items-center justify-between gap-2 text-[11px]"><span className="font-semibold text-primary">{pesoCompact(lead.potentialMonthlyValue)}/mo</span><span className="text-muted-foreground">Contacted {fmtDateShort(lead.lastContactAt)}</span></div><div className="text-[10px] text-muted-foreground">{lead.source} · {staffById(lead.ownerId)?.name}</div></div>
          )} /></Card>
        </TabsContent>
        <TabsContent value="pipeline">{visible.length ? <LeadPipeline leads={visible} stages={stages} onOpen={setSelected} onMove={onMove} /> : empty}</TabsContent>
      </Tabs>
      <Sheet open={!!sel} onOpenChange={(v) => !v && setSelected(undefined)}>
        <SheetContent className="admin-shell w-full overflow-y-auto bg-background sm:max-w-xl">{sel && <LeadDetail key={sel.id} lead={sel} />}</SheetContent>
      </Sheet>
      <AddLeadDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function LeadMetric({label,value,hint,icon:Icon,featured}:{label:string;value:React.ReactNode;hint:string;icon:LucideIcon;featured?:boolean}) {
  return <div className={cn("lead-metric min-w-0 p-4 sm:p-5",featured && "lead-metric-featured")}><div className="flex items-start justify-between gap-2 text-xs font-medium"><span>{label}</span><Icon className="size-4 shrink-0 opacity-70" strokeWidth={1.6} /></div><div className="my-3 text-[30px] leading-none font-semibold tracking-tight tabular">{value}</div><p className="text-[11px] leading-relaxed opacity-75">{hint}</p></div>;
}

function LeadDetail({ lead }: { lead: Lead }) {
  const router = useRouter();
  const moveLead = useAppStore((s) => s.moveLead);
  const convert = useAppStore((s) => s.convertLead);
  const [note, setNote] = React.useState("");
  const owner = staffById(lead.ownerId);
  return (
    <div className="grid gap-5 p-5 sm:p-6">
      <div className="border-b pb-5">
        <div className="ops-eyebrow mb-3">Lead workspace</div>
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-6 text-xl leading-snug tracking-tight">
          {lead.businessName} <StatusBadge status={lead.stage} />
        </SheetTitle>
        <SheetDescription>
          {lead.id} · {lead.source} · created {fmtDate(lead.createdAt)}
        </SheetDescription>
      </div>
      <div className="rounded-xl bg-[#203a3c] p-4 text-white"><div className="text-[11px] text-white/75">Potential monthly freight</div><div className="mt-2 text-[28px] font-semibold tracking-tight tabular">{peso(lead.potentialMonthlyValue)}</div><div className="mt-1 text-xs text-white/75">{lead.potentialVolume}</div></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border bg-card p-4">
        <Stat label="Contact" value={lead.contactName} sub={lead.phone} />
        <Stat label="Location" value={lead.location} />
        <Stat label="Business type" value={lead.businessType} />
        <Stat label="Owner" value={owner?.name ?? "—"} />

      </div>
      <div className="rounded-xl border bg-card p-4"><div className="mb-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Freight requirements</div><div className="flex items-start gap-2 text-sm font-medium"><Route className="mt-0.5 size-4 shrink-0 text-primary" />{lead.lane}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{lead.cargoInterest}</p></div>
      {lead.nextStep && <div className="rounded-lg border border-primary/15 bg-accent/60 p-4 text-xs leading-relaxed"><b>Next step:</b> {lead.nextStep}</div>}
      {lead.lostReason && <div className="rounded-md bg-danger-soft p-3 text-sm"><b>Lost:</b> {lead.lostReason}</div>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href={`tel:${lead.phone.replace(/\s/g, "")}`}>
            <Phone /> Call
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast("Opening Messenger conversation (demo)")}>
          <MessageCircle /> Messenger
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Move stage <ArrowRight />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Pipeline stage</DropdownMenuLabel>
            {STAGES.filter((s) => s !== lead.stage && s !== "Won").map((s) => (
              <DropdownMenuItem key={s} onSelect={() => void act(() => moveLead(lead.id, s), () => toast.success(`Moved to ${s}`))}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {!lead.convertedCustomerId && lead.stage !== "Lost" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/quotes?lead=${lead.id}`}>
              <FileText /> Create quote
            </Link>
          </Button>
        )}
        {lead.convertedCustomerId ? (
          <Button size="sm" asChild>
            <Link href={`/customers/${lead.convertedCustomerId}`}>
              <Users /> View customer
            </Link>
          </Button>
        ) : (
          lead.stage !== "Lost" && (
            <ConfirmDialog
              trigger={
                <Button size="sm">
                  <UserCheck /> Convert to customer
                </Button>
              }
              title={`Convert ${lead.businessName} to a customer?`}
              description="A customer account will be created (COD terms to start), the lead will be marked Won, and you can book their first job right away."
              confirmLabel="Convert"
              onConfirm={() =>
                void act(() => convert(lead.id), (id) => {
                  toast.success(`${lead.businessName} is now customer ${id}`, { action: { label: "New job", onClick: () => router.push(`/jobs/new?customer=${id}`) } });
                  router.push(`/customers/${id}`);
                })
              }
            />
          )
        )}
      </div>
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <Field label="Add activity note" htmlFor="lead-note">
          <Textarea id="lead-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called — wants sample on Thursday" />
        </Field>
        <Button
          size="sm"
          variant="secondary"
          className="justify-self-start"
          disabled={note.trim().length < 3}
          onClick={() =>
            void act(() => moveLead(lead.id, lead.stage, note.trim()), () => {
              setNote("");
              toast.success("Note added");
            })
          }
        >
          Add note
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {lead.activities.length ? <Timeline items={[...lead.activities].reverse().map((a) => ({ title: a.note, meta: a.by, at: fmtDateTime(a.at), state: "done" }))} /> : <p className="text-sm text-muted-foreground">No activity logged yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

const schema = z.object({
  businessName: z.string().min(3, "Business name is required"),
  contactName: z.string().min(3, "Contact name is required"),
  phone: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile format, e.g. 0917 123 4567"),
  source: z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]),
  location: z.string().min(3, "Where is the business?"),
  businessType: z.enum(CUSTOMER_TYPES as [CustomerType, ...CustomerType[]]),
  areaId: z.string(),
  cargoInterest: z.string().trim().min(3, "What do they need hauled?"),
  lane: z.string().trim().min(3, "e.g. Lucena → Imus"),
  potentialVolume: z.string().min(2, "e.g. 600 kg × 2 trips/week"),
  potentialMonthlyValue: z.number({ message: "Estimate in pesos" }).min(0),
  ownerId: z.string(),
});
type Values = z.infer<typeof schema>;

function AddLeadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useAppStore((s) => s.addLead);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { businessName: "", contactName: "", phone: "", source: "Facebook Group", location: "", businessType: "Seafood Dealer", areaId: "none", cargoInterest: "", lane: "", potentialVolume: "", potentialMonthlyValue: 0, ownerId: "ST-02" } });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    act(() => add({ businessName: v.businessName, contactName: v.contactName, phone: v.phone, source: v.source, location: v.location, areaId: v.areaId === "none" ? undefined : (v.areaId as AreaId), businessType: v.businessType, cargoInterest: v.cargoInterest, lane: v.lane, potentialVolume: v.potentialVolume, potentialMonthlyValue: v.potentialMonthlyValue, stage: "New", ownerId: v.ownerId }), () => {
      toast.success(`${v.businessName} added to the pipeline`);
      form.reset();
      onOpenChange(false);
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
          <DialogDescription>Capture shippers who commented in a Facebook group, messaged the page, or were referred.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="l-bn" error={e.businessName?.message} required>
            <Input id="l-bn" aria-invalid={!!e.businessName} {...form.register("businessName")} />
          </Field>
          <Field label="Contact person" htmlFor="l-cn" error={e.contactName?.message} required>
            <Input id="l-cn" aria-invalid={!!e.contactName} {...form.register("contactName")} />
          </Field>
          <Field label="Mobile number" htmlFor="l-ph" error={e.phone?.message} required>
            <Input id="l-ph" placeholder="0917 123 4567" aria-invalid={!!e.phone} {...form.register("phone")} />
          </Field>
          <Field label="Source" htmlFor="l-src">
            <Controller control={form.control} name="source" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="l-src"><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Location" htmlFor="l-loc" error={e.location?.message} required>
            <Input id="l-loc" placeholder="e.g. Imus, Cavite" aria-invalid={!!e.location} {...form.register("location")} />
          </Field>
          <Field label="Business type" htmlFor="l-type">
            <Controller control={form.control} name="businessType" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="l-type"><SelectValue /></SelectTrigger>
                <SelectContent>{CUSTOMER_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Area (for routing)" htmlFor="l-area">
            <Controller control={form.control} name="areaId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="l-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not on our lanes yet</SelectItem>
                  {AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Cargo to haul" htmlFor="l-cargo" error={e.cargoInterest?.message} required>
            <Input id="l-cargo" placeholder="e.g. Sugpo, iced (styro boxes)" aria-invalid={!!e.cargoInterest} {...form.register("cargoInterest")} />
          </Field>
          <Field label="Lane" htmlFor="l-lane" error={e.lane?.message} required>
            <Input id="l-lane" placeholder="e.g. Lucena → Imus" aria-invalid={!!e.lane} {...form.register("lane")} />
          </Field>
          <Field label="Potential volume" htmlFor="l-vol" error={e.potentialVolume?.message} required>
            <Input id="l-vol" placeholder="e.g. 600 kg × 2 trips/week" aria-invalid={!!e.potentialVolume} {...form.register("potentialVolume")} />
          </Field>
          <Field label="Potential freight (₱/month)" htmlFor="l-val" error={e.potentialMonthlyValue?.message}>
            <Input id="l-val" type="number" {...form.register("potentialMonthlyValue", { valueAsNumber: true })} />
          </Field>
          <Field label="Assigned to" htmlFor="l-own">
            <Controller control={form.control} name="ownerId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="l-own"><SelectValue /></SelectTrigger>
                <SelectContent>{STAFF.filter((s) => s.role === "sales").map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}><Plus /> Add lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

