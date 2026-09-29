"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, CreditCard, Download, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Payment } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useInvoices } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { fmtDateTime, peso, pesoCompact, pct } from "@/lib/format";
import { downloadCsv, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, KPICard, PageHeader } from "@/components/shared/common";
import { RankedBars } from "@/components/charts/charts";
import { FilterSelect } from "@/components/shared/common";
import { PAYMENT_METHODS } from "./record-payment-dialog";

export function PaymentsView() {
  const payments = useAppStore((s) => s.payments);
  const customers = useCustomerMap();
  const invoiceIds = new Set(useInvoices().map((i) => i.id));
  const [q, setQ] = React.useState("");
  const [method, setMethod] = React.useState("all");
  const data = [...payments].filter((p) => method === "all" || p.method === method).sort((a, b) => b.date.localeCompare(a.date));
  const today = payments.filter((p) => p.date.startsWith(TODAY));
  const week = payments.filter((p) => p.date >= "2026-09-19");
  const month = payments.filter((p) => p.date >= "2026-08-26");
  const byMethod = PAYMENT_METHODS.map((m) => ({ label: m, value: sumBy(month.filter((p) => p.method === m), (p) => p.amount) })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const digital = sumBy(month.filter((p) => ["GCash", "Maya", "Bank Transfer"].includes(p.method)), (p) => p.amount) / Math.max(1, sumBy(month, (p) => p.amount));

  const columns: ColumnDef<Payment, unknown>[] = [
    { id: "r", header: "Receipt No.", accessorFn: (p) => p.receiptNo, cell: ({ row }) => <div className="whitespace-nowrap"><div className="font-medium">{row.original.receiptNo}</div><div className="text-xs text-muted-foreground">{row.original.id}</div></div> },
    { id: "c", header: "Customer", accessorFn: (p) => customers.get(p.customerId)?.name, cell: ({ row }) => <Link href={`/customers/${row.original.customerId}`} className="font-medium hover:underline">{customers.get(row.original.customerId)?.name}</Link> },
    { id: "amt", header: "Amount", accessorFn: (p) => p.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-semibold">{peso(row.original.amount)}</span> },
    { id: "m", header: "Payment Method", accessorFn: (p) => p.method },
    { id: "ref", header: "Reference", accessorFn: (p) => p.reference, cell: ({ row }) => <div className="text-xs"><div>{row.original.reference}</div>{row.original.notes && <div className="text-muted-foreground">{row.original.notes}</div>}</div> },
    { id: "d", header: "Date", accessorFn: (p) => p.date, cell: ({ row }) => <span className="whitespace-nowrap">{fmtDateTime(row.original.date)}</span> },
    {
      id: "inv",
      header: "Invoice / job",
      accessorFn: (p) => p.invoiceId,
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          {invoiceIds.has(row.original.invoiceId) ? (
            <Link href={`/accounts-receivable/${row.original.invoiceId}`} className="text-primary hover:underline">
              {row.original.invoiceId}
            </Link>
          ) : (
            <span className="text-muted-foreground">Advance — not yet invoiced</span>
          )}
          <div>
            <Link href={`/jobs/${row.original.jobId}`} className="text-muted-foreground hover:underline">
              {row.original.jobId}
            </Link>
          </div>
        </div>
      ),
    },
    { id: "by", header: "Recorded By", accessorFn: (p) => p.recordedBy, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        description="Freight collections — driver COD, GCash, Maya, bank transfers and checks. Each payment settles a job's invoice. References are masked; no full account numbers are stored."
        actions={
          <Button variant="outline" onClick={() => { downloadCsv("tradeloop-payments.csv", [["Receipt", "Customer", "Amount", "Method", "Reference", "Date", "Invoice", "Job", "Recorded by"], ...data.map((p) => [p.receiptNo, customers.get(p.customerId)?.name ?? "", p.amount, p.method, p.reference, p.date, p.invoiceId, p.jobId, p.recordedBy])]); toast.success("Payments exported"); }}>
            <Download /> Export
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Collected today" value={peso(sumBy(today, (p) => p.amount))} icon={Wallet} hint={`${today.length} receipts so far`} />
        <KPICard label="Last 7 days" value={pesoCompact(sumBy(week, (p) => p.amount))} icon={CalendarCheck} hint={`${week.length} receipts`} />
        <KPICard label="Since go-live (30 days)" value={pesoCompact(sumBy(month, (p) => p.amount))} icon={CreditCard} hint={`${month.length} receipts`} />
        <KPICard label="Digital share" value={pct(digital)} hint="GCash, Maya & bank transfer" tone="success" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="overflow-hidden xl:col-span-3">
          <FilterBar search={q} onSearch={setQ} placeholder="Search receipt, customer, invoice…">
            <FilterSelect value={method} onChange={setMethod} label="Method" options={[{ value: "all", label: "All methods" }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]} />
          </FilterBar>
          <DataTable
            columns={columns}
            data={data}
            search={q}
            searchText={(p) => `${p.receiptNo} ${p.id} ${customers.get(p.customerId)?.name} ${p.invoiceId} ${p.jobId} ${p.reference}`}
            renderCard={(p) => (
              <div className="grid gap-1">
                <div className="flex justify-between gap-2"><span className="font-medium">{customers.get(p.customerId)?.name}</span><span className="font-semibold tabular">{peso(p.amount)}</span></div>
                <div className="text-xs text-muted-foreground">{p.receiptNo} · {p.method} · {fmtDateTime(p.date)}</div>
              </div>
            )}
          />
        </Card>
        <Card className="content-start">
          <CardHeader>
            <div>
              <CardTitle>By payment method</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RankedBars data={byMethod} valueFormat={pesoCompact} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
