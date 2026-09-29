"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Printer, Send, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices } from "@/hooks/use-data";
import { COMPANY } from "@/data/company";
import { truckById } from "@/data/fleet";
import { fmtDate, fmtDateTime, kg, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineItem, PageHeader, Stat } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { RecordNotFound } from "@/components/shared/states";
import { Logo } from "@/components/layout/brand";
import { RecordPaymentDialog } from "./record-payment-dialog";

/** Freight billing statement for one delivered job. */
export function InvoiceDetail({ id, autoPrint }: { id: string; autoPrint?: boolean }) {
  const invoice = useInvoices().find((i) => i.id === id);
  const job = useAppStore((s) => s.jobs.find((j) => j.id === invoice?.jobId));
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const payments = useAppStore((s) => s.payments);
  const customers = useCustomerMap();
  const stats = useCustomerStats();
  const [paying, setPaying] = React.useState(false);
  React.useEffect(() => {
    if (autoPrint && invoice) setTimeout(() => window.print(), 400);
  }, [autoPrint, invoice]);

  if (!invoice || !job) return <RecordNotFound kind="Invoice" id={id} backHref="/accounts-receivable" backLabel="Back to receivables" />;
  const c = customers.get(invoice.customerId)!;
  const trip = trips.find((t) => t.id === job.tripId);
  const delivery = deliveries.find((d) => d.jobId === job.id);
  const invPayments = payments.filter((p) => p.invoiceId === id).sort((a, b) => a.date.localeCompare(b.date));
  const cs = stats.get(c.id)!;
  const addr = c.addresses[0];

  return (
    <>
      <div className="no-print">
        <PageHeader
          breadcrumbs={[{ label: "Receivables", href: "/accounts-receivable" }, { label: invoice.id }]}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {invoice.id} <StatusBadge status={invoice.status} icon={false} /> <ReceivableBadge daysOverdue={invoice.daysOverdue} balance={invoice.balance} />
            </span>
          }
          description={`${c.name} · job ${job.id} · ${job.paymentTerms}`}
          actions={
            <>
              <Button size="sm" onClick={() => setPaying(true)} disabled={invoice.balance <= 0}>
                <Wallet /> Record payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success(`Reminder sent to ${c.contacts[0].name}`, { description: `${peso(invoice.balance)} due ${fmtDate(invoice.dueDate)} — via Messenger & SMS (demo).` })} disabled={invoice.balance <= 0}>
                <Send /> Send reminder
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/customers/${c.id}`}>
                  <Eye /> View customer
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Printer /> Print billing statement
              </Button>
            </>
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
              <Logo tone="light" />
              <div className="mt-2 text-sm font-semibold">{COMPANY.name}</div>
              <div className="text-xs text-muted-foreground">{COMPANY.address}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-lg font-bold">FREIGHT BILLING</div>
              <div className="font-mono">{invoice.id}</div>
              <div className="text-muted-foreground">Issued {fmtDate(invoice.issueDate)}</div>
              <div className="text-muted-foreground">Due {fmtDate(invoice.dueDate)}</div>
            </div>
          </div>
          <div className="grid gap-4 border-b py-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Bill to</div>
              <div className="font-semibold">{c.name}</div>
              <div>{addr.line1}</div>
              <div className="text-muted-foreground">
                {addr.barangay !== "—" ? `${addr.barangay}, ` : ""}
                {addr.city}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Job" value={<Link href={`/jobs/${job.id}`} className="text-primary hover:underline">{job.id}</Link>} />
              <Stat label="Trip" value={trip ? <Link href={`/trips/${trip.id}`} className="text-primary hover:underline">{trip.id}</Link> : "—"} sub={trip ? `${truckById(trip.truckId).code} · ${truckById(trip.truckId).plateNo}` : undefined} />
              <Stat label="Delivery receipt" value={delivery?.pod?.receiptNo ?? "—"} sub={delivery?.pod ? `received by ${delivery.pod.receivedBy}` : undefined} />
              <Stat label="Delivered" value={job.deliveredAt ? fmtDate(job.deliveredAt) : "—"} />
            </div>
          </div>
          <Table className="mt-2">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <div className="font-medium">
                    Freight — {job.cargoDescription}, {kg(job.weightKg)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {job.pickup.name} → {job.dropoff.name} · {job.truckRequirement}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular">{peso(job.freightCharge, true)}</TableCell>
              </TableRow>
              {job.additionalCharges.map((ch) => (
                <TableRow key={ch.label}>
                  <TableCell>{ch.label}</TableCell>
                  <TableCell className="text-right tabular">{peso(ch.amount, true)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-3 ml-auto grid w-full max-w-72 gap-1 text-sm">
            <LineItem label="Total" value={peso(invoice.total, true)} strong />
            <LineItem label="Payments received" value={`−${peso(invoice.paid, true)}`} muted />
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <span>Balance due</span>
              <span className={invoice.balance > 0 && invoice.daysOverdue > 0 ? "text-danger tabular" : "tabular"}>{peso(invoice.balance, true)}</span>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Pay via bank transfer ({COMPANY.bankAccountMasked}) or GCash ({COMPANY.gcashMasked}). Please quote {invoice.id}. Demo document — not an official receipt.
          </p>
        </Card>
        <div className="grid content-start gap-4 no-print">
          <Card>
            <CardHeader>
              <CardTitle>Payments on this invoice</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {invPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet.</p>
              ) : (
                invPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                    <div>
                      <div className="font-medium">{peso(p.amount)}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.method} · {p.reference}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="font-mono">{p.receiptNo}</div>
                      {fmtDateTime(p.date)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{c.name} — account</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <LineItem label="Total outstanding" value={peso(cs.outstanding)} strong />
              <LineItem label="Overdue" value={peso(cs.overdue)} className={cs.overdue ? "text-danger" : ""} />
              <LineItem label="Credit limit" value={c.creditLimit ? peso(c.creditLimit) : "COD only"} muted />
              <LineItem label="Terms" value={c.paymentTerms} muted />
            </CardContent>
          </Card>
        </div>
      </div>
      {paying && <RecordPaymentDialog job={job} open onOpenChange={setPaying} />}
    </>
  );
}
