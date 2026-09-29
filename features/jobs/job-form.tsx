"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Calculator, CheckCircle2, FileQuestion, Plus, Sparkles, Trash2 } from "lucide-react";
import type { CargoCategory, Customer, JobSource, Leg, PaymentTerms, Place, TruckRequirement } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useCustomerStats } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaById, LUCENA_WAREHOUSE, PLACES } from "@/data/areas";
import { CARGO_CATEGORIES, CARGO_TYPES, cargoByKey, suggestFreight } from "@/data/cargo";
import { customerPlace } from "@/lib/logistics";
import { kg, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Separator, Textarea } from "@/components/ui/primitives";
import { Combobox, DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { DemoRateNote, JOB_SOURCES, LineItem, PageHeader } from "@/components/shared/common";

const TERMS: PaymentTerms[] = ["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days", "50% Down, Balance on Arrival"];
const REQUIREMENTS: TruckRequirement[] = ["Shared van (LTL)", "Insulated van, iced cargo", "Full truck — 10-wheeler"];
const CAPACITY = 8500;

const schema = z
  .object({
    customerId: z.string().min(1, "Choose the customer"),
    source: z.enum(JOB_SOURCES as [JobSource, ...JobSource[]]),
    leg: z.enum(["outbound", "return"]),
    pickupKey: z.string().min(1, "Choose the pickup point"),
    dropoffKey: z.string().min(1, "Choose the drop-off point"),
    consigneeName: z.string().trim().min(2, "Who receives the cargo?"),
    consigneePhone: z.string().trim().min(7, "Enter a contact number"),
    cargo: z
      .array(
        z.object({
          preset: z.string(),
          description: z.string().trim().min(2, "Describe the cargo"),
          category: z.enum(CARGO_CATEGORIES as [CargoCategory, ...CargoCategory[]]),
          quantity: z.number({ message: "Enter quantity" }).positive("Must be more than 0"),
          unit: z.string().trim().min(1, "Unit"),
          weightKg: z.number({ message: "Enter weight" }).positive("Must be more than 0").max(CAPACITY, "Exceeds one truck's configured payload"),
        }),
      )
      .min(1, "Add at least one cargo line"),
    truckRequirement: z.enum(REQUIREMENTS as [TruckRequirement, ...TruckRequirement[]]),
    pickupDate: z.string().min(10, "Pick the pickup date"),
    pickupTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a time"),
    requiredDate: z.string().min(10, "Pick the required delivery date"),
    requiredTime: z.string().regex(/^\d{2}:\d{2}$/, "Enter a time"),
    freightCharge: z.number({ message: "Enter the agreed freight" }).positive("Enter the agreed freight"),
    charges: z.array(z.object({ label: z.string().trim().min(2, "Label"), amount: z.number({ message: "Amount" }).min(0, "Cannot be negative") })),
    paymentTerms: z.enum(TERMS as [PaymentTerms, ...PaymentTerms[]]),
    instructions: z.string().max(400).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => `${v.requiredDate}T${v.requiredTime}` >= `${v.pickupDate}T${v.pickupTime}`, { path: ["requiredDate"], message: "Required delivery must be after pickup" })
  .refine((v) => v.pickupKey !== v.dropoffKey, { path: ["dropoffKey"], message: "Drop-off must differ from pickup" });
type Values = z.infer<typeof schema>;

const placeKey = (p: Place) => `place:${p.name}`;
const addrKey = (addressId: string) => `addr:${addressId}`;

function resolvePlace(key: string, customer: Customer | undefined): Place | undefined {
  if (key.startsWith("addr:") && customer) return customerPlace(customer, key.slice(5));
  const p = PLACES.find((x) => placeKey(x) === key);
  return p ? { name: p.name, areaId: p.areaId, address: p.address } : undefined;
}

function placeOptions(customer: Customer | undefined) {
  const out: { value: string; label: string; hint?: string }[] = [];
  if (customer) for (const a of customer.addresses) out.push({ value: addrKey(a.id), label: `${customer.name} — ${a.label}`, hint: `${a.line1}, ${a.city}` });
  for (const p of PLACES) out.push({ value: placeKey(p), label: p.name, hint: `${areaById(p.areaId).name} · ${p.address ?? ""}` });
  return out;
}

export function JobForm({ initialCustomerId }: { initialCustomerId?: string }) {
  const router = useRouter();
  const createJob = useAppStore((s) => s.createJob);
  const customersList = useAppStore((s) => s.customers);
  const customers = useCustomerMap();
  const stats = useCustomerStats();
  const [submitting, setSubmitting] = React.useState<"inquiry" | "confirm" | null>(null);

  const initial = initialCustomerId ? customers.get(initialCustomerId) : undefined;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: initial?.id ?? "",
      source: "Messenger",
      leg: "outbound",
      pickupKey: placeKey(LUCENA_WAREHOUSE),
      dropoffKey: initial ? addrKey(initial.addresses[0].id) : "",
      consigneeName: initial?.contacts[0].name ?? "",
      consigneePhone: initial?.contacts[0].phone ?? "",
      cargo: [{ preset: "", description: "", category: "Seafood", quantity: 0, unit: "styro box", weightKg: 0 }],
      truckRequirement: "Insulated van, iced cargo",
      pickupDate: TOMORROW,
      pickupTime: "02:00",
      requiredDate: TOMORROW,
      requiredTime: "09:00",
      freightCharge: 0,
      charges: [],
      paymentTerms: initial?.paymentTerms ?? "COD",
      instructions: "",
      notes: "",
    },
  });
  const { control, register, watch, setValue, formState, handleSubmit } = form;
  const cargo = useFieldArray({ control, name: "cargo" });
  const charges = useFieldArray({ control, name: "charges" });
  const v = watch();
  const customer = v.customerId ? customers.get(v.customerId) : undefined;
  const cStats = customer ? stats.get(customer.id) : undefined;
  const errors = formState.errors;

  const onCustomer = (id: string) => {
    const c = customers.get(id)!;
    setValue("customerId", id, { shouldValidate: true });
    setValue("paymentTerms", c.paymentTerms);
    const receiver = c.contacts[c.contacts.length > 1 ? 1 : 0];
    setValue("consigneeName", receiver.name);
    setValue("consigneePhone", receiver.phone);
    setValue("dropoffKey", addrKey(c.addresses[0].id), { shouldValidate: true });
  };
  const onLeg = (leg: Leg) => {
    setValue("leg", leg);
    if (leg === "outbound") {
      setValue("pickupKey", placeKey(LUCENA_WAREHOUSE));
      setValue("pickupTime", "02:00");
      setValue("requiredTime", "09:00");
    } else {
      setValue("pickupKey", placeKey(PLACES.find((p) => p.areaId === "valenzuela")!));
      setValue("pickupTime", "13:00");
      setValue("requiredTime", "21:00");
      setValue("truckRequirement", "Shared van (LTL)");
    }
    if (customer) setValue("dropoffKey", addrKey(customer.addresses[0].id));
  };
  const onPreset = (idx: number, key: string) => {
    const c = cargoByKey(key);
    const q = v.cargo[idx]?.quantity || 0;
    setValue(`cargo.${idx}.preset`, key);
    setValue(`cargo.${idx}.description`, c.label, { shouldValidate: true });
    setValue(`cargo.${idx}.category`, c.category);
    setValue(`cargo.${idx}.unit`, c.unit);
    if (q) setValue(`cargo.${idx}.weightKg`, Math.round(q * c.kgPerUnit), { shouldValidate: true });
    if (c.category === "Seafood" || c.category === "Shellfish") setValue("truckRequirement", "Insulated van, iced cargo");
  };
  const onQty = (idx: number, qty: number) => {
    setValue(`cargo.${idx}.quantity`, qty, { shouldValidate: true });
    const preset = v.cargo[idx]?.preset;
    if (preset && Number.isFinite(qty)) setValue(`cargo.${idx}.weightKg`, Math.round(qty * cargoByKey(preset).kgPerUnit), { shouldValidate: true });
  };

  const pickup = resolvePlace(v.pickupKey, customer);
  const dropoff = resolvePlace(v.dropoffKey, customer);
  const weight = v.cargo.reduce((s, l) => s + (Number.isFinite(l.weightKg) ? l.weightKg : 0), 0);
  const rateArea = v.leg === "outbound" ? dropoff?.areaId : pickup?.areaId;
  const suggested = rateArea && weight > 0 ? suggestFreight(v.leg, rateArea, weight) : 0;
  const freight = Number.isFinite(v.freightCharge) ? v.freightCharge : 0;
  const extra = v.charges.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0);
  const total = freight + extra;
  const hasOverdue = (cStats?.overdue ?? 0) > 0;
  const overLimit = !!customer && customer.creditLimit > 0 && (cStats?.outstanding ?? 0) + total > customer.creditLimit;

  const loadExample = () => {
    onCustomer("CUS-022");
    onLeg("outbound");
    cargo.replace([{ preset: "sugpo", description: cargoByKey("sugpo").label, category: "Seafood", quantity: 8, unit: "styro box", weightKg: 200 }]);
    setValue("source", "Messenger");
    setValue("freightCharge", 2000);
    charges.replace([{ label: "Re-icing en route", amount: 300 }]);
    setValue("instructions", "Back entrance on Aguinaldo Hwy; Chef Marco receives before 1:00 PM.");
  };

  const submit = (mode: "inquiry" | "confirm") =>
    handleSubmit((vals) => {
      const c = customers.get(vals.customerId)!;
      const p = resolvePlace(vals.pickupKey, c)!;
      const d = resolvePlace(vals.dropoffKey, c)!;
      setSubmitting(mode);
      const id = createJob({
        customerId: vals.customerId,
        source: vals.source,
        leg: vals.leg,
        pickup: p,
        dropoff: d,
        consignee: { name: vals.consigneeName, phone: vals.consigneePhone },
        cargo: vals.cargo.map((l) => ({ cargoDescription: l.description, cargoCategory: l.category, quantity: l.quantity, unit: l.unit, weightKg: l.weightKg, handlingNotes: l.preset ? cargoByKey(l.preset).handling : undefined })),
        truckRequirement: vals.truckRequirement,
        pickupAt: `${vals.pickupDate}T${vals.pickupTime}`,
        requiredBy: `${vals.requiredDate}T${vals.requiredTime}`,
        freightCharge: vals.freightCharge,
        additionalCharges: vals.charges,
        paymentTerms: vals.paymentTerms,
        instructions: vals.instructions || undefined,
        notes: [vals.notes, hasOverdue && mode === "confirm" ? "Customer has overdue freight — confirm with accounting before dispatch." : ""].filter(Boolean).join(" ") || undefined,
        status: mode === "inquiry" ? "Inquiry" : vals.pickupDate <= TOMORROW ? "Awaiting Dispatch" : "Confirmed",
      });
      toast.success(mode === "inquiry" ? `Inquiry ${id} saved` : `Job ${id} confirmed`, {
        description: mode === "inquiry" ? "Send a quote or confirm it once the customer agrees." : "It now appears on the Dispatch board and the customer profile.",
      });
      router.push(`/jobs/${id}`);
    })();

  const customerOptions = customersList
    .filter((c) => c.status !== "inactive")
    .map((c) => ({ value: c.id, label: c.name, hint: `${c.type} · ${areaById(c.areaId).name} · ${c.paymentTerms}`, keywords: [c.id, c.contacts[0].name] }));
  const places = placeOptions(customer);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Logistics Jobs", href: "/jobs" }, { label: "New job" }]}
        title="Create Logistics Job"
        description="Record a booking received by phone, Messenger, Facebook or walk-in. Freight is billed per job; the dispatcher assigns it to a trip."
        actions={
          <Button variant="outline" size="sm" onClick={loadExample} type="button">
            <Sparkles /> Load example booking
          </Button>
        }
      />
      <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Customer & booking</CardTitle>
                <CardDescription>Who is booking, and how the booking came in</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" htmlFor="customer" error={errors.customerId?.message} required className="sm:col-span-2">
                <Combobox id="customer" options={customerOptions} value={v.customerId} onChange={onCustomer} placeholder="Search customer or contact…" invalid={!!errors.customerId} />
              </Field>
              {customer && (hasOverdue || overLimit) && (
                <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm sm:col-span-2" role="alert">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                  <div>
                    {hasOverdue && (
                      <div>
                        <b>{peso(cStats!.overdue)}</b> overdue freight (oldest {cStats!.oldestOverdueDays} days).
                      </div>
                    )}
                    {overLimit && <div>This booking would exceed the {peso(customer.creditLimit)} credit limit.</div>}
                    <div className="text-xs text-muted-foreground">Confirm with accounting before dispatch.</div>
                  </div>
                </div>
              )}
              <Field label="Booking source" htmlFor="source" required>
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_SOURCES.filter((s) => s !== "Load Board").map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Payment terms" htmlFor="terms" required>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Route & schedule</CardTitle>
                <CardDescription>Outbound cargo leaves Lucena; return-leg cargo rides a truck heading back to Quezon</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid grid-cols-2 gap-2 sm:col-span-2" role="radiogroup" aria-label="Leg">
                {(["outbound", "return"] as Leg[]).map((leg) => (
                  <button
                    key={leg}
                    type="button"
                    role="radio"
                    aria-checked={v.leg === leg}
                    onClick={() => onLeg(leg)}
                    className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors", v.leg === leg ? "border-primary bg-accent/50 ring-1 ring-primary" : "hover:bg-muted/50")}
                  >
                    {leg === "outbound" ? <ArrowUpRight className="size-4 text-primary" /> : <ArrowDownLeft className="size-4 text-[oklch(0.45_0.14_300)]" />}
                    <span>
                      <span className="block font-medium">{leg === "outbound" ? "Outbound" : "Return leg (backhaul)"}</span>
                      <span className="block text-xs text-muted-foreground">{leg === "outbound" ? "Lucena → Metro Manila / CALABARZON" : "Manila / CALABARZON → Quezon"}</span>
                    </span>
                  </button>
                ))}
              </div>
              <Field label="Pickup point" htmlFor="pickup" error={errors.pickupKey?.message} required>
                <Combobox id="pickup" options={places} value={v.pickupKey} onChange={(x) => setValue("pickupKey", x, { shouldValidate: true })} placeholder="Choose pickup" invalid={!!errors.pickupKey} />
              </Field>
              <Field label="Drop-off point" htmlFor="dropoff" error={errors.dropoffKey?.message} required>
                <Combobox id="dropoff" options={places} value={v.dropoffKey} onChange={(x) => setValue("dropoffKey", x, { shouldValidate: true })} placeholder={customer ? "Choose drop-off" : "Choose a customer first"} invalid={!!errors.dropoffKey} />
              </Field>
              <Field label="Pickup date" htmlFor="pdate" error={errors.pickupDate?.message} required>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <DatePicker id="pdate" value={v.pickupDate} onChange={(d) => setValue("pickupDate", d, { shouldValidate: true })} minDate={TODAY} invalid={!!errors.pickupDate} />
                  <Input type="time" aria-label="Pickup time" {...register("pickupTime")} aria-invalid={!!errors.pickupTime} />
                </div>
              </Field>
              <Field label="Required delivery" htmlFor="rdate" error={errors.requiredDate?.message ?? errors.requiredTime?.message} required>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <DatePicker id="rdate" value={v.requiredDate} onChange={(d) => setValue("requiredDate", d, { shouldValidate: true })} minDate={v.pickupDate || TODAY} invalid={!!errors.requiredDate} />
                  <Input type="time" aria-label="Required delivery time" {...register("requiredTime")} aria-invalid={!!errors.requiredTime} />
                </div>
              </Field>
              <Field label="Consignee / receiver" htmlFor="cname" error={errors.consigneeName?.message} required>
                <Input id="cname" {...register("consigneeName")} aria-invalid={!!errors.consigneeName} />
              </Field>
              <Field label="Receiver contact no." htmlFor="cphone" error={errors.consigneePhone?.message} required>
                <Input id="cphone" inputMode="tel" {...register("consigneePhone")} aria-invalid={!!errors.consigneePhone} />
              </Field>
              <Field label="Delivery instructions" htmlFor="instr" hint="Shown to the driver on the mobile view" className="sm:col-span-2">
                <Textarea id="instr" rows={2} {...register("instructions")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Cargo</CardTitle>
                <CardDescription>Gross weight incl. ice, boxes and sacks — used for truck capacity planning. Each line becomes a load.</CardDescription>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => cargo.append({ preset: "", description: "", category: "Produce", quantity: 0, unit: "sack", weightKg: 0 })}>
                <Plus /> Add line
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {cargo.fields.map((f, idx) => {
                const e = errors.cargo?.[idx];
                return (
                  <div key={f.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
                    <Field label="Cargo type" htmlFor={`preset-${idx}`} className="sm:col-span-4">
                      <Combobox id={`preset-${idx}`} options={CARGO_TYPES.map((c) => ({ value: c.key, label: c.label, hint: `${c.category} · ${c.unit} ≈ ${c.kgPerUnit} kg` }))} value={v.cargo[idx]?.preset} onChange={(x) => onPreset(idx, x)} placeholder="Choose or type below" />
                    </Field>
                    <Field label="Description" htmlFor={`desc-${idx}`} error={e?.description?.message} required className="sm:col-span-4">
                      <Input id={`desc-${idx}`} {...register(`cargo.${idx}.description`)} aria-invalid={!!e?.description} />
                    </Field>
                    <Field label="Category" htmlFor={`cat-${idx}`} className="sm:col-span-4">
                      <Controller
                        control={control}
                        name={`cargo.${idx}.category`}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger id={`cat-${idx}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CARGO_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Quantity" htmlFor={`qty-${idx}`} error={e?.quantity?.message} required className="sm:col-span-3">
                      <Input id={`qty-${idx}`} type="number" inputMode="numeric" min={0} value={Number.isFinite(v.cargo[idx]?.quantity) ? v.cargo[idx].quantity || "" : ""} onChange={(ev) => onQty(idx, ev.target.valueAsNumber)} aria-invalid={!!e?.quantity} />
                    </Field>
                    <Field label="Unit" htmlFor={`unit-${idx}`} error={e?.unit?.message} className="sm:col-span-3">
                      <Input id={`unit-${idx}`} {...register(`cargo.${idx}.unit`)} />
                    </Field>
                    <Field label="Gross weight (kg)" htmlFor={`kg-${idx}`} error={e?.weightKg?.message} required className="sm:col-span-4">
                      <Input id={`kg-${idx}`} type="number" inputMode="numeric" min={0} {...register(`cargo.${idx}.weightKg`, { valueAsNumber: true })} aria-invalid={!!e?.weightKg} />
                    </Field>
                    <div className="flex items-end justify-end sm:col-span-2">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => cargo.remove(idx)} disabled={cargo.fields.length === 1} aria-label={`Remove cargo line ${idx + 1}`}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {errors.cargo?.root?.message && <p className="text-xs text-destructive">{errors.cargo.root.message}</p>}
              <Field label="Truck requirement" htmlFor="req" className="sm:max-w-xs">
                <Controller
                  control={control}
                  name="truckRequirement"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="req">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REQUIREMENTS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Charges</CardTitle>
                <CardDescription>Agreed freight plus pass-through or service charges</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Freight charge (₱)" htmlFor="freight" error={errors.freightCharge?.message} required>
                  <Input id="freight" type="number" inputMode="numeric" min={0} {...register("freightCharge", { valueAsNumber: true })} aria-invalid={!!errors.freightCharge} />
                </Field>
                <Button type="button" variant="outline" disabled={!suggested} onClick={() => setValue("freightCharge", suggested, { shouldValidate: true })}>
                  <Calculator /> Use rate card {suggested ? `(${peso(suggested)})` : ""}
                </Button>
              </div>
              {charges.fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-[1fr_140px_auto] items-end gap-2">
                  <Field label={idx === 0 ? "Additional charge" : ""} htmlFor={`cl-${idx}`} error={errors.charges?.[idx]?.label?.message}>
                    <Input id={`cl-${idx}`} placeholder="e.g. Re-icing en route" {...register(`charges.${idx}.label`)} />
                  </Field>
                  <Field label={idx === 0 ? "Amount (₱)" : ""} htmlFor={`ca-${idx}`} error={errors.charges?.[idx]?.amount?.message}>
                    <Input id={`ca-${idx}`} type="number" min={0} {...register(`charges.${idx}.amount`, { valueAsNumber: true })} />
                  </Field>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => charges.remove(idx)} aria-label="Remove charge">
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {[
                  ["Re-icing en route", 300],
                  ["Waiting time (1 hr)", 500],
                  ["Second drop point", 800],
                  ["After-hours unloading", 500],
                ].map(([label, amount]) => (
                  <Button key={label} type="button" size="sm" variant="ghost" onClick={() => charges.append({ label: String(label), amount: Number(amount) })}>
                    <Plus /> {label}
                  </Button>
                ))}
              </div>
              <Field label="Internal notes" htmlFor="notes">
                <Textarea id="notes" rows={2} {...register("notes")} />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="grid content-start gap-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Job summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <LineItem label="Customer" value={customer?.name ?? "—"} />
              <LineItem label="Lane" value={pickup && dropoff ? `${areaById(pickup.areaId).name.replace(" City", "")} → ${areaById(dropoff.areaId).name.replace(" City", "")}` : "—"} />
              <LineItem label="Gross weight" value={kg(weight)} />
              <div className="text-xs text-muted-foreground">{weight > 0 ? `${((weight / CAPACITY) * 100).toFixed(0)}% of one van's configured payload` : "Add cargo to see capacity use"}</div>
              <Separator className="my-1" />
              <LineItem label="Freight" value={peso(freight)} />
              {suggested > 0 && Math.abs(freight - suggested) / suggested > 0.15 && freight > 0 && (
                <div className="rounded-md bg-warning-soft px-2 py-1 text-xs text-[oklch(0.45_0.11_65)]">Rate card suggests {peso(suggested)} — confirm the negotiated rate.</div>
              )}
              <LineItem label="Additional charges" value={peso(extra)} muted />
              <div className="flex items-baseline justify-between border-t pt-2">
                <span className="font-semibold">Total billable</span>
                <span className="text-xl font-semibold tabular">{peso(total)}</span>
              </div>
              <div className="text-xs text-muted-foreground">Invoiced on delivery · {v.paymentTerms}</div>
              <DemoRateNote className="mt-1" />
            </CardContent>
          </Card>
          <div className="grid gap-2">
            <Button type="button" size="lg" onClick={() => submit("confirm")} disabled={!!submitting}>
              <CheckCircle2 /> {submitting === "confirm" ? "Confirming…" : "Confirm job"}
            </Button>
            <Button type="button" variant="outline" onClick={() => submit("inquiry")} disabled={!!submitting}>
              <FileQuestion /> {submitting === "inquiry" ? "Saving…" : "Save as inquiry"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/jobs">Cancel</Link>
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
