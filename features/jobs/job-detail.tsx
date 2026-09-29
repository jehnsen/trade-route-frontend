"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ban, CheckCircle2, CircleDollarSign, FileText, MapPin, Phone, Truck, UserRound, Wallet } from "lucide-react";
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <>
      <PageHeader
        breadcrumbs={[{ label: "Logistics Jobs", href: "/jobs" }, { label: job.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {job.id} <StatusBadge status={job.status} /> <LegBadge leg={job.leg} />
          </span>
        }
        description={
          <>
            <Link href={`/customers/${customer.id}`} className="font-medium text-foreground hover:underline">
              {customer.name}
            </Link>{" "}
            · {job.pickup.name} → {job.dropoff.name} · pickup {fmtDay(job.pickupAt)} {fmtTime(job.pickupAt)}
          </>
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
            {job.status !== "Cancelled" && job.status !== "Inquiry" && payStatus !== "Paid" && (
              <Button size="sm" variant="outline" onClick={() => setDialog("pay")}>
                <Wallet /> Record payment
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDialog("cancel")}>
                <Ban /> Cancel
              </Button>
            )}
          </>
        }
      />
      {job.notes && <div className="mb-4 rounded-lg border border-[oklch(0.85_0.08_85)] bg-warning-soft px-4 py-2.5 text-sm">{job.notes}</div>}
      {job.status === "Cancelled" && job.cancelReason && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm">Cancelled — {job.cancelReason}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Booking</CardTitle>
            <Link href={`/customers/${customer.id}`} className="text-xs font-medium text-primary hover:underline">
              Customer profile
            </Link>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
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
            <Stat label="Truck requirement" value={job.truckRequirement} className="col-span-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route & schedule</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Pickup · {fmtDay(job.pickupAt)} {fmtTime(job.pickupAt)}</div>
                <div className="font-medium">{job.pickup.name}</div>
                {job.pickup.address && <div className="text-xs text-muted-foreground">{job.pickup.address}</div>}
              </div>
            </div>
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--chart-3)]" />
              <div>
                <div className="text-xs text-muted-foreground">Drop-off · required by {fmtDay(job.requiredBy)} {fmtTime(job.requiredBy)}</div>
                <div className="font-medium">{job.dropoff.name}</div>
                {job.dropoff.address && <div className="text-xs text-muted-foreground">{job.dropoff.address}</div>}
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{job.consignee.name}</div>
                  <div className="text-xs text-muted-foreground">Receiver · {job.consignee.phone}</div>
                </div>
              </div>
              <Button variant="outline" size="icon-sm" asChild>
                <a href={`tel:${job.consignee.phone.replace(/\s/g, "")}`} aria-label={`Call ${job.consignee.name}`}>
                  <Phone />
                </a>
              </Button>
            </div>
            {job.instructions && <div className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">{job.instructions}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Charges & billing</CardTitle>
              <CardDescription>Invoiced on delivery · {job.paymentTerms}</CardDescription>
            </div>
            <StatusBadge status={payStatus} icon={false} />
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <LineItem label="Freight charge" value={peso(job.freightCharge)} />
            {job.additionalCharges.map((c) => (
              <LineItem key={c.label} label={c.label} value={peso(c.amount)} muted />
            ))}
            {job.additionalCharges.length === 0 && <LineItem label="Additional charges" value={peso(0)} muted />}
            <div className="flex items-baseline justify-between border-t pt-2">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-semibold tabular">{peso(total)}</span>
            </div>
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
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Cargo / loads</CardTitle>
              <CardDescription>
                {loads.length} load{loads.length === 1 ? "" : "s"} · {kg(job.weightKg)} gross · {job.cargoCategory}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/loads?q=${job.id}`}>Open in Loads</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 sm:pl-5">Load</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-4 font-mono text-xs sm:pl-5">{l.id}</TableCell>
                      <TableCell>
                        <div>{l.cargoDescription}</div>
                        {l.handlingNotes && <div className="max-w-[260px] truncate text-xs text-muted-foreground">{l.handlingNotes}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {unitQty(l.quantity, l.unit)}
                      </TableCell>
                      <TableCell className="text-right tabular">{kg(l.weightKg)}</TableCell>
                      <TableCell>
                        <LoadTypeBadge type={l.type} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-4 sm:pl-5" colSpan={3}>
                      Total
                    </TableCell>
                    <TableCell className="text-right tabular">{kg(sumBy(loads, (l) => l.weightKg))}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip & delivery</CardTitle>
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
                icon={Truck}
                title="Not on a trip yet"
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

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Booking, dispatch, delivery, billing and payments</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Timeline items={timeline} />
          </CardContent>
        </Card>
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
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                  <div>
                    <div className="font-medium">{peso(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.method} · {p.reference}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
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

      {dialog === "assign" && <AssignJobDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "cancel" && <CancelJobDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "pay" && <RecordPaymentDialog job={job} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
