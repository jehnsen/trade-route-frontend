"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, Pause, Pencil, Play, Plus, Printer, Trash2, Truck } from "lucide-react";
import type { Order, StandingOrder, Weekday } from "@/types";
import { useAppStore, PORTAL_CUSTOMER_ID, useHydrated } from "@/lib/store";
import { useCustomerStats, useInvoices } from "@/hooks/use-data";
import { PRODUCTS, productById, productLabel } from "@/data/products";
import { truckById } from "@/data/fleet";
import { orderTotal } from "@/lib/calc";
import { orderSummary } from "@/lib/domain";
import { fmtDate, fmtDateTime, fmtDay, fmtTime, peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, Input, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/shared/common";
import { ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PodCard } from "@/components/shared/pod";

const DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function customerStatus(o: Order): string {
  if (o.status === "Pending Confirmation" || o.status === "Draft") return "Waiting Confirmation";
  if (o.status === "Confirmed" || o.status === "Preparing" || o.status === "Ready for Dispatch") return o.tripId ? "Scheduled" : "Confirmed";
  if (o.status === "Out for Delivery") return "In Transit";
  return o.status;
}
const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "teal" | "danger" | "muted"> = {
  "Waiting Confirmation": "warning",
  Confirmed: "success",
  Scheduled: "info",
  "In Transit": "teal",
  Delivered: "success",
  "Partially Delivered": "warning",
  Cancelled: "danger",
};

export function MyOrders({ initialTab }: { initialTab?: string }) {
  const hydrated = useHydrated((s) => s.hydrated);
  const orders = useAppStore((s) => s.orders);
  const quotes = useAppStore((s) => s.quoteRequests);
  const payments = useAppStore((s) => s.payments);
  const deliveries = useAppStore((s) => s.deliveries);
  const trips = useAppStore((s) => s.trips);
  const standing = useAppStore((s) => s.standingOrders);
  const setSO = useAppStore((s) => s.setStandingOrderStatus);
  const customer = useAppStore((s) => s.customers.find((c) => c.id === PORTAL_CUSTOMER_ID))!;
  const invoices = useInvoices().filter((i) => i.customerId === PORTAL_CUSTOMER_ID);
  const stats = useCustomerStats().get(PORTAL_CUSTOMER_ID)!;
  const [editing, setEditing] = React.useState<StandingOrder | "new" | null>(null);

  const mine = orders.filter((o) => o.customerId === PORTAL_CUSTOMER_ID && o.status !== "Draft").sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.createdAt.localeCompare(a.createdAt));
  const myDeliveries = deliveries.filter((d) => mine.some((o) => o.id === d.orderId)).sort((a, b) => b.eta.localeCompare(a.eta));
  const myQuotes = quotes.filter((q) => q.customerId === PORTAL_CUSTOMER_ID || q.businessName === customer.name);
  const myPayments = payments.filter((p) => p.customerId === PORTAL_CUSTOMER_ID).sort((a, b) => b.date.localeCompare(a.date));
  const mySO = standing.filter((s) => s.customerId === PORTAL_CUSTOMER_ID);
  const upcoming = mine.filter((o) => ["Waiting Confirmation", "Confirmed", "Scheduled", "In Transit"].includes(customerStatus(o)));

  if (!hydrated)
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8">
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Orders</h1>
          <p className="text-sm text-muted-foreground">
            {customer.name} · {customer.paymentTerms} · account {customer.id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/request-quote">Request quote</Link>
          </Button>
          <Button asChild>
            <Link href="/products">
              <Plus /> New order
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Open orders" value={String(upcoming.length)} />
        <Tile label="Outstanding balance" value={peso(stats.outstanding)} tone={stats.overdue ? "danger" : undefined} sub={stats.overdue ? `${peso(stats.overdue)} overdue` : "Nothing overdue"} />
        <Tile label="Credit limit" value={peso(customer.creditLimit)} sub={`${peso(Math.max(0, customer.creditLimit - stats.outstanding))} available`} />
        <Tile label="Standing orders" value={String(mySO.filter((s) => s.status === "active").length)} sub="active weekly orders" />
      </div>

      <Tabs defaultValue={initialTab ?? "orders"} className="mt-6">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="standing">Standing Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="grid gap-3">
          {mine.length === 0 && <EmptyState title="No orders yet" />}
          {mine.slice(0, 20).map((o) => {
            const st = customerStatus(o);
            const d = deliveries.find((x) => x.orderId === o.id);
            const t = trips.find((x) => x.id === o.tripId);
            return (
              <Card key={o.id} className="gap-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{o.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Ordered {fmtDateTime(o.createdAt)} via {o.source}
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[st] ?? "outline"}>{st}</Badge>
                </div>
                <div className="text-sm">{orderSummary(o, 4)}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Delivery {fmtDay(o.deliveryDate)}
                    {t && d && ` · ${truckById(t.truckId).code} · ETA ${fmtTime(d.eta)}`}
                  </span>
                  <span className="font-semibold tabular">{peso(orderTotal(o))}</span>
                </div>
                {st === "Waiting Confirmation" && <p className="rounded-md bg-warning-soft px-3 py-2 text-xs">Received — subject to stock, pricing and delivery confirmation by our order desk.</p>}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="quotes" className="grid gap-3">
          {myQuotes.length === 0 ? (
            <EmptyState title="No quote requests" action={<Button asChild size="sm"><Link href="/request-quote">Request a quote</Link></Button>} />
          ) : (
            myQuotes.map((q) => (
              <Card key={q.id} className="gap-1 p-4">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{q.id}</span>
                  <StatusBadge status={q.status} icon={false} />
                </div>
                <div className="text-sm">
                  {productLabel(productById(q.productId))} · {q.quantity.toLocaleString()} {q.unit} · {q.frequency}
                </div>
                <div className="text-xs text-muted-foreground">
                  {q.deliveryArea} · first delivery {fmtDate(q.preferredDate)} · submitted {fmtDateTime(q.createdAt)}
                </div>
                {q.quotedPrice && (
                  <div className="mt-1 text-sm">
                    Quoted price <b>{peso(q.quotedPrice)}/kg</b>{" "}
                    <Button size="sm" variant="link" className="h-auto p-0" onClick={() => toast.success("Quote accepted — our desk will schedule it (demo)")}>
                      Accept quote
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="deliveries" className="grid gap-3 md:grid-cols-2">
          {myDeliveries.slice(0, 10).map((d) => {
            const o = mine.find((x) => x.id === d.orderId)!;
            const t = trips.find((x) => x.id === d.tripId)!;
            return (
              <Card key={d.id} className="gap-2 p-4">
                <div className="flex justify-between gap-2">
                  <span className="font-semibold">{d.id}</span>
                  <StatusBadge status={d.status} />
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Truck className="size-4" /> {truckById(t.truckId).code} · {fmtDay(t.date)} · ETA {fmtTime(d.eta)}
                  {d.completedAt && ` · delivered ${fmtTime(d.completedAt)}`}
                </div>
                <div className="text-sm">{orderSummary(o)}</div>
                {d.pod && <PodCard pod={d.pod} title="Proof of delivery" />}
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <div className="divide-y">
              {invoices.length === 0 && <EmptyState title="No invoices yet" className="m-4" />}
              {[...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).map((i) => (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{i.id}</div>
                    <div className="text-xs text-muted-foreground">
                      Issued {fmtDate(i.issueDate)} · due {fmtDate(i.dueDate)} · {peso(i.total)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular">{peso(i.balance)}</span>
                    <ReceivableBadge daysOverdue={i.daysOverdue} balance={i.balance} />
                    <Button variant="ghost" size="icon-sm" aria-label={`Print ${i.id}`} onClick={() => toast("Your statement PDF will be e-mailed (demo)")}>
                      <Printer />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="overflow-hidden">
            <div className="divide-y">
              {myPayments.length === 0 && <EmptyState title="No payments recorded yet" className="m-4" />}
              {myPayments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="font-medium">{p.receiptNo}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(p.date)} · {p.method} · {p.reference} · for {p.invoiceId}
                    </div>
                  </div>
                  <span className="font-semibold tabular">{peso(p.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="standing">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Recurring weekly orders — generated automatically 3 days before each delivery.</p>
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus /> New standing order
            </Button>
          </div>
          {mySO.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No standing orders yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mySO.map((so) => (
                <Card key={so.id} className="gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Every {so.day}</span>
                    <StatusBadge status={so.status} icon={false} />
                  </div>
                  <ul className="text-sm">
                    {so.lines.map((l) => (
                      <li key={l.productId} className="flex justify-between">
                        <span>{productById(l.productId).name.split(" / ")[0]}</span>
                        <span className="tabular">{qty(l.quantity, productById(l.productId).unit)}</span>
                      </li>
                    ))}
                  </ul>
                  {so.notes && <p className="text-xs text-muted-foreground">{so.notes}</p>}
                  {so.status !== "cancelled" && (
                    <div className="flex flex-wrap gap-1">
                      {so.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => { setSO(so.id, "paused"); toast.success(`${so.day} order paused`); }}>
                          <Pause /> Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setSO(so.id, "active"); toast.success(`${so.day} order resumed`); }}>
                          <Play /> Resume
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditing(so)}>
                        <Pencil /> Edit
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 /> Cancel
                          </Button>
                        }
                        title={`Cancel your ${so.day} standing order?`}
                        description="No more weekly orders will be generated for this day."
                        confirmLabel="Cancel standing order"
                        destructive
                        onConfirm={() => { setSO(so.id, "cancelled"); toast.success("Standing order cancelled"); }}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      {editing && <StandingOrderDialog so={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" }) {
  return (
    <Card className="gap-0.5 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular ${tone === "danger" ? "text-danger" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function StandingOrderDialog({ so, onClose }: { so?: StandingOrder; onClose: () => void }) {
  const save = useAppStore((s) => s.saveStandingOrder);
  const [day, setDay] = React.useState<Weekday>(so?.day ?? "Monday");
  const [lines, setLines] = React.useState(so?.lines ?? [{ productId: "P-SUG-J", quantity: 80 }]);
  const [error, setError] = React.useState<string>();
  const submit = () => {
    const bad = lines.find((l) => !l.productId || l.quantity < productById(l.productId).moq);
    if (bad) return setError(`Each line needs a product and at least the minimum order (${bad.productId ? qty(productById(bad.productId).moq, productById(bad.productId).unit) : "choose a product"}).`);
    save({ id: so?.id, customerId: PORTAL_CUSTOMER_ID, day, lines, status: so?.status ?? "active", startDate: so?.startDate ?? "2026-09-28", notes: so?.notes });
    toast.success(so ? "Standing order updated" : `Standing order for every ${day} created`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{so ? "Edit standing order" : "New standing order"}</DialogTitle>
          <DialogDescription>Delivered every week on the chosen day, at your account&apos;s agreed prices.</DialogDescription>
        </DialogHeader>
        <Field label="Delivery day" htmlFor="so-day">
          <Select value={day} onValueChange={(v) => setDay(v as Weekday)}>
            <SelectTrigger id="so-day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d) => (
                <SelectItem key={d} value={d}>
                  Every {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_36px] items-end gap-2">
              <Field label={i === 0 ? "Product" : ""} htmlFor={`so-p-${i}`}>
                <Select value={l.productId} onValueChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, productId: v } : x)))}>
                  <SelectTrigger id={`so-p-${i}`}>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.filter((p) => p.category === "seafood").map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {productLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={i === 0 ? "Qty (kg)" : ""} htmlFor={`so-q-${i}`}>
                <Input id={`so-q-${i}`} type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x)))} />
              </Field>
              <Button variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setLines([...lines, { productId: "", quantity: 0 }])}>
            <Plus /> Add product
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save standing order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
