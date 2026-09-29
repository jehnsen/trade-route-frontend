"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Download, HandCoins, Plus, UserPlus, Users } from "lucide-react";
import type { AreaId, Customer, CustomerType, PaymentTerms } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerStats } from "@/hooks/use-data";
import { AREAS, areaById, areaName } from "@/data/areas";
import { STAFF } from "@/data/company";
import { frequencyLabel, type CustomerStats } from "@/lib/logistics";
import { fmtDateShort, peso, pesoCompact, relativeDay } from "@/lib/format";
import { downloadCsv } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Input } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { FilterBar, KPICard, MoneyDisplay, PageHeader, EmptyState } from "@/components/shared/common";
import { StatusBadge, ReceivableBadge } from "@/components/shared/status-badge";
import { FilterSelect } from "@/components/shared/common";

export const CUSTOMER_TYPES: CustomerType[] = ["Seafood Dealer", "Distributor", "Agri Trader", "Cooperative", "General Merchandise", "Palengke Vendor", "Grocery", "Retailer", "Restaurant", "Hotel", "Resort", "Catering Company"];

interface Row {
  c: Customer;
  s: CustomerStats;
}

export function CustomersView() {
  const router = useRouter();
  const customers = useAppStore((s) => s.customers);
  const stats = useCustomerStats();
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState("all");
  const [region, setRegion] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [balance, setBalance] = React.useState("all");
  const [adding, setAdding] = React.useState(false);

  const rows: Row[] = customers.map((c) => ({ c, s: stats.get(c.id)! }));
  const filtered = rows.filter(
    (r) =>
      (type === "all" || r.c.type === type) &&
      (region === "all" || areaById(r.c.areaId).region === region) &&
      (status === "all" || r.c.status === status) &&
      (balance === "all" || (balance === "overdue" ? r.s.overdue > 0 : balance === "outstanding" ? r.s.outstanding > 0 : r.s.outstanding === 0)),
  );

  const totalOutstanding = rows.reduce((a, r) => a + r.s.outstanding, 0);
  const overdueCount = rows.filter((r) => r.s.overdue > 0).length;
  const activeCount = rows.filter((r) => r.s.jobs > 0).length;
  const newCount = customers.filter((c) => c.status === "new").length;

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "name",
      header: "Customer",
      accessorFn: (r) => r.c.name,
      cell: ({ row }) => (
        <div className="min-w-[200px]">
          <Link href={`/customers/${row.original.c.id}`} className="font-medium hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
            {row.original.c.name}
          </Link>
          <div className="text-xs text-muted-foreground">{row.original.c.id}</div>
        </div>
      ),
    },
    { id: "type", header: "Type", accessorFn: (r) => r.c.type, cell: ({ getValue }) => <span className="whitespace-nowrap">{getValue() as string}</span> },
    { id: "location", header: "Location", accessorFn: (r) => areaName(r.c.areaId), cell: ({ row }) => <div className="whitespace-nowrap">{areaName(row.original.c.areaId)}<div className="text-xs text-muted-foreground">{areaById(row.original.c.areaId).region}</div></div> },
    { id: "contact", header: "Contact Person", accessorFn: (r) => r.c.contacts[0].name, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.c.contacts[0].name}</span> },
    { id: "phone", header: "Phone", accessorFn: (r) => r.c.contacts[0].phone, cell: ({ getValue }) => <span className="whitespace-nowrap tabular">{getValue() as string}</span> },
    { id: "avg", header: "Avg. Job", accessorFn: (r) => r.s.avgJob, meta: { align: "right" }, cell: ({ row }) => (row.original.s.avgJob ? peso(row.original.s.avgJob) : "—") },
    { id: "freq", header: "Booking Frequency", accessorFn: (r) => r.s.jobsPerWeek, cell: ({ row }) => <span className="whitespace-nowrap">{frequencyLabel(row.original.s.jobsPerWeek)}</span> },
    { id: "sales", header: "Lifetime Freight", accessorFn: (r) => r.s.lifetimeRevenue, meta: { align: "right" }, cell: ({ row }) => <MoneyDisplay amount={row.original.s.lifetimeRevenue} compact className="font-medium" /> },
    {
      id: "outstanding",
      header: "Outstanding Balance",
      accessorFn: (r) => r.s.outstanding,
      meta: { align: "right" },
      cell: ({ row }) =>
        row.original.s.outstanding ? (
          <div className="grid justify-items-end gap-0.5">
            <MoneyDisplay amount={row.original.s.outstanding} className={row.original.s.overdue ? "font-medium text-danger" : "font-medium"} />
            {row.original.s.overdue > 0 && <ReceivableBadge daysOverdue={row.original.s.oldestOverdueDays} balance={row.original.s.overdue} />}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { id: "last", header: "Last Booking", accessorFn: (r) => r.s.lastJob ?? "", cell: ({ row }) => (row.original.s.lastJob ? <span className="whitespace-nowrap">{relativeDay(row.original.s.lastJob)}</span> : "—") },
    { id: "status", header: "Status", accessorFn: (r) => r.c.status, cell: ({ row }) => <StatusBadge status={row.original.c.status} icon={false} /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Shippers and consignees — seafood dealers, distributors, agri traders and vendors — with freight terms, balances and booking patterns in one place."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadCsv("tradeloop-customers.csv", [["ID", "Customer", "Type", "Location", "Contact", "Phone", "Terms", "Outstanding", "Lifetime freight"], ...filtered.map((r) => [r.c.id, r.c.name, r.c.type, areaName(r.c.areaId), r.c.contacts[0].name, r.c.contacts[0].phone, r.c.paymentTerms, r.s.outstanding, r.s.lifetimeRevenue])]);
                toast.success(`Exported ${filtered.length} customers`);
              }}
            >
              <Download /> Export
            </Button>
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> Add Customer
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard label="Customers" value={customers.length} icon={Users} hint={`${activeCount} ordered in the last 30 days`} />
        <KPICard label="New accounts" value={newCount} icon={Plus} hint="first bookings in the last 60 days" />
        <KPICard label="Total outstanding" value={pesoCompact(totalOutstanding)} icon={HandCoins} hint="across all open invoices" href="/accounts-receivable" />
        <KPICard label="Customers overdue" value={overdueCount} icon={AlertTriangle} tone="danger" hint="need collection follow-up" href="/accounts-receivable" />
      </div>
      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search customer, contact, phone, area…">
          <FilterSelect value={type} onChange={setType} label="Type" options={[{ value: "all", label: "All types" }, ...CUSTOMER_TYPES.map((t) => ({ value: t, label: t }))]} />
          <FilterSelect value={region} onChange={setRegion} label="Region" options={[{ value: "all", label: "All regions" }, ...["Quezon Province", "Metro Manila", "Cavite", "Laguna", "Batangas", "Visayas", "Mindanao"].map((t) => ({ value: t, label: t }))]} />
          <FilterSelect value={balance} onChange={setBalance} label="Balance" options={[{ value: "all", label: "Any balance" }, { value: "overdue", label: "Overdue" }, { value: "outstanding", label: "With balance" }, { value: "clear", label: "Fully paid" }]} />
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "new", label: "New" }, { value: "on-hold", label: "On hold" }, { value: "inactive", label: "Inactive" }]} />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(r) => `${r.c.name} ${r.c.id} ${r.c.type} ${areaName(r.c.areaId)} ${r.c.contacts.map((x) => `${x.name} ${x.phone}`).join(" ")}`}
          onRowClick={(r) => router.push(`/customers/${r.c.id}`)}
          initialSorting={[{ id: "sales", desc: true }]}
          empty={<EmptyState title="No customers match these filters." />}
          renderCard={(r) => (
            <div className="grid gap-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{r.c.name}</div>
                <StatusBadge status={r.c.status} icon={false} />
              </div>
              <div className="text-xs text-muted-foreground">
                {r.c.type} · {areaName(r.c.areaId)} · {r.c.contacts[0].name}
              </div>
              <div className="flex justify-between text-sm">
                <span>Last booking {r.s.lastJob ? fmtDateShort(r.s.lastJob) : "—"}</span>
                <span className={r.s.overdue ? "font-semibold text-danger" : "font-semibold"}>{peso(r.s.outstanding)}</span>
              </div>
            </div>
          )}
        />
      </Card>
      <AddCustomerDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

const schema = z.object({
  name: z.string().min(3, "Business name is required"),
  type: z.enum(["Palengke Vendor", "Restaurant", "Hotel", "Resort", "Seafood Dealer", "Distributor", "Retailer", "Grocery", "Catering Company"]),
  areaId: z.string().min(1, "Choose the city / municipality"),
  line1: z.string().min(3, "Street / stall / building is required"),
  barangay: z.string().min(3, "Barangay is required"),
  contactName: z.string().min(3, "Contact person is required"),
  phone: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile format, e.g. 0917 123 4567"),
  paymentTerms: z.enum(["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days", "50% Down, Balance on Arrival"]),
  salespersonId: z.string().min(1),
});
type Values = z.infer<typeof schema>;

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useAppStore((s) => s.addCustomer);
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", type: "Palengke Vendor", areaId: "", line1: "", barangay: "", contactName: "", phone: "", paymentTerms: "COD", salespersonId: "ST-02" } });
  const e = form.formState.errors;
  const submit = form.handleSubmit((v) => {
    const area = areaById(v.areaId as AreaId);
    const id = add({
      name: v.name,
      type: v.type,
      areaId: v.areaId as AreaId,
      contacts: [{ name: v.contactName, position: "Owner", phone: v.phone, primary: true }],
      addresses: [{ id: "", label: "Main receiving", line1: v.line1, barangay: v.barangay, city: area.name, province: area.province, areaId: v.areaId as AreaId, receivingHours: "6:00 AM – 12:00 NN", default: true }],
      paymentTerms: v.paymentTerms as PaymentTerms,
      creditLimit: v.paymentTerms === "COD" ? 0 : 100000,
      salespersonId: v.salespersonId,
      leadSource: "Walk-in",
      preferredProductIds: [],
      fulfillment: area.interIsland ? "partner" : "truck",
      notes: "",
      deliveryFee: 0,
    });
    toast.success(`${v.name} added as ${id}`);
    onOpenChange(false);
    form.reset();
    router.push(`/customers/${id}`);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>New accounts start as COD. Credit terms need owner approval after 3 paid bookings.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Business / trading name" htmlFor="nc-name" error={e.name?.message} required className="sm:col-span-2">
            <Input id="nc-name" aria-invalid={!!e.name} {...form.register("name")} />
          </Field>
          <Field label="Customer type" htmlFor="nc-type" required>
            <Controller control={form.control} name="type" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="nc-type"><SelectValue /></SelectTrigger>
                <SelectContent>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="City / municipality" htmlFor="nc-area" error={e.areaId?.message} required>
            <Controller control={form.control} name="areaId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="nc-area" aria-invalid={!!e.areaId}><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{AREAS.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} — {a.province}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Street / stall / building" htmlFor="nc-line1" error={e.line1?.message} required>
            <Input id="nc-line1" placeholder="e.g. Stall 12, Public Market" aria-invalid={!!e.line1} {...form.register("line1")} />
          </Field>
          <Field label="Barangay" htmlFor="nc-brgy" error={e.barangay?.message} required>
            <Input id="nc-brgy" placeholder="e.g. Brgy. San Roque" aria-invalid={!!e.barangay} {...form.register("barangay")} />
          </Field>
          <Field label="Contact person" htmlFor="nc-contact" error={e.contactName?.message} required>
            <Input id="nc-contact" aria-invalid={!!e.contactName} {...form.register("contactName")} />
          </Field>
          <Field label="Mobile number" htmlFor="nc-phone" error={e.phone?.message} required>
            <Input id="nc-phone" placeholder="0917 123 4567" inputMode="tel" aria-invalid={!!e.phone} {...form.register("phone")} />
          </Field>
          <Field label="Payment terms" htmlFor="nc-terms">
            <Controller control={form.control} name="paymentTerms" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="nc-terms"><SelectValue /></SelectTrigger>
                <SelectContent>{["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <Field label="Salesperson" htmlFor="nc-sp">
            <Controller control={form.control} name="salespersonId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="nc-sp"><SelectValue /></SelectTrigger>
                <SelectContent>{STAFF.filter((s) => s.role === "sales").map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit"><UserPlus /> Add customer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
