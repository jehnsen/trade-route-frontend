"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Printer, Send, Wallet } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats, useInvoices } from "@/hooks/use-data";
import { COMPANY } from "@/data/company";
import { productById, productLabel } from "@/data/products";
import { itemDeliveredAmount, orderIdForInvoice } from "@/lib/calc";
import { fmtDate, fmtDateTime, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Stat } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { RecordNotFound } from "@/components/shared/states";
import { Logo } from "@/components/layout/brand";
import { RecordPaymentDialog } from "@/features/orders/order-dialogs";

export function InvoiceDetail({ id, autoPrint }: { id: string; autoPrint?: boolean }) {
  const invoice = useInvoices().find((i) => i.id === id);
  const order = useAppStore((s) => s.orders.find((o) => o.id === orderIdForInvoice(id)));
  const payments = useAppStore((s) => s.payments);
  const customers = useCustomerMap();
  const stats = useCustomerStats();
  const [paying, setPaying] = React.useState(false);
  React.useEffect(() => {
    if (autoPrint && invoice) setTimeout(() => window.print(), 400);
  }, [autoPrint, invoice]);

  if (!invoice || !order) return <RecordNotFound kind="Invoice" id={id} backHref="/accounts-receivable" backLabel="Back to receivables" />;
  const c = customers.get(invoice.customerId)!;
  const address = c.addresses.find((a) => a.id === order.addressId) ?? c.addresses[0];
  const invPayments = payments.filter((p) => p.invoiceId === id).sort((a, b) => a.date.localeCompare(b.date));
  const cs = stats.get(c.id)!;

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
          description={`${c.name} · order ${order.id} · ${order.paymentTerms}`}
          actions={
            <>
              <Button size="sm" onClick={() => setPaying(true)} disabled={invoice.balance <= 0}>
                <Wallet /> Record Payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.success(`Reminder sent to ${c.contacts[0].name}`, { description: `${peso(invoice.balance)} due ${fmtDate(invoice.dueDate)} — via Messenger & SMS (demo).` })} disabled={invoice.balance <= 0}>
                <Send /> Send Reminder
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/customers/${c.id}`}>
                  <Eye /> View Customer
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Printer /> Print Statement
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
              <div className="text-lg font-bold">SALES INVOICE</div>
              <div className="font-mono">{invoice.id}</div>
              <div className="text-muted-foreground">Issued {fmtDate(invoice.issueDate)}</div>
              <div className="text-muted-foreground">Due {fmtDate(invoice.dueDate)}</div>
            </div>
          </div>
          <div className="grid gap-4 border-b py-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Bill to</div>
              <div className="font-semibold">{c.name}</div>
              <div>{address.line1}</div>
              <div className="text-muted-foreground">
                {address.barangay}, {address.city}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Order" value={<Link href={`/orders/${order.id}`} className="text-primary hover:underline">{order.id}</Link>} />
              <Stat label="Delivery receipt" value={order.id.replace("FR-", "DR-")} />
              <Stat label="Terms" value={order.paymentTerms} />
              <Stat label="Delivered" value={order.deliveredAt ? fmtDate(order.deliveredAt) : "—"} />
            </div>
          </div>
          <Table className="mt-2">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((i) => {
                const p = productById(i.productId);
                return (
                  <TableRow key={i.productId}>
                    <TableCell>{productLabel(p)}</TableCell>
                    <TableCell className="text-right tabular">
                      {(i.deliveredQty ?? i.quantity).toLocaleString()} {p.unit === "pc" ? "pcs" : "kg"}
                    </TableCell>
                    <TableCell className="text-right tabular">{peso(i.unitPrice, true)}</TableCell>
                    <TableCell className="text-right tabular">{peso(itemDeliveredAmount(i), true)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-3 ml-auto grid w-full max-w-xs gap-1 text-sm">
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular">−{peso(order.discount, true)}</span>
              </div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery / freight</span>
                <span className="tabular">{peso(order.deliveryFee, true)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Invoice total</span>
              <span className="tabular">{peso(invoice.total, true)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payments received</span>
              <span className="tabular">−{peso(invoice.paid, true)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Balance due</span>
              <span className={`tabular ${invoice.daysOverdue ? "text-danger" : ""}`}>{peso(invoice.balance, true)}</span>
            </div>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">Please pay via bank transfer to account {COMPANY.bankAccountMasked} or GCash {COMPANY.gcashMasked}, and send the reference to {COMPANY.mobile}. Demo document.</p>
        </Card>
        <div className="grid content-start gap-4 no-print">
          <Card>
            <CardHeader>
              <CardTitle>Payments applied</CardTitle>
            </CardHeader>
            {invPayments.length ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Receipt</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.receiptNo}</div>
                        <div className="text-xs text-muted-foreground">{fmtDateTime(p.date)}</div>
                      </TableCell>
                      <TableCell>
                        {p.method}
                        <div className="text-xs text-muted-foreground">{p.reference}</div>
                      </TableCell>
                      <TableCell className="text-right tabular">{peso(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <CardContent className="text-sm text-muted-foreground">No payments yet.</CardContent>
            )}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Customer account</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Total outstanding" value={peso(cs.outstanding)} />
              <Stat label="Overdue" value={<span className={cs.overdue ? "text-danger" : ""}>{peso(cs.overdue)}</span>} />
              <Stat label="Credit limit" value={c.creditLimit ? peso(c.creditLimit) : "COD only"} />
              <Stat label="Contact" value={c.contacts[0].name} sub={c.contacts[0].phone} />
            </CardContent>
          </Card>
        </div>
      </div>
      {paying && <RecordPaymentDialog order={order} open onOpenChange={setPaying} />}
    </>
  );
}
