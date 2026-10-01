"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight, Ban, CheckCircle2, CircleDollarSign, ClipboardList, FileText, History, Info, MapPin, MoreHorizontal, Package, Phone, Route, Truck, UserRound, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useInvoiceMap, useTripMetrics } from "@/hooks/use-data";
import { staffById } from "@/data/company";
import { areaName } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { additionalTotal, jobPaymentStatus, jobTotal } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDateTime, fmtDay, fmtTime, kg, peso, unitQty } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/components/ui/primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { CapacityBar, EmptyState, JobSourceBadge, LineItem, PageHeader, Stat, Timeline, type TimelineItem } from "@/components/shared/common";
import { LegBadge, LoadTypeBadge, ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { PodCard } from "@/components/shared/pod";
import { RecordNotFound } from "@/components/shared/states";
import { AssignJobDialog, CancelJobDialog } from "./job-dialogs";
import { RecordPaymentDialog } from "@/features/finance/record-payment-dialog";

export function JobDetail({ id }: { id: string }) {
  const job = useAppStore((s) => s.jobs.find((j) => j.id === id));
  const allLoads = useAppStore((s) => s.loads);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const allPayments = useAppStore((s) => s.payments);
  const quotes = useAppStore((s) => s.quotes);
  const boardPost = useAppStore((s) => s.boardLoads.find((l) => !!id && l.jobId === id));
  const marketplaceRequest = useAppStore((s) => s.backhaulRequests.find((r) => !!id && r.jobId === id));
  const customer = useAppStore((s) => s.customers.find((c) => c.id === job?.customerId));
  const setStatus = useAppStore((s) => s.setJobStatus);
  const invoice = useInvoiceMap().get(id);
  const metrics = useTripMetrics();
  const [dialog, setDialog] = React.useState<"assign" | "cancel" | "pay" | null>(null);

  if (!job || !customer) return <RecordNotFound kind="Job" id={id} backHref="/jobs" backLabel="Back to jobs" />;

  const loads = allLoads.filter((l) => l.jobId === job.id);
  const trip = job.tripId ? trips.find((t) => t.id === job.tripId) : undefined;
  const m = trip ? metrics.get(trip.id) : undefined;
  const delivery = deliveries.find((d) => d.jobId === job.id);
  const payments = allPayments.filter((p) => p.jobId === job.id).sort((a, b) => a.date.localeCompare(b.date));
  const quote = job.quoteId ? quotes.find((q) => q.id === job.quoteId) : undefined;
  const total = jobTotal(job);
  const paid = sumBy(payments, (p) => p.amount);
  const payStatus = jobPaymentStatus(job, invoice);
  const canAssign = job.status === "Confirmed" || job.status === "Awaiting Dispatch" || job.status === "Assigned";
  const canCancel = ["Inquiry", "Quoted", "Confirmed", "Awaiting Dispatch", "Assigned"].includes(job.status);

  const timeline: TimelineItem[] = [
    ...job.history.map((e) => ({ at: e.at, title: e.label, meta: e.by, note: e.note })),
    ...(trip?.actualDeparture && job.leg === "outbound" ? [{ at: trip.actualDeparture, title: `Departed Lucena on ${trip.id}`, meta: `${truckById(trip.truckId).code} · ${driverById(trip.driverId).name}`, note: undefined }] : []),
    ...(delivery?.arrivedAt ? [{ at: delivery.arrivedAt, title: `Arrived at ${job.dropoff.name}`, meta: driverById(trip?.driverId ?? "DRV-01").name, note: undefined }] : []),
    ...(delivery?.issues ?? []).map((i) => ({ at: i.reportedAt, title: `Issue: ${i.type}`, meta: i.reportedBy, note: i.note })),
    ...(invoice ? [{ at: `${invoice.issueDate}T23:59`, title: `Invoice ${invoice.id} issued`, meta: `${peso(invoice.total)} · due ${fmtDay(invoice.dueDate)}`, note: undefined }] : []),
    ...payments.filter((p) => !job.history.some((e) => e.note?.includes(p.receiptNo))).map((p) => ({ at: p.date, title: `Payment received — ${peso(p.amount)}`, meta: `${p.method} · ${p.receiptNo} · ${p.recordedBy}`, note: p.notes })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((t) => ({ ...t, at: fmtDateTime(t.at), state: t.title.startsWith("Issue") || t.title.includes("failed") || t.title.includes("cancelled") ? ("failed" as const) : ("done" as const) }));

  return (
    <div className="job-detail-workspace ops-enter">
      <PageHeader
        breadcrumbs={[{ label: "Logistics Jobs", href: "/jobs" }, { label: job.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {job.id}
          </span>
        }
        description={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary hover:underline">{customer.name}<ArrowUpRight className="size-3.5" /></Link>
            <StatusBadge status={job.status} className="rounded-full text-[11px]" />
            <LegBadge leg={job.leg} />
          </div>
        }
        actions={
          <>
            {(job.status === "Inquiry" || job.status === "Quoted") && (
              <Button
                size="sm"
                onClick={() => {
                  setStatus(job.id, "Confirmed");
                  toast.success(`${job.id} confirmed`, { description: "It now appears on the Dispatch board." });
                }}
              >
                <CheckCircle2 /> Confirm booking
              </Button>
            )}
            {canAssign && (
              <Button size="sm" variant={job.tripId ? "outline" : "default"} onClick={() => setDialog("assign")}>
                <Truck /> {job.tripId ? "Change trip" : "Assign to trip"}
              </Button>
            )}
            <Button variant="outline" size="sm" asChild><Link href={`/loads?q=${job.id}`}><Package /> View cargo</Link></Button>
            {canCancel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="icon-sm" aria-label="More job actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}><Ban /> Cancel job</DropdownMenuItem></DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />
      {job.notes && <div className="mb-5 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-xs leading-relaxed"><Info className="mt-0.5 size-4 shrink-0" /><div><span className="mr-1 font-semibold">Booking note.</span>{job.notes}</div></div>}
      {job.status === "Cancelled" && job.cancelReason && <div className="mb-5 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-xs text-danger"><Ban className="size-4 shrink-0" />Cancelled — {job.cancelReason}</div>}
      <div className="job-detail-summary mb-6 grid grid-cols-2 overflow-hidden rounded-xl border bg-card">
        <div className="bg-[#203a3c] p-4 text-white sm:px-5"><div className="flex items-center gap-2 text-[11px] text-white/75"><Package className="size-3.5" /> Gross cargo weight</div><div className="mt-2 text-2xl font-semibold tracking-tight tabular">{kg(job.weightKg)}</div><div className="mt-1 text-[11px] text-white/75">{loads.length} {loads.length === 1 ? "load" : "loads"} · {job.cargoCategory}</div></div>
        <div className="p-4 sm:px-5"><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Truck className="size-3.5" /> Truck requirement</div><div className="mt-2 text-sm font-semibold leading-relaxed">{job.truckRequirement || "Not specified"}</div><div className="mt-1 text-[11px] text-muted-foreground">{trip ? `${truckById(trip.truckId).code} assigned` : "Vehicle not yet assigned"}</div></div>
      </div>
      <div className="job-detail-grid grid items-start gap-5">
        <div className="grid min-w-0 gap-5">
        <Card className="job-route-card overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Route className="size-4 text-primary" /> Route & schedule</CardTitle>
            <span className="text-[11px] text-muted-foreground">{areaName(job.pickup.areaId)} → {areaName(job.dropoff.areaId)}</span>
          </CardHeader>
          <CardContent>
            <div className="job-route-stops grid gap-4">
              {[
                { label: "Pickup", place: job.pickup, at: job.pickupAt, number: "01" },
                { label: "Delivery deadline", place: job.dropoff, at: job.requiredBy, number: "02" },
              ].map((stop) => (
                <div key={stop.number} className="rounded-lg border border-primary/10 bg-accent/30 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold tracking-wider text-primary uppercase">{stop.label}</span><span className="font-mono text-[10px] text-muted-foreground">{stop.number}</span></div>
                  <div className="flex items-baseline gap-2"><span className="text-lg font-semibold tracking-tight tabular">{fmtTime(stop.at)}</span><span className="text-[11px] text-muted-foreground">{fmtDay(stop.at)}</span></div>
                  <div className="mt-3 flex items-start gap-2 border-t border-primary/10 pt-3"><MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" /><div className="min-w-0"><div className="text-[13px] font-semibold leading-relaxed">{stop.place.name}</div>{stop.place.address && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stop.place.address}</p>}</div></div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
              <div className="flex items-center gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="size-4" /></span><div><div className="text-[10px] text-muted-foreground">Receiving contact</div><div className="mt-0.5 text-xs font-semibold">{job.consignee.name}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{job.consignee.phone}</div></div></div>
              <Button variant="outline" size="sm" asChild><a href={`tel:${job.consignee.phone.replace(/\s/g, "")}`} aria-label={`Call ${job.consignee.name}`}><Phone /><span className="hidden sm:inline">Call receiver</span></a></Button>
            </div>
            {job.instructions && <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed"><Info className="mt-0.5 size-3.5 shrink-0 text-primary" /><div><span className="mb-1 block font-semibold">Delivery instructions</span><span className="text-muted-foreground">{job.instructions}</span></div></div>}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader>
            <div><CardTitle className="flex items-center gap-2"><Package className="size-4 text-primary" /> Cargo manifest</CardTitle><CardDescription>{loads.length} {loads.length === 1 ? "load" : "loads"} · {job.cargoCategory}</CardDescription></div>
            <Button variant="ghost" size="sm" className="text-xs" asChild><Link href={`/loads?q=${job.id}`}>Manage loads <ArrowUpRight /></Link></Button>
          </CardHeader>
          <ul className="divide-y border-t">
            {loads.map((load) => (
              <li key={load.id} className="job-cargo-row grid gap-3 px-5 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30 text-muted-foreground"><Package className="size-4" /></span>
                  <div className="min-w-0"><Link href={`/loads?q=${load.id}`} className="text-[13px] font-semibold leading-relaxed hover:text-primary hover:underline">{load.cargoDescription}</Link><div className="mt-1 font-mono text-[10px] text-muted-foreground">{load.id}</div>{load.handlingNotes && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{load.handlingNotes}</p>}<div className="mt-2 flex flex-wrap gap-1.5"><LoadTypeBadge type={load.type} className="text-[10px]" /><StatusBadge status={load.status} className="text-[10px]" /></div></div>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs tabular sm:block sm:text-right"><div className="font-semibold">{kg(load.weightKg)}</div><div className="mt-1 text-[11px] text-muted-foreground">{unitQty(load.quantity, load.unit)}</div></div>
              </li>
            ))}
            {loads.length === 0 && <li className="px-5 py-6 text-xs text-muted-foreground">No loads recorded for this job yet.</li>}
          </ul>
          <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-3 text-xs"><span className="text-muted-foreground">Total manifest weight <span className="text-[10px]">· gross</span></span><span className="font-semibold tabular">{kg(sumBy(loads, (load) => load.weightKg))}</span></div>
        </Card>
        </div>
        <div className="grid min-w-0 gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><Wallet className="size-4 text-primary" /> Charges & billing</CardTitle>
              <CardDescription>Freight and additional charges</CardDescription>
            </div>
            <StatusBadge status={payStatus} icon={false} />
          </CardHeader>
          <div className="mx-5 mb-5 rounded-lg bg-[#203a3c] p-4 text-white">
            <div className="text-[11px] font-medium text-white/75">Total freight & charges</div>
            <div className="mt-2 text-[30px] leading-none font-semibold tracking-tight tabular">{peso(total)}</div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/75"><FileText className="size-3" />{job.paymentTerms} · {invoice ? "Invoice issued" : "Invoice issued on delivery"}</div>
          </div>
          <CardContent className="grid gap-3 text-sm">
            <LineItem label="Freight charge" value={peso(job.freightCharge)} />
            {job.additionalCharges.map((c) => (
              <LineItem key={c.label} label={c.label} value={peso(c.amount)} muted />
            ))}
            {job.additionalCharges.length === 0 && <LineItem label="Additional charges" value={peso(0)} muted />}
            <Separator className="my-1" />
            {invoice ? (
              <>
                <LineItem label={<Link href={`/accounts-receivable/${invoice.id}`} className="text-primary hover:underline">{invoice.id}</Link>} value={<ReceivableBadge daysOverdue={invoice.daysOverdue} balance={invoice.balance} />} />
                <LineItem label="Paid" value={peso(invoice.paid)} muted />
                <LineItem label="Balance" value={peso(invoice.balance)} strong />
                <div className="text-xs text-muted-foreground">Issued {fmtDay(invoice.issueDate)} · due {fmtDay(invoice.dueDate)}</div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">
                Not yet invoiced{paid > 0 ? ` · ${peso(paid)} received as advance` : ""}. {additionalTotal(job) > 0 ? "Additional charges are billed with the freight." : ""}
              </div>
            )}
            {job.status !== "Cancelled" && job.status !== "Inquiry" && payStatus !== "Paid" && (
              <Button size="sm" className="mt-2 w-full" onClick={() => setDialog("pay")}>
                <Wallet /> Record payment
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="size-4 text-primary" /> Trip & delivery</CardTitle>
            {delivery && (
              <Link href={`/deliveries/${delivery.id}`} className="text-xs font-medium text-primary hover:underline">
                {delivery.id}
              </Link>
            )}
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {trip && m ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/trips/${trip.id}`} className="font-medium text-primary hover:underline">
                      {trip.id}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {truckById(trip.truckId).code} ({truckById(trip.truckId).plateNo}) · {driverById(trip.driverId).name}
                    </div>
                    <div className="text-xs text-muted-foreground">{tripRouteLine(trip)}</div>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <CapacityBar used={job.leg === "outbound" ? m.outboundKg : m.returnKg} capacity={m.capacityKg} label={`${job.leg === "outbound" ? "Outbound" : "Return"} load on this trip`} size="sm" />
                {delivery ? (
                  <div className="grid gap-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Delivery</span>
                      <StatusBadge status={delivery.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat label="ETA" value={fmtTime(delivery.eta)} sub={fmtDay(delivery.eta)} />
                      <Stat label="Arrived" value={delivery.arrivedAt ? fmtTime(delivery.arrivedAt) : "—"} />
                    </div>
                  </div>
                ) : null}
                {delivery?.pod && <PodCard pod={delivery.pod} title={job.consignee.name} subtitle={job.dropoff.name} />}
              </>
            ) : job.status === "Cancelled" ? (
              <p className="text-muted-foreground">Cancelled — not assigned to a trip.</p>
            ) : job.status === "Completed" || job.status === "Delivered" ? (
              <p className="text-muted-foreground">Delivered before trip tracking (migrated record).</p>
            ) : (
              <EmptyState
                className="border-0 bg-muted/40 px-4 py-6 [&>div]:text-xs"
                icon={Truck}
                title="Awaiting trip assignment"
                description={job.status === "Inquiry" || job.status === "Quoted" ? "Confirm the booking first, then assign it on the Dispatch board." : "Assign this job to a trip with enough capacity."}
                action={
                  canAssign ? (
                    <Button size="sm" onClick={() => setDialog("assign")}>
                      <Truck /> Assign to trip
                    </Button>
                  ) : undefined
                }
              />
            )}
          </CardContent>
        </Card>
        </div>
      </div>
      <div className="job-detail-grid mt-5 grid items-start gap-5">
        <div className="grid min-w-0 gap-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /> Booking details</CardTitle>
            <Link href={`/customers/${customer.id}`} className="text-xs font-medium text-primary hover:underline">
              Customer profile <ArrowUpRight className="inline size-3" />
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <Stat label="Customer" value={customer.name} sub={`${customer.type} · ${areaName(customer.areaId)}`} className="col-span-2" />
            <div>
              <div className="text-xs text-muted-foreground">Source</div>
              <div className="mt-1">
                <JobSourceBadge source={job.source} />
              </div>
            </div>
            <Stat label="Booked" value={fmtDateTime(job.createdAt)} sub={job.history[0]?.by} />
            <Stat label="Sales rep" value={staffById(job.salespersonId)?.name ?? "—"} />
            <Stat label="Quote" value={quote ? <Link href={`/quotes?q=${quote.id}`} className="text-primary hover:underline">{quote.id}</Link> : "—"} sub={quote ? `${quote.status} · valid to ${fmtDay(quote.validUntil)}` : undefined} />
            {boardPost && <Stat label="Load Board post" value={<Link href={`/load-board?q=${boardPost.id}`} className="text-primary hover:underline">{boardPost.id}</Link>} sub={`${boardPost.source}${boardPost.sourceReference ? ` · ${boardPost.sourceReference}` : ""}`} className="col-span-2" />}
            {marketplaceRequest && <Stat label="Marketplace request" value={<Link href={`/future/backhaul-marketplace?tab=requests&q=${marketplaceRequest.id}`} className="text-primary hover:underline">{marketplaceRequest.id}</Link>} sub={`${marketplaceRequest.shipper.businessName} · instant quote ${peso(marketplaceRequest.quotedFreight)}`} className="col-span-2" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2"><History className="size-4 text-primary" /> Activity timeline</CardTitle>
              <CardDescription>Booking, dispatch, delivery, billing and payments</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Timeline items={timeline} />
          </CardContent>
        </Card>
        </div>
        <div className="grid min-w-0 gap-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <CircleDollarSign className="size-4 text-primary" /> Payments
              </CardTitle>
              <CardDescription>
                {peso(paid)} of {peso(total)} received
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <div className="font-medium">{peso(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.method} · {p.reference}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-mono">
                      <FileText className="size-3" /> {p.receiptNo}
                    </div>
                    {fmtDateTime(p.date)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {dialog === "assign" && <AssignJobDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "cancel" && <CancelJobDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "pay" && <RecordPaymentDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
    </div>
  );
}
