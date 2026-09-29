"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, parseISO } from "date-fns";
import { CheckCircle2, Download, Eye, MoreHorizontal, Plus, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { AreaId, Order, OrderSource, OrderStatus, PaymentStatus } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useSalesInvoiceMap } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { AREAS, areaName } from "@/data/areas";
import { orderTotal, paymentStatusFor } from "@/lib/calc";
import { orderSummary } from "@/lib/domain";
import { fmtDateShort, peso, relativeDay } from "@/lib/format";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, FilterSelect, MoneyDisplay, ORDER_SOURCES, PageHeader, SOURCE_META, SourceBadge, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { CancelOrderDialog, RecordPaymentDialog } from "./order-dialogs";

interface Row {
  order: Order;
  customer: string;
  areaId: AreaId;
  total: number;
  payment: PaymentStatus;
}

const TABS: { value: string; label: string; match: (s: OrderStatus) => boolean }[] = [
  { value: "all", label: "All", match: (s) => s !== "Draft" },
  { value: "pending", label: "Pending Confirmation", match: (s) => s === "Pending Confirmation" },
  { value: "open", label: "Confirmed & Preparing", match: (s) => s === "Confirmed" || s === "Preparing" || s === "Ready for Dispatch" },
  { value: "transit", label: "Out for Delivery", match: (s) => s === "Out for Delivery" },
  { value: "delivered", label: "Delivered", match: (s) => s === "Delivered" || s === "Partially Delivered" },
  { value: "cancelled", label: "Cancelled", match: (s) => s === "Cancelled" },
  { value: "draft", label: "Drafts", match: (s) => s === "Draft" },
];

const DATE_RANGES: { value: string; label: string; test: (d: string) => boolean }[] = [
  { value: "all", label: "Any date", test: () => true },
  { value: "today", label: "Today (Sep 25)", test: (d) => d === TODAY },
  { value: "tomorrow", label: "Tomorrow (Sep 26)", test: (d) => d === "2026-09-26" },
  { value: "upcoming", label: "Upcoming", test: (d) => d > TODAY },
  { value: "7d", label: "Last 7 days", test: (d) => d <= TODAY && d > format(addDays(parseISO(TODAY), -7), "yyyy-MM-dd") },
  { value: "30d", label: "Last 30 days", test: (d) => d <= TODAY && d > format(addDays(parseISO(TODAY), -30), "yyyy-MM-dd") },
];

export function OrdersView({ initial }: { initial: { date?: string; status?: string; source?: string; q?: string } }) {
  const router = useRouter();
  const orders = useAppStore((s) => s.orders);
  const setStatus = useAppStore((s) => s.setOrderStatus);
  const customers = useCustomerMap();
  const invoiceMap = useSalesInvoiceMap();

  const [tab, setTab] = React.useState(initial.status ?? "all");
  const [q, setQ] = React.useState(initial.q ?? "");
  const [source, setSource] = React.useState<string>(initial.source ?? "all");
  const [area, setArea] = React.useState<string>("all");
  const [pay, setPay] = React.useState<string>("all");
  const [range, setRange] = React.useState<string>(initial.date ?? "all");
  const [dialog, setDialog] = React.useState<{ kind: "pay" | "cancel"; order: Order } | null>(null);

  const rows: Row[] = React.useMemo(
    () =>
      orders.map((o) => {
        const c = customers.get(o.customerId)!;
        return { order: o, customer: c.name, areaId: c.areaId, total: orderTotal(o), payment: paymentStatusFor(o, invoiceMap.get(o.id)) };
      }),
    [orders, customers, invoiceMap],
  );

  const base = rows.filter(
    (r) =>
      (source === "all" || r.order.source === source) &&
      (area === "all" || r.areaId === area) &&
      (pay === "all" || r.payment === pay) &&
      DATE_RANGES.find((d) => d.value === range)!.test(r.order.deliveryDate),
  );
  const tabDef = TABS.find((t) => t.value === tab) ?? TABS[0];
  const filtered = base.filter((r) => tabDef.match(r.order.status));

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "id",
      header: "Order No.",
      accessorFn: (r) => r.order.id,
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.order.id}`} className="font-medium whitespace-nowrap text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {row.original.order.id}
        </Link>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      accessorFn: (r) => r.customer,
      cell: ({ row }) => <div className="max-w-[200px] truncate font-medium">{row.original.customer}</div>,
    },
    { id: "source", header: "Source", accessorFn: (r) => r.order.source, cell: ({ row }) => <SourceBadge source={row.original.order.source} short /> },
    { id: "products", header: "Products", enableSorting: false, cell: ({ row }) => <div className="max-w-[190px] truncate text-muted-foreground">{orderSummary(row.original.order)}</div> },
    { id: "area", header: "Delivery Area", accessorFn: (r) => areaName(r.areaId), cell: ({ row }) => <span className="whitespace-nowrap">{areaName(row.original.areaId)}</span> },
    {
      id: "date",
      header: "Delivery Date",
      accessorFn: (r) => r.order.deliveryDate,
      cell: ({ row }) => (
        <div className="whitespace-nowrap">
          {fmtDateShort(row.original.order.deliveryDate)}
          <div className="text-xs text-muted-foreground">{relativeDay(row.original.order.deliveryDate)}</div>
        </div>
      ),
    },
    { id: "total", header: "Total", accessorFn: (r) => r.total, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.total} className="font-medium" /> },
    {
      id: "payment",
      header: "Payment",
      accessorFn: (r) => r.payment,
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <StatusBadge status={row.original.payment} icon={false} />
          <span className="text-[11px] whitespace-nowrap text-muted-foreground">{row.original.order.paymentTerms}</span>
        </div>
      ),
    },
    { id: "status", header: "Status", accessorFn: (r) => r.order.status, cell: ({ row }) => <StatusBadge status={row.original.order.status} /> },
    {
      id: "fulfilment",
      header: "Fulfilment",
      accessorFn: (r) => r.order.fulfillment,
      cell: ({ row }) => <span className="text-xs whitespace-nowrap text-muted-foreground">{row.original.order.fulfillment === "pickup" ? "Bodega pickup" : row.original.order.fulfillment === "partner" ? "Sea-freight partner" : "Own truck"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const o = row.original.order;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${o.id}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => router.push(`/orders/${o.id}`)}>
                  <Eye /> View order
                </DropdownMenuItem>
                {(o.status === "Pending Confirmation" || o.status === "Draft") && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setStatus(o.id, "Confirmed");
                      toast.success(`${o.id} confirmed`);
                    }}
                  >
                    <CheckCircle2 /> Confirm
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setDialog({ kind: "pay", order: o })} disabled={o.status === "Cancelled" || o.status === "Draft" || row.original.payment === "Paid"}>
                  <Wallet /> Record payment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={["Delivered", "Partially Delivered", "Cancelled", "Out for Delivery"].includes(o.status)} onSelect={() => setDialog({ kind: "cancel", order: o })}>
                  <XCircle /> Cancel order
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const channelCounts = ORDER_SOURCES.map((s) => ({ s, n: orders.filter((o) => o.source === s && o.deliveryDate > "2026-08-25").length }));

  const exportCsv = () => {
    downloadCsv(`tradeloop-sales-orders-${TODAY}.csv`, [
      ["Order No.", "Customer", "Source", "Products", "Delivery Area", "Delivery Date", "Total", "Payment", "Status"],
      ...filtered.map((r) => [r.order.id, r.customer, r.order.source, orderSummary(r.order, 5), areaName(r.areaId), r.order.deliveryDate, r.total, r.payment, r.order.status]),
    ]);
    toast.success(`Exported ${filtered.length} orders`, { description: "CSV saved to your downloads." });
  };

  return (
    <>
      <PageHeader
        title="Sales Orders"
        description="Trading module (Phase 2 preview): product sales from Messenger, phone, Facebook and the portal. Deliveries for these run through logistics jobs once trading goes live."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export
            </Button>
            <Button asChild>
              <Link href="/orders/new">
                <Plus /> Create Order
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {channelCounts.map(({ s, n }) => {
          const M = SOURCE_META[s as OrderSource];
          const active = source === s;
          return (
            <button key={s} type="button" onClick={() => setSource(active ? "all" : s)} className={`flex items-center gap-2.5 rounded-lg border bg-card p-2.5 text-left transition-colors hover:bg-accent/40 cursor-pointer ${active ? "border-primary ring-2 ring-primary/15" : ""}`} aria-pressed={active}>
              <span className={`flex size-8 shrink-0 items-center justify-center rounded-md ${M.className}`}>
                <M.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs text-muted-foreground">{s}</span>
                <span className="block text-sm font-semibold tabular">{n} orders</span>
              </span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-4 pt-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-3">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{base.filter((r) => t.match(r.order.status)).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder="Search order no., customer, product…">
          <FilterSelect value={range} onChange={setRange} label="Delivery date" options={DATE_RANGES.map((d) => ({ value: d.value, label: d.label }))} />
          <FilterSelect value={source} onChange={setSource} label="Source" options={[{ value: "all", label: "All sources" }, ...ORDER_SOURCES.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={area} onChange={setArea} label="Area" options={[{ value: "all", label: "All areas" }, ...AREAS.map((a) => ({ value: a.id, label: a.name }))]} />
          <FilterSelect value={pay} onChange={setPay} label="Payment" options={[{ value: "all", label: "Any payment" }, ...["Unpaid", "Partial", "Paid", "Credit"].map((p) => ({ value: p, label: p }))]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(r) => `${r.order.id} ${r.customer} ${orderSummary(r.order, 9)} ${areaName(r.areaId)}`}
          onRowClick={(r) => router.push(`/orders/${r.order.id}`)}
          initialSorting={[{ id: "date", desc: true }]}
          empty={<EmptyState title="No orders found for the selected filters." description="Clear a filter or pick a different tab." />}
          renderCard={(r) => (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-primary">{r.order.id}</span>
                <StatusBadge status={r.order.status} />
              </div>
              <div className="font-medium">{r.customer}</div>
              <div className="text-xs text-muted-foreground">
                {areaName(r.areaId)} · {fmtDateShort(r.order.deliveryDate)} · {orderSummary(r.order)}
              </div>
              <div className="flex items-center justify-between">
                <SourceBadge source={r.order.source} short />
                <span className="font-semibold tabular">{peso(r.total)}</span>
              </div>
            </div>
          )}
        />
      </Card>

      {dialog?.kind === "pay" && <RecordPaymentDialog order={dialog.order} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog?.kind === "cancel" && <CancelOrderDialog order={dialog.order} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
