"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, FileQuestion } from "lucide-react";
import type { CustomerType } from "@/types";
import { useAppStore, PORTAL_CUSTOMER_ID } from "@/lib/store";
import { PRODUCTS, productById, productLabel } from "@/data/products";
import { TODAY } from "@/data/company";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Input, Textarea } from "@/components/ui/primitives";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

const TYPES: CustomerType[] = ["Palengke Vendor", "Restaurant", "Hotel", "Resort", "Seafood Dealer", "Distributor", "Retailer", "Grocery", "Catering Company"];
const FREQ = ["One-time", "Weekly", "2 deliveries/week", "3 deliveries/week", "Daily (Mon–Sat)", "Monthly"];

const schema = z.object({
  businessName: z.string().min(3, "Business name is required"),
  contactName: z.string().min(3, "Contact person is required"),
  phone: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile number, e.g. 0917 123 4567"),
  productId: z.string().min(1, "Choose a product"),
  quantity: z.number({ message: "Enter the quantity" }).positive("Must be more than 0"),
  unit: z.enum(["kg/week", "kg", "kg per delivery", "pcs/week"]),
  frequency: z.string().min(1),
  deliveryArea: z.string().min(3, "Where should we deliver?"),
  preferredDate: z.string().min(10, "Choose a date"),
  businessType: z.enum(TYPES as [CustomerType, ...CustomerType[]]),
  notes: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export function RequestQuote({ productId, qty }: { productId?: string; qty?: number }) {
  const add = useAppStore((s) => s.addQuoteRequest);
  const customer = useAppStore((s) => s.customers.find((c) => c.id === PORTAL_CUSTOMER_ID));
  const [done, setDone] = React.useState<string | null>(null);
  const p = productId ? PRODUCTS.find((x) => x.id === productId) : undefined;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: customer?.name ?? "",
      contactName: customer?.contacts[0].name ?? "",
      phone: customer?.contacts[0].phone ?? "",
      productId: p?.id ?? "P-SUG-L",
      quantity: qty ?? 500,
      unit: "kg/week",
      frequency: "3 deliveries/week",
      deliveryArea: "Navotas City",
      preferredDate: "2026-09-30",
      businessType: customer?.type ?? "Seafood Dealer",
      notes: "",
    },
  });
  const e = form.formState.errors;
  const pid = form.watch("productId");
  const submit = form.handleSubmit((v) => {
    const id = add({ ...v, customerId: customer && v.businessName === customer.name ? customer.id : undefined });
    setDone(id);
  });

  if (done)
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card className="items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <h1 className="text-2xl font-semibold">Quote request {done} submitted</h1>
          <p className="text-muted-foreground">Our sales team will reply with a negotiated wholesale price within the day, usually via Messenger or a call.</p>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/my-orders?tab=quotes">View my quotes</Link>
            </Button>
            <Button variant="outline" onClick={() => { setDone(null); form.reset(); }}>
              New request
            </Button>
          </div>
        </Card>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <FileQuestion className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Request a Wholesale Quote</h1>
          <p className="text-sm text-muted-foreground">For regular volumes, new delivery areas or inter-island shipments. Example: Sugpo, 500 kg/week, Navotas, 3 deliveries/week.</p>
        </div>
      </div>
      <Card className="mt-6">
        <CardContent className="pt-5">
          <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Product" htmlFor="rq-p" error={e.productId?.message} required className="sm:col-span-2">
              <Controller control={form.control} name="productId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rq-p"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCTS.map((x) => <SelectItem key={x.id} value={x.id}>{productLabel(x)} — indicative {peso(x.wholesalePrice)}/{x.unit}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Quantity" htmlFor="rq-q" error={e.quantity?.message} required>
              <Input id="rq-q" type="number" inputMode="numeric" aria-invalid={!!e.quantity} {...form.register("quantity", { valueAsNumber: true })} />
            </Field>
            <Field label="Unit" htmlFor="rq-u">
              <Controller control={form.control} name="unit" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rq-u"><SelectValue /></SelectTrigger>
                  <SelectContent>{(productById(pid)?.unit === "pc" ? ["pcs/week"] : ["kg/week", "kg", "kg per delivery"]).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Frequency" htmlFor="rq-f">
              <Controller control={form.control} name="frequency" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rq-f"><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQ.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Delivery area" htmlFor="rq-a" error={e.deliveryArea?.message} required>
              <Input id="rq-a" placeholder="e.g. Navotas City" aria-invalid={!!e.deliveryArea} {...form.register("deliveryArea")} />
            </Field>
            <Field label="Preferred first delivery" htmlFor="rq-d" error={e.preferredDate?.message} required>
              <Controller control={form.control} name="preferredDate" render={({ field }) => <DatePicker id="rq-d" value={field.value} onChange={field.onChange} minDate={TODAY} />} />
            </Field>
            <Field label="Business type" htmlFor="rq-t">
              <Controller control={form.control} name="businessType" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rq-t"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </Field>
            <Field label="Business name" htmlFor="rq-bn" error={e.businessName?.message} required>
              <Input id="rq-bn" aria-invalid={!!e.businessName} {...form.register("businessName")} />
            </Field>
            <Field label="Contact person" htmlFor="rq-cn" error={e.contactName?.message} required>
              <Input id="rq-cn" aria-invalid={!!e.contactName} {...form.register("contactName")} />
            </Field>
            <Field label="Mobile number" htmlFor="rq-ph" error={e.phone?.message} required>
              <Input id="rq-ph" type="tel" inputMode="tel" aria-invalid={!!e.phone} {...form.register("phone")} />
            </Field>
            <Field label="Notes" htmlFor="rq-n" className="sm:col-span-2" hint="Size/grade preferences, packing, target price, receiving hours.">
              <Textarea id="rq-n" rows={3} {...form.register("notes")} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                Submit Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
