"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ClipboardList, MessageCircle, ShoppingCart, Trash2 } from "lucide-react";
import type { AreaId, PaymentTerms } from "@/types";
import { useAppStore, PORTAL_CUSTOMER_ID } from "@/lib/store";
import { useHydrated } from "@/lib/store";
import { AREAS } from "@/data/areas";
import { COMPANY, TOMORROW, TODAY } from "@/data/company";
import { productById } from "@/data/products";
import { estimateDeliveryFee } from "@/lib/portal";
import { peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Input, Textarea, RadioGroup, RadioGroupItem, Separator, Skeleton } from "@/components/ui/primitives";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { DemoPriceNote, EmptyState } from "@/components/shared/common";
import { ProductImage } from "@/components/shared/product-image";
import { QtyStepper } from "@/components/portal/product-card";

const PAY = ["COD", "Bank Transfer", "Existing Credit Account"] as const;
const schema = z.object({
  businessName: z.string().min(3, "Business name is required"),
  contactPerson: z.string().min(3, "Contact person is required"),
  mobile: z.string().regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile number, e.g. 0917 123 4567"),
  deliveryAddress: z.string().min(8, "Street, stall or building and barangay"),
  deliveryCity: z.string().min(1, "Choose the delivery city"),
  preferredDate: z.string().min(10, "Choose a preferred date"),
  paymentPreference: z.enum(PAY),
  instructions: z.string().max(400).optional(),
});
type Values = z.infer<typeof schema>;

export function OrderCheckout() {
  const hydrated = useHydrated((s) => s.hydrated);
  const cart = useAppStore((s) => s.cart);
  const setQty = useAppStore((s) => s.setCartQty);
  const remove = useAppStore((s) => s.removeFromCart);
  const clear = useAppStore((s) => s.clearCart);
  const createOrder = useAppStore((s) => s.createOrder);
  const customer = useAppStore((s) => s.customers.find((c) => c.id === PORTAL_CUSTOMER_ID))!;
  const [placed, setPlaced] = React.useState<string | null>(null);

  const addr = customer.addresses[0];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: customer.name,
      contactPerson: customer.contacts[0].name,
      mobile: customer.contacts[0].phone,
      deliveryAddress: `${addr.line1}, ${addr.barangay}`,
      deliveryCity: addr.areaId,
      preferredDate: TOMORROW,
      paymentPreference: "Existing Credit Account",
      instructions: "",
    },
  });
  const v = form.watch();
  const e = form.formState.errors;
  const lines = cart.map((l) => ({ ...l, p: productById(l.productId) }));
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.p.wholesalePrice, 0);
  const fee = estimateDeliveryFee(v.deliveryCity as AreaId, subtotal);
  const total = subtotal + fee.fee;
  const belowMoq = lines.filter((l) => l.quantity < l.p.moq);

  const submit = form.handleSubmit((vals) => {
    if (!lines.length || belowMoq.length) return;
    const terms: PaymentTerms = vals.paymentPreference === "Existing Credit Account" ? customer.paymentTerms : "COD";
    const id = createOrder({
      customerId: customer.id,
      source: "Customer Portal",
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.p.wholesalePrice })),
      discount: 0,
      deliveryFee: fee.fee,
      deliveryDate: vals.preferredDate,
      paymentTerms: terms,
      addressId: addr.id,
      status: "Pending Confirmation",
      createdBy: `${vals.contactPerson} (portal)`,
      notes: [`Payment preference: ${vals.paymentPreference}`, `Deliver to: ${vals.deliveryAddress}`, `Contact: ${vals.contactPerson} · ${vals.mobile}`, vals.instructions ? `Instructions: ${vals.instructions}` : ""].filter(Boolean).join(" · "),
    });
    clear();
    setPlaced(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  if (placed)
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="items-center gap-4 p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold">Order {placed} received</h1>
          <p className="max-w-md text-muted-foreground">Your wholesale order has been received and is subject to stock, pricing, and delivery confirmation.</p>
          <p className="text-sm text-muted-foreground">
            Status: <b className="text-foreground">Pending Confirmation</b>. Our order desk will confirm by Messenger or call within the hour ({COMPANY.businessHours}).
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href="/my-orders">
                <ClipboardList /> Track in My Orders
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/products">Continue browsing</Link>
            </Button>
          </div>
        </Card>
      </div>
    );

  if (!hydrated)
    return (
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 lg:grid-cols-3">
        <Skeleton className="h-96 lg:col-span-2" />
        <Skeleton className="h-96" />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Wholesale Order</h1>
      <p className="text-sm text-muted-foreground">Review quantities, tell us where to deliver, and submit for confirmation. No payment is taken online.</p>
      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          className="mt-6 bg-card"
          title="Your order is empty"
          description="Add products from the catalog, or send your list via Messenger — both reach the same order desk."
          action={
            <Button asChild>
              <Link href="/products">Browse products</Link>
            </Button>
          }
        />
      ) : (
        <form noValidate onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Products ({lines.length})</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {lines.map((l) => (
                  <div key={l.productId} className="grid grid-cols-[48px_1fr] gap-3 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[48px_1fr_auto_auto] sm:items-center">
                    <ProductImage product={l.p} size="md" />
                    <div>
                      <div className="font-medium">{l.p.name.split(" / ")[0]}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.p.variant} · {peso(l.p.wholesalePrice)}/{l.p.unit} · MOQ {qty(l.p.moq, l.p.unit)}
                      </div>
                      {l.quantity < l.p.moq && <div className="text-xs text-destructive">Below minimum order of {qty(l.p.moq, l.p.unit)}</div>}
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                      <QtyStepper value={l.quantity} onChange={(n) => setQty(l.productId, n)} step={l.p.unit === "pc" ? 50 : 10} min={l.p.moq} unit={l.p.unit} />
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(l.productId)} aria-label={`Remove ${l.p.name}`}>
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="col-span-2 text-right text-sm sm:col-span-1 sm:w-32">
                      <div className="text-xs text-muted-foreground">
                        {qty(l.quantity, l.p.unit)} × {peso(l.p.wholesalePrice)}
                      </div>
                      <div className="font-semibold tabular">{peso(l.quantity * l.p.wholesalePrice)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" htmlFor="co-bn" error={e.businessName?.message} required>
                  <Input id="co-bn" autoComplete="organization" aria-invalid={!!e.businessName} {...form.register("businessName")} />
                </Field>
                <Field label="Contact person" htmlFor="co-cp" error={e.contactPerson?.message} required>
                  <Input id="co-cp" autoComplete="name" aria-invalid={!!e.contactPerson} {...form.register("contactPerson")} />
                </Field>
                <Field label="Mobile number" htmlFor="co-mob" error={e.mobile?.message} required>
                  <Input id="co-mob" type="tel" autoComplete="tel" inputMode="tel" aria-invalid={!!e.mobile} {...form.register("mobile")} />
                </Field>
                <Field label="Delivery city" htmlFor="co-city" error={e.deliveryCity?.message} required>
                  <Controller
                    control={form.control}
                    name="deliveryCity"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="co-city" aria-invalid={!!e.deliveryCity}>
                          <SelectValue placeholder="Choose city" />
                        </SelectTrigger>
                        <SelectContent>
                          {AREAS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}, {a.province}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Delivery address" htmlFor="co-addr" error={e.deliveryAddress?.message} required className="sm:col-span-2">
                  <Input id="co-addr" autoComplete="street-address" aria-invalid={!!e.deliveryAddress} {...form.register("deliveryAddress")} />
                </Field>
                <Field label="Preferred delivery date" htmlFor="co-date" error={e.preferredDate?.message} required>
                  <Controller control={form.control} name="preferredDate" render={({ field }) => <DatePicker id="co-date" value={field.value} onChange={field.onChange} minDate={TODAY} />} />
                </Field>
                <Field label="Payment preference" htmlFor="co-pay" required>
                  <Controller
                    control={form.control}
                    name="paymentPreference"
                    render={({ field }) => (
                      <RadioGroup id="co-pay" value={field.value} onValueChange={field.onChange} className="gap-2">
                        {PAY.map((p) => (
                          <label key={p} className="flex cursor-pointer items-center gap-2 text-sm">
                            <RadioGroupItem value={p} />
                            {p}
                            {p === "Existing Credit Account" && <span className="text-xs text-muted-foreground">({customer.paymentTerms})</span>}
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  />
                </Field>
                <Field label="Special instructions" htmlFor="co-ins" className="sm:col-span-2" hint="Receiving hours, packing, who will receive, etc.">
                  <Textarea id="co-ins" rows={3} {...form.register("instructions")} />
                </Field>
              </CardContent>
            </Card>
          </div>

          <div className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Order summary</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                {lines.map((l) => (
                  <div key={l.productId} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">
                      {l.p.localName} {qty(l.quantity, l.p.unit)} × {peso(l.p.wholesalePrice)}
                    </span>
                    <span className="tabular">{peso(l.quantity * l.p.wholesalePrice)}</span>
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="tabular">{peso(subtotal)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>
                    Estimated delivery charge
                    <div className="text-xs text-muted-foreground">{fee.label}</div>
                  </span>
                  <span className="tabular">{fee.fee ? peso(fee.fee) : "—"}</span>
                </div>
                {fee.note && <p className="text-xs text-muted-foreground">{fee.note}</p>}
                <Separator className="my-1" />
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Estimated total</span>
                  <span className="text-2xl font-semibold tabular">{peso(total)}</span>
                </div>
                <DemoPriceNote />
              </CardContent>
            </Card>
            <Button type="submit" size="xl" disabled={form.formState.isSubmitting || belowMoq.length > 0}>
              Submit order for confirmation
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Orders are confirmed by our desk. Prefer chatting? <MessageCircle className="inline size-3.5" /> {COMPANY.messenger}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
