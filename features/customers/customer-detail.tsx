"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { CalendarClock, MessageCircle, Pause, Phone, Play, Plus, ShoppingCart, Star, Trash2, UserRound, Send } from "lucide-react";
import type { Invoice, Order, Payment, StandingOrder, Weekday } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerStats, useInvoices } from "@/hooks/use-data";
import { productById, productLabel } from "@/data/products";
import { areaById } from "@/data/areas";
import { staffById } from "@/data/company";
import { orderTotal, paymentStatusFor } from "@/lib/calc";
import { frequencyLabel, isLive } from "@/lib/selectors";
import { orderSummary } from "@/lib/domain";
import { fmtDate, fmtDateShort, fmtDateTime, peso, pesoCompact, pct, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { AddressDisplay, CapacityBar, KPICard, MoneyDisplay, PageHeader, SourceBadge, Stat, EmptyState, Timeline } from "@/components/shared/common";
import { StatusBadge, ReceivableBadge } from "@/components/shared/status-badge";
import { ProductImage } from "@/components/shared/product-image";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RecordNotFound } from "@/components/shared/states";
import { Columns } from "@/components/charts/charts";

const DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CustomerDetail({ id }: { id: string }) {
  const router = useRouter();
  const customer = useAppStore((s) => s.customers.find((c) => c.id === id));
  const orders = useAppStore((s) => s.orders);
  const payments = useAppStore((s) => s.payments);
  const standing = useAppStore((s) => s.standingOrders);
  const setSO = useAppStore((s) => s.setStandingOrderStatus);
  const leads = useAppStore((s) => s.leads);
  const stats = useCustomerStats().get(id);
  const invoices = useInvoices();

  if (!customer || !stats) return <RecordNotFound kind="Customer" id={id} backHref="/customers" backLabel="Back to customers" />;

  const cOrders = orders.filter((o) => o.customerId === id).sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.id.localeCompare(a.id));
  const cInvoices = invoices.filter((i) => i.customerId === id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const invMap = new Map(cInvoices.map((i) => [i.orderId, i]));
  const cPayments = payments.filter((p) => p.customerId === id).sort((a, b) => b.date.localeCompare(a.date));
  const cStanding = standing.filter((s) => s.customerId === id);
  const sp = staffById(customer.salespersonId);
  const area = areaById(customer.areaId);
  const lead = leads.find((l) => l.convertedCustomerId === id);

  // Weekly purchases (last 5 weeks, Mon–Sat)
  const weeks = ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21"].map((start, i, arr) => {
    const end = arr[i + 1] ?? "2026-09-28";
    const rev = cOrders.filter((o) => isLive(o) && o.status !== "Pending Confirmation" && o.deliveryDate >= start && o.deliveryDate < end && !o.notes?.startsWith("Opening balance")).reduce((s, o) => s + orderTotal(o), 0);
    return { week: `Wk of ${fmtDateShort(start)}`, Purchases: rev };
  });

  // Preferred products by volume
  const byProduct = new Map<string, number>();
  for (const o of cOrders) if (isLive(o)) for (const i of o.items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.quantity * i.unitPrice);
  const preferred = [...new Set([...[...byProduct.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p), ...customer.preferredProductIds])].slice(0, 5);

  const creditUse = customer.creditLimit ? stats.outstanding / customer.creditLimit : 0;

  const orderCols: ColumnDef<Order, unknown>[] = [
    { id: "id", header: "Order No.", accessorFn: (o) => o.id, cell: ({ row }) => <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/orders/${row.original.id}`}>{row.original.id}</Link> },
    { id: "date", header: "Delivery", accessorFn: (o) => o.deliveryDate, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.deliveryDate)}</span> },
    { id: "source", header: "Source", accessorFn: (o) => o.source, cell: ({ row }) => <SourceBadge source={row.original.source} short /> },
    { id: "items", header: "Products", enableSorting: false, cell: ({ row }) => <span className="block max-w-[260px] truncate text-muted-foreground">{orderSummary(row.original, 3)}</span> },
    { id: "total", header: "Total", accessorFn: (o) => orderTotal(o), meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={orderTotal(row.original)} /> },
    { id: "pay", header: "Payment", cell: ({ row }) => <StatusBadge status={paymentStatusFor(row.original, invMap.get(row.original.id))} icon={false} /> },
    { id: "status", header: "Status", accessorFn: (o) => o.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];
  const invCols: ColumnDef<Invoice, unknown>[] = [
    { id: "id", header: "Invoice", accessorFn: (i) => i.id, cell: ({ row }) => <Link className="font-medium whitespace-nowrap text-primary hover:underline" href={`/accounts-receivable/${row.original.id}`}>{row.original.id}</Link> },
    { id: "issue", header: "Issued", accessorFn: (i) => i.issueDate, cell: ({ row }) => fmtDate(row.original.issueDate) },
    { id: "due", header: "Due", accessorFn: (i) => i.dueDate, cell: ({ row }) => fmtDate(row.original.dueDate) },
    { id: "total", header: "Amount", accessorFn: (i) => i.total, meta: { align: "right" }, cell: ({ row }) => peso(row.original.total) },
    { id: "paid", header: "Paid", accessorFn: (i) => i.paid, meta: { align: "right" }, cell: ({ row }) => peso(row.original.paid) },
    { id: "bal", header: "Balance", accessorFn: (i) => i.balance, meta: { align: "right" }, cell: ({ row }) => <span className={row.original.daysOverdue > 0 ? "font-medium text-danger" : "font-medium"}>{peso(row.original.balance)}</span> },
    { id: "aging", header: "Aging", accessorFn: (i) => i.daysOverdue, cell: ({ row }) => <ReceivableBadge daysOverdue={row.original.daysOverdue} balance={row.original.balance} /> },
  ];
  const payCols: ColumnDef<Payment, unknown>[] = [
    { id: "r", header: "Receipt No.", accessorFn: (p) => p.receiptNo, cell: ({ row }) => <span className="font-medium whitespace-nowrap">{row.original.receiptNo}</span> },
    { id: "date", header: "Date", accessorFn: (p) => p.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateTime(row.original.date)}</span> },
    { id: "inv", header: "Invoice", accessorFn: (p) => p.invoiceId, cell: ({ row }) => <Link className="text-primary hover:underline" href={`/accounts-receivable/${row.original.invoiceId}`}>{row.original.invoiceId}</Link> },
    { id: "m", header: "Method", accessorFn: (p) => p.method },
    { id: "ref", header: "Reference", accessorFn: (p) => p.reference, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { id: "amt", header: "Amount", accessorFn: (p) => p.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{peso(row.original.amount)}</span> },
  ];

  const activity = [
    ...cOrders.slice(0, 8).map((o) => ({ at: o.createdAt, title: `Order ${o.id} — ${peso(orderTotal(o))}`, meta: `${o.source} · ${o.status}`, kind: "order" as const })),
    ...cPayments.slice(0, 6).map((p) => ({ at: p.date, title: `Payment ${peso(p.amount)} via ${p.method}`, meta: `${p.receiptNo} · ${p.invoiceId}`, kind: "pay" as const })),
    ...(lead ? lead.activities.map((a) => ({ at: a.at, title: a.note, meta: `Lead ${lead.id} · ${a.by}`, kind: "lead" as const })) : []),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {customer.name} <StatusBadge status={customer.status} icon={false} />
          </span>
        }
        description={`${customer.type} · ${area.name}, ${area.province} · ${customer.id} · customer since ${fmtDate(customer.customerSince)}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${customer.contacts[0].phone.replace(/\s/g, "")}`}>
                <Phone /> Call
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => toast.success("Reminder queued", { description: `Statement of account will be sent to ${customer.contacts[0].name} via Messenger/SMS (demo).` })} disabled={!stats.outstanding}>
              <Send /> Send Statement
            </Button>
            <Button size="sm" asChild>
              <Link href={`/orders/new?customer=${customer.id}`}>
                <ShoppingCart /> New Order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KPICard label="Outstanding balance" value={<MoneyDisplay amount={stats.outstanding} />} hint={stats.overdue ? <span className="text-danger">{peso(stats.overdue)} overdue</span> : "Nothing overdue"} tone={stats.overdue ? "danger" : "default"} />
        <KPICard label="Lifetime sales" value={pesoCompact(stats.lifetimeSales)} hint="incl. pre-go-live ledger" />
        <KPICard label="Sales, last 30 days" value={pesoCompact(stats.windowSales)} hint={`${stats.orders} orders`} />
        <KPICard label="Average order" value={stats.avgOrder ? peso(stats.avgOrder) : "—"} />
        <KPICard label="Order frequency" value={frequencyLabel(stats.ordersPerWeek)} hint={`${stats.ordersPerWeek.toFixed(1)} orders / week`} />
        <KPICard label="Last order" value={stats.lastOrder ? fmtDateShort(stats.lastOrder) : "—"} hint={customer.paymentTerms} />
      </div>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="orders">Orders ({cOrders.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({cInvoices.filter((i) => i.balance > 0).length} open)</TabsTrigger>
          <TabsTrigger value="payments">Payments ({cPayments.length})</TabsTrigger>
          <TabsTrigger value="activity">Account activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="grid content-start gap-4 xl:col-span-2">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Standing orders</CardTitle>
                    <CardDescription>Recurring weekly orders — generated automatically three days ahead as “Repeat Order”.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {cStanding.length === 0 ? (
                    <EmptyState icon={CalendarClock} title="No standing orders" description="Set one up when a customer orders the same products every week." />
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {DAYS.map((d) => cStanding.filter((s) => s.day === d).map((s) => <StandingCard key={s.id} so={s} onStatus={(st) => { setSO(s.id, st); toast.success(`Standing order ${st === "active" ? "resumed" : st}`); }} />))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Purchases per week</CardTitle>
                    <CardDescription>Confirmed and delivered orders, since go-live</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Columns data={weeks} xKey="week" series={[{ key: "Purchases", name: "Purchases" }]} height={200} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recent orders</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/orders?q=${encodeURIComponent(customer.name)}`)}>
                    All orders
                  </Button>
                </CardHeader>
                <DataTable columns={orderCols} data={cOrders.slice(0, 6)} pageSize={6} dense onRowClick={(o) => router.push(`/orders/${o.id}`)} />
              </Card>
            </div>
            <div className="grid content-start gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Credit & terms</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Payment terms" value={customer.paymentTerms} />
                    <Stat label="Credit limit" value={customer.creditLimit ? peso(customer.creditLimit) : "Cash / COD only"} />
                  </div>
                  {customer.creditLimit > 0 && <CapacityBar used={stats.outstanding} capacity={customer.creditLimit} label={`Credit used · ${pct(creditUse)}`} showNumbers={false} />}
                  <div className="grid grid-cols-5 gap-1 text-center text-[11px]">
                    {(["current", "d1_7", "d8_30", "d31_60", "d60p"] as const).map((b, i) => (
                      <div key={b} className="rounded-md bg-muted/60 p-1.5">
                        <div className="text-muted-foreground">{["Current", "1–7", "8–30", "31–60", "60+"][i]}</div>
                        <div className={`font-semibold tabular ${i > 1 && stats.aging[b] ? "text-danger" : ""}`}>{pesoCompact(stats.aging[b])}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {customer.contacts.map((c) => (
                    <div key={c.name} className="flex items-start justify-between gap-2">
                      <div className="flex gap-2">
                        <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">
                            {c.name} {c.primary && <Badge variant="teal" className="ml-1">Primary</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{c.position}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" asChild aria-label={`Call ${c.name}`}>
                          <a href={`tel:${c.phone.replace(/\s/g, "")}`}>
                            <Phone />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Message ${c.name}`} onClick={() => toast("Opening Messenger thread (demo)")}>
                          <MessageCircle />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-muted-foreground tabular">{customer.contacts.map((c) => c.phone).join(" · ")}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Delivery addresses</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {customer.addresses.map((a) => (
                    <AddressDisplay key={a.id} address={a} />
                  ))}
                  <div className="rounded-md bg-muted/60 px-3 py-2 text-xs">
                    {customer.fulfillment === "truck" ? "Served by our trucks on the " + area.name + " route" : customer.fulfillment === "pickup" ? "Picks up at the Lucena bodega" : "Ships via sea-freight partner (Batangas Port)"}
                    {customer.deliveryFee ? ` · delivery fee ${peso(customer.deliveryFee)}` : ""}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Preferred products</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {preferred.map((pid) => {
                    const p = productById(pid);
                    return (
                      <div key={pid} className="flex items-center gap-2 text-sm">
                        <ProductImage product={p} size="xs" />
                        <span className="flex-1">{productLabel(p)}</span>
                        {byProduct.get(pid) ? <span className="text-xs text-muted-foreground tabular">{pesoCompact(byProduct.get(pid)!)}</span> : <Star className="size-3.5 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Stat label="Salesperson" value={sp?.name ?? "—"} sub={sp?.phone} />
                  <Stat label="Lead source" value={customer.leadSource} sub={lead ? `from lead ${lead.id}` : undefined} />
                  <Stat label="Fulfillment" value={customer.fulfillment === "truck" ? "Truck delivery" : customer.fulfillment === "pickup" ? "Bodega pickup" : "Sea-freight partner"} />
                  <Stat label="Customer since" value={fmtDate(customer.customerSince)} />
                  {customer.notes && <p className="col-span-2 rounded-md bg-muted/60 p-3 text-sm">{customer.notes}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <DataTable columns={orderCols} data={cOrders} onRowClick={(o) => router.push(`/orders/${o.id}`)} empty={<EmptyState title="No orders yet" action={<Button asChild size="sm"><Link href={`/orders/new?customer=${customer.id}`}><Plus /> Create first order</Link></Button>} />} />
          </Card>
        </TabsContent>
        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            <DataTable columns={invCols} data={cInvoices} initialSorting={[{ id: "bal", desc: true }]} onRowClick={(i) => router.push(`/accounts-receivable/${i.id}`)} empty={<EmptyState title="No invoices yet" description="Invoices are issued when orders are delivered." />} />
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="overflow-hidden">
            <DataTable columns={payCols} data={cPayments} empty={<EmptyState title="No payments recorded" />} />
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="pt-5">
              <Timeline items={activity.map((a) => ({ title: a.title, meta: a.meta, at: fmtDateTime(a.at), state: "done" }))} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function StandingCard({ so, onStatus }: { so: StandingOrder; onStatus: (s: StandingOrder["status"]) => void }) {
  return (
    <div className={`grid gap-2 rounded-lg border p-3 ${so.status !== "active" ? "bg-muted/40" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{so.day}</span>
        <StatusBadge status={so.status} icon={false} />
      </div>
      <ul className="grid gap-0.5 text-sm">
        {so.lines.map((l) => {
          const p = productById(l.productId);
          return (
            <li key={l.productId} className="flex justify-between gap-2">
              <span>{p.localName ?? p.name}{p.variant ? ` (${p.variant.split(/[,(]/)[0].trim()})` : ""}</span>
              <span className="tabular text-muted-foreground">{qty(l.quantity, p.unit)}</span>
            </li>
          );
        })}
      </ul>
      {so.notes && <p className="text-xs text-muted-foreground">{so.notes}</p>}
      <div className="flex gap-1">
        {so.status === "active" ? (
          <Button size="sm" variant="outline" onClick={() => onStatus("paused")}>
            <Pause /> Pause
          </Button>
        ) : so.status === "paused" ? (
          <Button size="sm" variant="outline" onClick={() => onStatus("active")}>
            <Play /> Resume
          </Button>
        ) : null}
        {so.status !== "cancelled" && (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive">
                <Trash2 /> Cancel
              </Button>
            }
            title={`Cancel the ${so.day} standing order?`}
            description="Future repeat orders will no longer be generated. Existing orders are not affected."
            confirmLabel="Cancel standing order"
            destructive
            onConfirm={() => onStatus("cancelled")}
          />
        )}
      </div>
    </div>
  );
}
