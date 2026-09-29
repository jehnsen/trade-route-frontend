"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Anchor, CheckCircle2, ClipboardCheck, ClipboardList, FileText, Pencil, Phone, Ship, Truck, UserRound, Wallet, XCircle, Warehouse } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useSalesInvoiceMap, useStock } from "@/hooks/use-data";
import { productById, productLabel } from "@/data/products";
import { areaName, INTER_ISLAND_PARTNER } from "@/data/areas";
import { staffById } from "@/data/company";
import { itemAmount, orderLoadKg, orderNetKg, orderSubtotal, orderTotal, paymentStatusFor } from "@/lib/calc";
import { fmtDate, fmtDateTime, fmtDay, kg, peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Separator } from "@/components/ui/primitives";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddressDisplay, MoneyDisplay, PageHeader, SourceBadge, Stat, Timeline, type TimelineItem } from "@/components/shared/common";
import { StatusBadge, ReceivableBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { RecordNotFound } from "@/components/shared/states";
import { CancelOrderDialog, EditOrderDialog, RecordPaymentDialog } from "./order-dialogs";

export function OrderDetail({ id }: { id: string }) {
  const order = useAppStore((s) => s.orders.find((o) => o.id === id));
  const payments = useAppStore((s) => s.salesPayments);
  const setStatus = useAppStore((s) => s.setOrderStatus);
  const customers = useCustomerMap();
  const invoice = useSalesInvoiceMap().get(id);
  const stock = useStock();
  const [dialog, setDialog] = React.useState<"pay" | "cancel" | "edit" | null>(null);

  if (!order) return <RecordNotFound kind="Order" id={id} backHref="/orders" backLabel="Back to orders" />;

  const c = customers.get(order.customerId)!;
  const address = c.addresses.find((a) => a.id === order.addressId) ?? c.addresses[0];
  const orderPayments = payments.filter((p) => p.orderId === order.id).sort((a, b) => a.date.localeCompare(b.date));
  const payStatus = paymentStatusFor(order, invoice);
  const total = orderTotal(order);
  const salesperson = staffById(order.salespersonId);
  const open = ["Draft", "Pending Confirmation", "Confirmed", "Preparing", "Ready for Dispatch"].includes(order.status);
  const confirmedEvent = order.history.find((e) => e.label === "Order confirmed");

  // ── Delivery timeline (derived from order, trip and delivery records) ────
  const deliveryTimeline: TimelineItem[] = [{ title: "Order received", at: fmtDateTime(order.createdAt), meta: order.history[0]?.by, state: "done", icon: FileText }];
  deliveryTimeline.push({ title: "Order confirmed", at: confirmedEvent ? fmtDateTime(confirmedEvent.at) : undefined, meta: confirmedEvent?.by, state: confirmedEvent ? "done" : order.status === "Cancelled" ? "failed" : "current", icon: CheckCircle2 });
  if (order.fulfillment === "truck") {
    const out = order.history.find((e) => e.label === "Out for delivery");
    const done = order.history.find((e) => e.label === "Delivered" || e.label === "Partially delivered" || e.label.startsWith("Delivery failed"));
    deliveryTimeline.push(
      { title: "Out for delivery (own truck)", at: out ? fmtDateTime(out.at) : undefined, meta: out?.by, state: out ? "done" : "pending", icon: Truck },
      {
        title: order.cancelReason?.startsWith("Returned") ? "Delivery failed — returned to Lucena" : order.status === "Partially Delivered" ? "Partially delivered" : "Delivered",
        at: order.deliveredAt ? fmtDateTime(order.deliveredAt) : done ? fmtDateTime(done.at) : undefined,
        note: done?.note,
        state: order.cancelReason?.startsWith("Returned") ? "failed" : order.deliveredAt ? "done" : "pending",
        icon: CheckCircle2,
      },
    );
  } else if (order.fulfillment === "pickup") {
    const prepared = order.history.find((e) => e.label === "Prepared at bodega");
    const picked = order.history.find((e) => e.label === "Picked up at bodega");
    deliveryTimeline.push(
      { title: "Prepared at bodega", at: prepared ? fmtDateTime(prepared.at) : undefined, meta: prepared?.by, state: prepared ? "done" : "pending", icon: Warehouse },
      { title: "Picked up at bodega", at: picked ? fmtDateTime(picked.at) : undefined, meta: picked?.note, state: picked ? "done" : "pending", icon: ClipboardCheck },
    );
  } else {
    const handover = order.history.find((e) => e.label.startsWith("Handed over"));
    const vessel = order.history.find((e) => e.label.startsWith("Vessel"));
    deliveryTimeline.push(
      { title: `Reefer van to ${INTER_ISLAND_PARTNER.handover}`, at: handover ? fmtDateTime(handover.at) : undefined, meta: INTER_ISLAND_PARTNER.name, state: handover ? "done" : "pending", icon: Anchor },
      { title: "Vessel departed", at: vessel ? fmtDateTime(vessel.at) : undefined, state: vessel || order.deliveredAt ? "done" : "pending", icon: Ship },
      { title: `Received by regional distributor (${areaName(c.areaId)})`, at: order.deliveredAt ? fmtDateTime(order.deliveredAt) : undefined, state: order.deliveredAt ? "done" : "pending", icon: CheckCircle2 },
    );
  }

  const paymentTimeline: TimelineItem[] = [];
  if (invoice) paymentTimeline.push({ title: `Invoice ${invoice.id} issued`, at: fmtDate(invoice.issueDate), meta: `${peso(invoice.total)} · due ${fmtDate(invoice.dueDate)} (${order.paymentTerms})`, state: "done", icon: FileText });
  else paymentTimeline.push({ title: "Invoice issued on delivery", meta: `${order.paymentTerms}`, state: "pending", icon: FileText });
  for (const p of orderPayments) paymentTimeline.push({ title: `${peso(p.amount)} received — ${p.method}`, at: fmtDateTime(p.date), meta: `${p.receiptNo} · ${p.reference} · recorded by ${p.recordedBy}`, note: p.notes, state: "done", icon: Wallet });
  if (invoice && invoice.balance > 0) paymentTimeline.push({ title: `${peso(invoice.balance)} outstanding`, meta: invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days overdue` : `Due ${fmtDate(invoice.dueDate)}`, state: invoice.daysOverdue > 0 ? "failed" : "current", icon: Wallet });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Orders", href: "/orders" }, { label: order.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {order.id} <StatusBadge status={order.status} /> <StatusBadge status={payStatus} icon={false} label={`Payment: ${payStatus}`} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SourceBadge source={order.source} /> {c.name} · {fmtDay(order.deliveryDate)}
            {order.deliveryWindow && <> · receiving {order.deliveryWindow}</>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDialog("edit")} disabled={!open}>
              <Pencil /> Edit Order
            </Button>
            {(order.status === "Pending Confirmation" || order.status === "Draft") && (
              <Button
                size="sm"
                onClick={() => {
                  setStatus(order.id, "Confirmed");
                  toast.success(`${order.id} confirmed`, { description: "Stock reserved." });
                }}
              >
                <CheckCircle2 /> Confirm
              </Button>
            )}
            {order.fulfillment === "truck" && open && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/jobs/new?customer=${order.customerId}`}>
                  <ClipboardList /> Book delivery job
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setDialog("pay")} disabled={order.status === "Cancelled" || order.status === "Draft" || payStatus === "Paid"}>
              <Wallet /> Record Payment
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-danger-soft hover:text-destructive" onClick={() => setDialog("cancel")} disabled={!open}>
              <XCircle /> Cancel Order
            </Button>
          </>
        }
      />

      {order.status === "Cancelled" && order.cancelReason && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">Cancelled — {order.cancelReason}</div>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>
                  {order.items.length} line{order.items.length > 1 ? "s" : ""} · net {kg(orderNetKg(order))} · truck load ≈ {kg(orderLoadKg(order))} incl. ice & packaging
                </CardDescription>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {open && <TableHead>Stock</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((i) => {
                  const p = productById(i.productId);
                  const st = stock.get(p.id)!;
                  return (
                    <TableRow key={i.productId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ProductImage product={p} size="sm" />
                          <div>
                            <div className="font-medium">{productLabel(p)}</div>
                            <div className="text-xs text-muted-foreground">{p.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {i.quantity.toLocaleString()}
                        {i.deliveredQty !== undefined && i.deliveredQty !== i.quantity && <div className="text-xs text-[oklch(0.55_0.13_65)]">delivered {i.deliveredQty}</div>}
                      </TableCell>
                      <TableCell>{p.unit === "pc" ? "pcs" : "kg"}</TableCell>
                      <TableCell className="text-right tabular">{peso(i.unitPrice)}</TableCell>
                      <TableCell className="text-right font-medium tabular">{peso(itemAmount(i))}</TableCell>
                      {open && (
                        <TableCell className="text-xs">
                          {st.shortage > 0 ? (
                            <span className="text-danger">Short {qty(st.shortage, p.unit)} across open orders</span>
                          ) : st.onHand - st.damaged >= st.demand ? (
                            <span className="text-[oklch(0.45_0.13_150)]">Reserved from bodega</span>
                          ) : (
                            <span className="text-muted-foreground">Covered by incoming PO</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter className="bg-transparent">
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right text-muted-foreground">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right tabular">{peso(orderSubtotal(order))}</TableCell>
                  {open && <TableCell />}
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right text-muted-foreground">
                    Wholesale discount
                  </TableCell>
                  <TableCell className="text-right tabular">{order.discount ? `−${peso(order.discount)}` : "—"}</TableCell>
                  {open && <TableCell />}
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right text-muted-foreground">
                    {order.fulfillment === "partner" ? "Reefer freight (billed at cost)" : "Delivery fee"}
                  </TableCell>
                  <TableCell className="text-right tabular">{order.deliveryFee ? peso(order.deliveryFee) : "Free"}</TableCell>
                  {open && <TableCell />}
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Total
                  </TableCell>
                  <TableCell className="text-right text-base font-semibold tabular">{peso(total)}</TableCell>
                  {open && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
            {order.notes && (
              <div className="border-t px-5 py-3 text-sm">
                <span className="font-medium">Notes: </span>
                <span className="text-muted-foreground">{order.notes}</span>
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Delivery timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <Timeline items={deliveryTimeline} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Payment timeline</CardTitle>
                {invoice && (
                  <Link href={`/accounts-receivable/${invoice.id}`} className="text-xs font-medium text-primary hover:underline">
                    View invoice
                  </Link>
                )}
              </CardHeader>
              <CardContent>
                <Timeline items={paymentTimeline} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Order activity</CardTitle>
                <CardDescription>Every change is logged — no more “sino nag-edit?”</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2.5">
                {[...order.history].reverse().map((e, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap justify-between gap-x-3">
                        <span className="font-medium">{e.label}</span>
                        <span className="text-xs text-muted-foreground tabular">{fmtDateTime(e.at)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{e.by}</div>
                      {e.note && <div className="mt-0.5 text-xs text-foreground/80">{e.note}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <Link href={`/customers/${c.id}`} className="text-xs font-medium text-primary hover:underline">
                View profile
              </Link>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div>
                <div className="font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.type} · {c.id}
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div>{c.contacts[0].name}</div>
                  <div className="text-xs text-muted-foreground">{c.contacts[0].position}</div>
                </div>
              </div>
              <a href={`tel:${c.contacts[0].phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm hover:underline">
                <Phone className="size-4 text-muted-foreground" /> {c.contacts[0].phone}
              </a>
              <Separator />
              <div className="text-xs font-medium text-muted-foreground">Delivery address</div>
              <AddressDisplay address={address} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
              {invoice && <ReceivableBadge daysOverdue={invoice.daysOverdue} balance={invoice.balance} />}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Payment terms" value={order.paymentTerms} />
              <Stat label="Status" value={<StatusBadge status={payStatus} icon={false} />} />
              <Stat label="Invoice" value={invoice ? invoice.id : "On delivery"} sub={invoice ? `Due ${fmtDate(invoice.dueDate)}` : undefined} />
              <Stat label="Paid" value={<MoneyDisplay amount={invoice?.paid ?? 0} />} />
              <Stat label="Balance" value={<MoneyDisplay amount={invoice ? invoice.balance : total} className={invoice && invoice.daysOverdue > 0 ? "text-danger" : ""} />} className="col-span-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fulfilment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {order.fulfillment === "pickup" ? (
                <p className="text-sm text-muted-foreground">Customer picks up at the Lucena Main Warehouse (bodega).</p>
              ) : order.fulfillment === "partner" ? (
                <p className="text-sm text-muted-foreground">{INTER_ISLAND_PARTNER.note}. Handled by {INTER_ISLAND_PARTNER.name}.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Delivered on our own trucks. In the logistics system, the truck movement for a sales order is booked as a logistics job and planned on the Dispatch board.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Stat label="Sales source" value={<SourceBadge source={order.source} />} />
              <Stat label="Salesperson" value={salesperson?.name ?? "—"} />
              <Stat label="Order received" value={fmtDateTime(order.createdAt)} />
              <Stat label="Requested delivery" value={fmtDay(order.deliveryDate)} />
            </CardContent>
          </Card>
        </div>
      </div>

      {dialog === "pay" && <RecordPaymentDialog order={order} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "cancel" && <CancelOrderDialog order={order} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "edit" && <EditOrderDialog order={order} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
