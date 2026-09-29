"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, FileText, MapPin, MessageCircle, Phone, Plus, Route, UserCheck, Users, Megaphone, Target } from "lucide-react";
import type { AreaId, Lead, LeadSource, LeadStage, CustomerType } from "@/types";
import { useAppStore } from "@/lib/store";
import { STAFF, staffById } from "@/data/company";
import { AREAS } from "@/data/areas";
import { fmtDate, fmtDateShort, fmtDateTime, peso, pesoCompact, pct } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/overlays";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { KPICard, PageHeader, Stat, Timeline } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CUSTOMER_TYPES } from "@/features/customers/customers-view";

export const STAGES: LeadStage[] = ["New", "Contacted", "Quoted", "Sample Order", "Negotiating", "Won", "Lost"];
export const LEAD_SOURCES: LeadSource[] = ["Facebook Marketplace", "Facebook Group", "Facebook Page", "Messenger", "Referral", "Walk-in", "Existing Customer Referral"];
const DND = "application/x-tradeloop-lead";

export function LeadsView() {
  const leads = useAppStore((s) => s.leads);
  const quotes = useAppStore((s) => s.quotes);
  const moveLead = useAppStore((s) => s.moveLead);
  const [selected, setSelected] = React.useState<string>();
  const [adding, setAdding] = React.useState(false);
  const [source, setSource] = React.useState("all");
  const visible = leads.filter((l) => source === "all" || l.source === source);
  const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const won = leads.filter((l) => l.stage === "Won").length;
  const lost = leads.filter((l) => l.stage === "Lost").length;
  const fb = leads.filter((l) => l.source.startsWith("Facebook") || l.source === "Messenger");
  const sel = leads.find((l) => l.id === selected);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Shippers and consignees from Facebook groups, Marketplace, Messenger and referrals — tracked from first message to first booked trip."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add lead
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Open leads" value={open.length} icon={Target} hint={`${pesoCompact(sumBy(open, (l) => l.potentialMonthlyValue))}/month freight potential`} />
        <KPICard label="From Facebook & Messenger" value={fb.length} icon={Megaphone} hint={`${pct(fb.length / Math.max(1, leads.length))} of all leads`} />
        <KPICard label="Conversion rate" value={pct(won / Math.max(1, won + lost))} icon={UserCheck} hint={`${won} won · ${lost} lost`} tone="success" />
        <KPICard label="Quotes out to leads" value={quotes.filter((q) => q.leadId && q.status === "Sent").length} icon={FileText} hint="awaiting reply" href="/quotes" />
      </div>
      <Tabs defaultValue="pipeline">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-56" aria-label="Lead source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsContent value="pipeline">
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
            {STAGES.map((stage) => {
              const list = visible.filter((l) => l.stage === stage);
              return (
                <div
                  key={stage}
                  className="flex w-64 shrink-0 flex-col rounded-xl border bg-muted/40"
                  onDragOver={(e) => e.dataTransfer.types.includes(DND) && e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData(DND);
                    const lead = leads.find((l) => l.id === id);
                    if (lead && lead.stage !== stage) {
                      moveLead(id, stage);
                      toast.success(`${lead.businessName} → ${stage}`);
                    }
                  }}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-sm font-semibold">{stage}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      {list.length} · {pesoCompact(sumBy(list, (l) => l.potentialMonthlyValue))}/mo
                    </span>
                  </div>
                  <div className="grid gap-2 px-2 pb-2">
                    {list.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData(DND, l.id)}
                        onClick={() => setSelected(l.id)}
                        className="grid gap-1.5 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 cursor-pointer"
                      >
                        <div className="font-medium leading-tight">{l.businessName}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {l.location}
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Route className="size-3 text-primary" /> {l.lane}
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Cargo:</span> {l.cargoInterest}
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Potential:</span> {l.potentialVolume}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10.5px]">
                            {l.source}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{fmtDateShort(l.lastContactAt)}</span>
                        </div>
                      </button>
                    ))}
                    {list.length === 0 && <div className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop leads here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      <Sheet open={!!sel} onOpenChange={(v) => !v && setSelected(undefined)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{sel && <LeadDetail lead={sel} />}</SheetContent>
      </Sheet>
      <AddLeadDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  const router = useRouter();
  const moveLead = useAppStore((s) => s.moveLead);
  const convert = useAppStore((s) => s.convertLead);
  const [note, setNote] = React.useState("");
  const owner = staffById(lead.ownerId);
  return (
    <div className="grid gap-4 p-5">
      <div>
        <SheetTitle className="flex flex-wrap items-center gap-2 pr-6">
          {lead.businessName} <StatusBadge status={lead.stage} />
        </SheetTitle>
        <SheetDescription>
          {lead.id} · {lead.source} · created {fmtDate(lead.createdAt)}
        </SheetDescription>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Contact" value={lead.contactName} sub={lead.phone} />
        <Stat label="Location" value={lead.location} />
        <Stat label="Business type" value={lead.businessType} />
        <Stat label="Owner" value={owner?.name ?? "—"} />
        <Stat label="Potential volume" value={lead.potentialVolume} />
        <Stat label="Potential freight" value={`${peso(lead.potentialMonthlyValue)}/month`} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="teal">
          <Route /> {lead.lane}
        </Badge>
        <Badge variant="outline">{lead.cargoInterest}</Badge>
      </div>
      {lead.nextStep && <div className="rounded-md bg-accent/60 p-3 text-sm"><b>Next step:</b> {lead.nextStep}</div>}
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
              <DropdownMenuItem key={s} onSelect={() => { moveLead(lead.id, s); toast.success(`Moved to ${s}`); }}>
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
                  <UserCheck /> Convert Lead → Customer
                </Button>
              }
              title={`Convert ${lead.businessName} to a customer?`}
              description="A customer account will be created (COD terms to start), the lead will be marked Won, and you can book their first job right away."
              confirmLabel="Convert"
              onConfirm={() => {
                const id = convert(lead.id);
                toast.success(`${lead.businessName} is now customer ${id}`, { action: { label: "New job", onClick: () => router.push(`/jobs/new?customer=${id}`) } });
                router.push(`/customers/${id}`);
              }}
            />
          )
        )}
      </div>
      <div className="grid gap-2">
        <Field label="Add activity note" htmlFor="lead-note">
          <Textarea id="lead-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called — wants sample on Thursday" />
        </Field>
        <Button
          size="sm"
          variant="secondary"
          className="justify-self-start"
          disabled={note.trim().length < 3}
          onClick={() => {
            moveLead(lead.id, lead.stage, note.trim());
            setNote("");
            toast.success("Note added");
          }}
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
  const submit = form.handleSubmit((v) => {
    add({ businessName: v.businessName, contactName: v.contactName, phone: v.phone, source: v.source, location: v.location, areaId: v.areaId === "none" ? undefined : (v.areaId as AreaId), businessType: v.businessType, cargoInterest: v.cargoInterest, lane: v.lane, potentialVolume: v.potentialVolume, potentialMonthlyValue: v.potentialMonthlyValue, stage: "New", ownerId: v.ownerId });
    toast.success(`${v.businessName} added to the pipeline`);
    form.reset();
    onOpenChange(false);
  });
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
            <Button type="submit"><Plus /> Add lead</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

