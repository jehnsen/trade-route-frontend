"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileText, Plus, Save, Sparkles, Trash2, Truck } from "lucide-react";
import type { OrderSource, PaymentTerms } from "@/types";
import { useAppStore, actorFor } from "@/lib/store";
import { useCustomerMap, useSalesCustomerStats, useStock } from "@/hooks/use-data";
import { PRODUCTS, productById, productLabel } from "@/data/products";
import { areaName } from "@/data/areas";
import { TODAY, TOMORROW } from "@/data/company";
import { itemLoadKg } from "@/lib/calc";
import { kg, peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator, Textarea } from "@/components/ui/primitives";
import { Combobox, DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { DemoPriceNote, ORDER_SOURCES, PageHeader, SourceBadge } from "@/components/shared/common";
import { ProductImage } from "@/components/shared/product-image";

const TERMS: PaymentTerms[] = ["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days", "50% Down, Balance on Arrival"];

const schema = z.object({
  customerId: z.string().min(1, "Choose the customer"),
  source: z.enum(["Customer Portal", "Facebook Messenger", "Phone", "Facebook Lead", "Salesperson", "Repeat Order"]),
  addressId: z.string().min(1, "Choose a delivery address"),
  deliveryDate: z.string().min(10, "Pick the requested delivery date"),
  paymentTerms: z.enum(["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days", "50% Down, Balance on Arrival"]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Choose a product"),
        quantity: z.number({ message: "Enter quantity" }).positive("Must be more than 0"),
        unitPrice: z.number({ message: "Enter price" }).positive("Must be more than ₱0"),
      }),
    )
    .min(1, "Add at least one product"),
  discountPct: z.number({ message: "Enter 0 if none" }).min(0, "Cannot be negative").max(20, "Max 20% without owner approval"),
  deliveryFee: z.number({ message: "Enter 0 if free" }).min(0, "Cannot be negative"),
  notes: z.string().max(500).optional(),
});
type Values = z.infer<typeof schema>;

export function OrderForm({ initialCustomerId }: { initialCustomerId?: string }) {
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const createOrder = useAppStore((s) => s.createOrder);
  const customersList = useAppStore((s) => s.customers);
  const customers = useCustomerMap();
  const stats = useSalesCustomerStats();
  const stock = useStock();
  const [submitting, setSubmitting] = React.useState<"draft" | "confirm" | null>(null);

  const initialCustomer = initialCustomerId ? customers.get(initialCustomerId) : undefined;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: initialCustomer?.id ?? "",
      source: "Facebook Messenger",
      addressId: initialCustomer?.addresses[0].id ?? "",
      deliveryDate: TOMORROW,
      paymentTerms: initialCustomer?.paymentTerms ?? "COD",
      items: [{ productId: "", quantity: 0, unitPrice: 0 }],
      discountPct: 0,
      deliveryFee: initialCustomer?.deliveryFee ?? 0,
      notes: "",
    },
  });
  const { control, register, watch, setValue, formState, handleSubmit } = form;
  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const v = watch();
  const customer = v.customerId ? customers.get(v.customerId) : undefined;
  const cStats = customer ? stats.get(customer.id) : undefined;

  const onCustomer = (id: string) => {
    const c = customers.get(id)!;
    setValue("customerId", id, { shouldValidate: true });
    setValue("addressId", c.addresses.find((a) => a.default)?.id ?? c.addresses[0].id);
    setValue("paymentTerms", c.paymentTerms);
    setValue("deliveryFee", c.deliveryFee);
  };
  const onProduct = (idx: number, productId: string) => {
    const p = productById(productId);
    setValue(`items.${idx}.productId`, productId, { shouldValidate: true });
    const isTrade = customer && ["Restaurant", "Hotel", "Resort", "Catering Company"].includes(customer.type);
    setValue(`items.${idx}.unitPrice`, isTrade ? p.sellingPrice : p.wholesalePrice);
    if (!v.items[idx]?.quantity) setValue(`items.${idx}.quantity`, p.moq);
  };
  const loadExample = () => {
    onCustomer("CUS-022");
    replace([
      { productId: "P-SUG-L", quantity: 150, unitPrice: 460 },
      { productId: "P-TAH", quantity: 250, unitPrice: 115 },
      { productId: "P-TAL", quantity: 100, unitPrice: 135 },
    ]);
    setValue("source", "Facebook Messenger");
    setValue("notes", "Messenger order from Chef Marco — deliver before 1:00 PM, back entrance.");
  };

  const lines = v.items.map((i) => ({ ...i, quantity: Number.isFinite(i.quantity) ? i.quantity : 0, unitPrice: Number.isFinite(i.unitPrice) ? i.unitPrice : 0 }));
  const subtotal = lines.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = Math.round((subtotal * (Number.isFinite(v.discountPct) ? v.discountPct : 0)) / 100);
  const fee = Number.isFinite(v.deliveryFee) ? v.deliveryFee : 0;
  const total = subtotal - discount + fee;
  const load = lines.filter((i) => i.productId).reduce((s, i) => s + itemLoadKg(i), 0);
  const creditExposure = customer && customer.creditLimit > 0 ? (cStats?.outstanding ?? 0) + total : 0;
  const overLimit = customer && customer.creditLimit > 0 && creditExposure > customer.creditLimit;
  const hasOverdue = (cStats?.overdue ?? 0) > 0;

  const productOptions = PRODUCTS.filter((p) => p.status !== "inactive").map((p) => ({
    value: p.id,
    label: productLabel(p),
    hint: `${p.sku} · wholesale ${peso(p.wholesalePrice)}/${p.unit}`,
    keywords: [p.name, p.localName ?? "", p.category],
  }));

  const submit = (mode: "draft" | "confirm") =>
    handleSubmit((vals) => {
      setSubmitting(mode);
      const id = createOrder({
        customerId: vals.customerId,
        source: vals.source as OrderSource,
        items: vals.items,
        discount: discount,
        deliveryFee: vals.deliveryFee,
        deliveryDate: vals.deliveryDate,
        paymentTerms: vals.paymentTerms,
        addressId: vals.addressId,
        notes: vals.notes || undefined,
        status: mode === "draft" ? "Draft" : overLimit ? "Pending Confirmation" : "Confirmed",
        createdBy: actorFor(role),
      });
      toast.success(mode === "draft" ? `Draft ${id} saved` : overLimit ? `${id} saved — pending credit approval` : `Order ${id} confirmed`, {
        description: mode === "draft" ? "You can confirm it later from the Orders list." : "It now appears in Orders, the customer profile and the Dispatch Board.",
      });
      router.push(`/orders/${id}`);
    })();

  const err = formState.errors;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Orders", href: "/orders" }, { label: "Create order" }]}
        title="Create Order"
        description="Encode orders received via Messenger, phone, Facebook or from sales staff. Totals update as you type."
        actions={
          <Button variant="outline" size="sm" type="button" onClick={loadExample}>
            <Sparkles /> Fill sample Messenger order
          </Button>
        }
      />
      <form noValidate onSubmit={(e) => e.preventDefault()} className="grid gap-4 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer & source</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" htmlFor="customer" error={err.customerId?.message} required className="sm:col-span-2">
                <Combobox
                  id="customer"
                  invalid={!!err.customerId}
                  value={v.customerId}
                  onChange={onCustomer}
                  placeholder="Search customer by name or area…"
                  searchPlaceholder="e.g. Navotas, Seaside Grill…"
                  options={customersList.filter((c) => c.status !== "inactive").map((c) => ({ value: c.id, label: c.name, hint: `${c.type} · ${areaName(c.areaId)} · ${c.paymentTerms}` }))}
                />
              </Field>
              <Field label="Order source" htmlFor="source" required>
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_SOURCES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Payment terms" htmlFor="terms" required hint={customer ? `Customer default: ${customer.paymentTerms}` : undefined}>
                <Controller
                  control={control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="terms">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Delivery location" htmlFor="address" error={err.addressId?.message} required>
                <Controller
                  control={control}
                  name="addressId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={!customer}>
                      <SelectTrigger id="address" aria-invalid={!!err.addressId}>
                        <SelectValue placeholder="Choose customer first" />
                      </SelectTrigger>
                      <SelectContent>
                        {customer?.addresses.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label} — {a.barangay !== "—" ? `${a.barangay}, ` : ""}
                            {a.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Requested delivery date" htmlFor="date" error={err.deliveryDate?.message} required>
                <Controller control={control} name="deliveryDate" render={({ field }) => <DatePicker id="date" value={field.value} onChange={field.onChange} minDate={TODAY} invalid={!!err.deliveryDate} />} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>Negotiated prices can be typed over the default wholesale price.</CardDescription>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => append({ productId: "", quantity: 0, unitPrice: 0 })}>
                <Plus /> Add product
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="hidden grid-cols-[minmax(0,1fr)_100px_56px_110px_110px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground md:grid">
                <span>Product</span>
                <span>Quantity</span>
                <span>Unit</span>
                <span>Unit price</span>
                <span className="text-right">Line total</span>
                <span />
              </div>
              {fields.map((f, idx) => {
                const line = lines[idx];
                const p = line?.productId ? productById(line.productId) : undefined;
                const st = p ? stock.get(p.id) : undefined;
                const availableForNew = st ? Math.max(0, st.onHand - st.damaged - st.demand + st.incoming) : 0;
                return (
                  <div key={f.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_100px_56px_110px_110px_36px] md:items-start md:border-0 md:p-0">
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2">
                        {p && <ProductImage product={p} size="xs" />}
                        <div className="min-w-0 flex-1">
                          <Combobox value={line?.productId} onChange={(id) => onProduct(idx, id)} options={productOptions} placeholder="Choose product" searchPlaceholder="Search sugpo, tahong, onion…" invalid={!!err.items?.[idx]?.productId} />
                        </div>
                      </div>
                      {err.items?.[idx]?.productId && <p className="text-xs text-destructive">{err.items[idx]?.productId?.message}</p>}
                      {p && st && (
                        <p className={`text-xs ${availableForNew < (line?.quantity ?? 0) ? "text-[oklch(0.55_0.13_65)]" : "text-muted-foreground"}`}>
                          {availableForNew < (line?.quantity ?? 0) ? <AlertTriangle className="mr-1 inline size-3" /> : null}
                          ≈{qty(availableForNew, p.unit)} uncommitted (bodega + incoming) · MOQ {qty(p.moq, p.unit)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`q-${idx}`}>
                        Quantity
                      </label>
                      <Input id={`q-${idx}`} type="number" inputMode="decimal" aria-invalid={!!err.items?.[idx]?.quantity} {...register(`items.${idx}.quantity`, { valueAsNumber: true })} />
                      {err.items?.[idx]?.quantity && <p className="mt-1 text-xs text-destructive">{err.items[idx]?.quantity?.message}</p>}
                    </div>
                    <div className="flex h-9 items-center text-sm text-muted-foreground">{p ? (p.unit === "pc" ? "pcs" : "kg") : "—"}</div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground md:sr-only" htmlFor={`p-${idx}`}>
                        Unit price (₱)
                      </label>
                      <Input id={`p-${idx}`} type="number" inputMode="decimal" aria-invalid={!!err.items?.[idx]?.unitPrice} {...register(`items.${idx}.unitPrice`, { valueAsNumber: true })} />
                      {err.items?.[idx]?.unitPrice && <p className="mt-1 text-xs text-destructive">{err.items[idx]?.unitPrice?.message}</p>}
                    </div>
                    <div className="flex h-9 items-center justify-end text-sm font-semibold tabular">{peso((line?.quantity || 0) * (line?.unitPrice || 0))}</div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} disabled={fields.length === 1} aria-label="Remove product row">
                      <Trash2 />
                    </Button>
                  </div>
                );
              })}
              {typeof err.items?.message === "string" && <p className="text-xs text-destructive">{err.items.message}</p>}
              <DemoPriceNote />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing & notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Wholesale discount (%)" htmlFor="disc" error={err.discountPct?.message} hint={discount ? `−${peso(discount)}` : "Volume discount for large orders"}>
                <Input id="disc" type="number" step="0.5" aria-invalid={!!err.discountPct} {...register("discountPct", { valueAsNumber: true })} />
              </Field>
              <Field label="Delivery fee (₱)" htmlFor="fee" error={err.deliveryFee?.message} hint="Free for regular route drops above ₱50,000">
                <Input id="fee" type="number" aria-invalid={!!err.deliveryFee} {...register("deliveryFee", { valueAsNumber: true })} />
              </Field>
              <Field label="Notes" htmlFor="notes" className="sm:col-span-2" hint="Receiving instructions, packing requests, Messenger reference, etc.">
                <Textarea id="notes" rows={3} {...register("notes")} />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Order summary</CardTitle>
              <SourceBadge source={v.source as OrderSource} short />
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {customer ? (
                <div className="mb-2 rounded-md bg-muted/60 p-3">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {customer.type} · {areaName(customer.areaId)} · {customer.fulfillment === "truck" ? "Truck delivery" : customer.fulfillment === "pickup" ? "Bodega pickup" : "Sea-freight partner"}
                  </div>
                </div>
              ) : (
                <div className="mb-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">Choose a customer to see terms, balance and credit limit.</div>
              )}
              <Row label="Subtotal" value={peso(subtotal)} />
              <Row label="Wholesale discount" value={discount ? `−${peso(discount)}` : "—"} />
              <Row label="Delivery fee" value={fee ? peso(fee) : "Free"} />
              <Separator className="my-1" />
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-semibold tabular">{peso(total)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Truck className="size-3.5" /> Est. truck load {kg(load)} incl. ice & packaging
              </div>
              {customer && customer.creditLimit > 0 && (
                <div className={`mt-2 rounded-md p-3 text-xs ${overLimit ? "bg-danger-soft" : "bg-muted/60"}`}>
                  <div className="flex justify-between">
                    <span>Credit limit</span>
                    <span className="tabular">{peso(customer.creditLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outstanding + this order</span>
                    <span className="font-medium tabular">{peso(creditExposure)}</span>
                  </div>
                  {overLimit && <div className="mt-1 font-medium text-danger">Over credit limit — order will be saved as Pending Confirmation for owner approval.</div>}
                </div>
              )}
              {hasOverdue && (
                <div className="rounded-md bg-warning-soft p-3 text-xs">
                  <AlertTriangle className="mr-1 inline size-3.5" />
                  {customer?.name} has {peso(cStats!.overdue)} overdue. Coordinate with Accounting before releasing.
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Button type="button" size="lg" onClick={() => submit("confirm")} disabled={!!submitting}>
              <CheckCircle2 /> Confirm Order
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => submit("draft")} disabled={!!submitting}>
              <Save /> Save Draft
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/orders">
                <FileText /> Back to orders
              </Link>
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
