"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { Calculator, Plus, Save, Send, Trash2 } from "lucide-react";
import type { CargoCategory, Place, TruckRequirement } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY, TOMORROW } from "@/data/company";
import { areaById, LUCENA_WAREHOUSE, PLACES } from "@/data/areas";
import { CARGO_CATEGORIES, suggestFreight } from "@/data/cargo";
import { customerPlace } from "@/lib/logistics";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Input, Textarea } from "@/components/ui/primitives";
import { Combobox, DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { DemoRateNote } from "@/components/shared/common";

const REQUIREMENTS: TruckRequirement[] = ["Shared van (LTL)", "Insulated van, iced cargo", "Full truck — 10-wheeler"];

const schema = z
  .object({
    party: z.string().min(1, "Choose a customer or lead"),
    pickupKey: z.string().min(1, "Choose the pickup point"),
    dropoffKey: z.string().min(1, "Choose or type the drop-off"),
    cargoDescription: z.string().trim().min(2, "Describe the cargo"),
    cargoCategory: z.enum(CARGO_CATEGORIES as [CargoCategory, ...CargoCategory[]]),
    weightKg: z.number({ message: "Enter weight" }).positive("Must be more than 0").max(8500, "Exceeds one truck's configured payload"),
    truckRequirement: z.enum(REQUIREMENTS as [TruckRequirement, ...TruckRequirement[]]),
    pickupDate: z.string().min(10, "Pick a date"),
    requiredDate: z.string().min(10, "Pick a date"),
    freightCharge: z.number({ message: "Enter freight" }).positive("Enter freight"),
    charges: z.array(z.object({ label: z.string().trim().min(2, "Label"), amount: z.number({ message: "Amount" }).min(0) })),
    validUntil: z.string().min(10, "Pick a date"),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.requiredDate >= v.pickupDate, { path: ["requiredDate"], message: "Must be on or after pickup" })
  .refine((v) => v.validUntil >= TODAY, { path: ["validUntil"], message: "Must be today or later" });
type Values = z.infer<typeof schema>;

export function QuoteFormDialog({ open, onOpenChange, initialParty, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; initialParty?: string; onCreated?: (id: string) => void }) {
  const customers = useAppStore((s) => s.customers);
  const leads = useAppStore((s) => s.leads);
  const createQuote = useAppStore((s) => s.createQuote);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      party: initialParty ?? "",
      pickupKey: `place:${LUCENA_WAREHOUSE.name}`,
      dropoffKey: "",
      cargoDescription: "",
      cargoCategory: "Seafood",
      weightKg: 0,
      truckRequirement: "Insulated van, iced cargo",
      pickupDate: TOMORROW,
      requiredDate: TOMORROW,
      freightCharge: 0,
      charges: [],
      validUntil: format(addDays(parseISO(TODAY), 7), "yyyy-MM-dd"),
      notes: "",
    },
  });
  const { control, register, watch, setValue, handleSubmit, formState, reset } = form;
  const charges = useFieldArray({ control, name: "charges" });
  const v = watch();
  const errors = formState.errors;
  const customer = v.party.startsWith("CUS-") ? customers.find((c) => c.id === v.party) : undefined;
  const lead = v.party.startsWith("LD-") ? leads.find((l) => l.id === v.party) : undefined;

  const partyOptions = [
    ...customers.map((c) => ({ value: c.id, label: c.name, hint: `Customer · ${areaById(c.areaId).name}` })),
    ...leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost").map((l) => ({ value: l.id, label: l.businessName, hint: `Lead · ${l.location} · ${l.lane}` })),
  ];
  const placeOptions = [
    ...(customer ? customer.addresses.map((a) => ({ value: `addr:${a.id}`, label: `${customer.name} — ${a.label}`, hint: a.city })) : []),
    ...(lead ? [{ value: "lead", label: lead.businessName, hint: lead.location }] : []),
    ...PLACES.map((p) => ({ value: `place:${p.name}`, label: p.name, hint: areaById(p.areaId).name })),
  ];
  const resolve = (key: string): Place | undefined => {
    if (key.startsWith("addr:") && customer) return customerPlace(customer, key.slice(5));
    if (key === "lead" && lead) return { name: lead.businessName, areaId: lead.areaId ?? "lucena", address: lead.location };
    const p = PLACES.find((x) => `place:${x.name}` === key);
    return p ? { name: p.name, areaId: p.areaId, address: p.address } : undefined;
  };
  const pickup = resolve(v.pickupKey);
  const dropoff = resolve(v.dropoffKey);
  const leg = pickup && areaById(pickup.areaId).region === "Quezon Province" ? "outbound" : "return";
  const suggested = pickup && dropoff && v.weightKg > 0 ? suggestFreight(leg, leg === "outbound" ? dropoff.areaId : pickup.areaId, v.weightKg) : 0;
  const total = (Number.isFinite(v.freightCharge) ? v.freightCharge : 0) + v.charges.reduce((s, c) => s + (Number.isFinite(c.amount) ? c.amount : 0), 0);

  const submit = (status: "Draft" | "Sent") =>
    handleSubmit((vals) => {
      const id = createQuote({
        customerId: customer?.id,
        leadId: lead?.id,
        pickup: resolve(vals.pickupKey)!,
        dropoff: resolve(vals.dropoffKey)!,
        cargoDescription: vals.cargoDescription,
        cargoCategory: vals.cargoCategory,
        weightKg: vals.weightKg,
        truckRequirement: vals.truckRequirement,
        pickupDate: vals.pickupDate,
        requiredDate: vals.requiredDate,
        freightCharge: vals.freightCharge,
        additionalCharges: vals.charges,
        notes: vals.notes || undefined,
        validUntil: vals.validUntil,
        status,
      });
      toast.success(status === "Sent" ? `Quote ${id} sent` : `Draft ${id} saved`, { description: status === "Sent" ? "Marked as sent — share it via Messenger or email." : "You can send it later." });
      reset();
      onOpenChange(false);
      onCreated?.(id);
    })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New freight quotation</DialogTitle>
          <DialogDescription>Quote a lane for a customer or a lead. Accepted quotes convert to a logistics job.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
          <Field label="Customer or lead" htmlFor="q-party" error={errors.party?.message} required className="sm:col-span-2">
            <Combobox id="q-party" options={partyOptions} value={v.party} onChange={(x) => setValue("party", x, { shouldValidate: true })} placeholder="Search customers and open leads…" invalid={!!errors.party} />
          </Field>
          <Field label="Pickup" htmlFor="q-pickup" error={errors.pickupKey?.message} required>
            <Combobox id="q-pickup" options={placeOptions} value={v.pickupKey} onChange={(x) => setValue("pickupKey", x, { shouldValidate: true })} />
          </Field>
          <Field label="Drop-off" htmlFor="q-drop" error={errors.dropoffKey?.message} required>
            <Combobox id="q-drop" options={placeOptions} value={v.dropoffKey} onChange={(x) => setValue("dropoffKey", x, { shouldValidate: true })} placeholder="Choose drop-off" invalid={!!errors.dropoffKey} />
          </Field>
          <Field label="Cargo type" htmlFor="q-cargo" error={errors.cargoDescription?.message} required>
            <Input id="q-cargo" placeholder="e.g. Sugpo, iced (styro boxes)" {...register("cargoDescription")} aria-invalid={!!errors.cargoDescription} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="q-cat">
              <Controller
                control={control}
                name="cargoCategory"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="q-cat">
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
            <Field label="Weight (kg)" htmlFor="q-kg" error={errors.weightKg?.message} required>
              <Input id="q-kg" type="number" min={0} {...register("weightKg", { valueAsNumber: true })} aria-invalid={!!errors.weightKg} />
            </Field>
          </div>
          <Field label="Truck requirement" htmlFor="q-req">
            <Controller
              control={control}
              name="truckRequirement"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="q-req">
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
          <Field label="Valid until" htmlFor="q-valid" error={errors.validUntil?.message} required>
            <DatePicker id="q-valid" value={v.validUntil} onChange={(d) => setValue("validUntil", d, { shouldValidate: true })} minDate={TODAY} />
          </Field>
          <Field label="Pickup date" htmlFor="q-pdate" error={errors.pickupDate?.message} required>
            <DatePicker id="q-pdate" value={v.pickupDate} onChange={(d) => setValue("pickupDate", d, { shouldValidate: true })} minDate={TODAY} />
          </Field>
          <Field label="Required delivery date" htmlFor="q-rdate" error={errors.requiredDate?.message} required>
            <DatePicker id="q-rdate" value={v.requiredDate} onChange={(d) => setValue("requiredDate", d, { shouldValidate: true })} minDate={v.pickupDate || TODAY} />
          </Field>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Freight charge (₱)" htmlFor="q-freight" error={errors.freightCharge?.message} required>
              <Input id="q-freight" type="number" min={0} {...register("freightCharge", { valueAsNumber: true })} aria-invalid={!!errors.freightCharge} />
            </Field>
            <Button type="button" variant="outline" disabled={!suggested} onClick={() => setValue("freightCharge", suggested, { shouldValidate: true })}>
              <Calculator /> Rate card {suggested ? peso(suggested) : ""}
            </Button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            {charges.fields.map((f, idx) => (
              <div key={f.id} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <Input aria-label="Charge label" placeholder="e.g. Waiting time" {...register(`charges.${idx}.label`)} />
                <Input aria-label="Charge amount" type="number" min={0} {...register(`charges.${idx}.amount`, { valueAsNumber: true })} />
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => charges.remove(idx)} aria-label="Remove charge">
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => charges.append({ label: "", amount: 0 })}>
              <Plus /> Additional charge
            </Button>
          </div>
          <Field label="Notes to customer" htmlFor="q-notes" className="sm:col-span-2">
            <Textarea id="q-notes" rows={2} {...register("notes")} />
          </Field>
          <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm sm:col-span-2">
            <span>
              Quote total <span className="text-xs text-muted-foreground">({leg === "outbound" ? "outbound lane" : "return-leg lane"})</span>
            </span>
            <span className="text-lg font-semibold tabular">{peso(total)}</span>
          </div>
          <DemoRateNote className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => submit("Draft")}>
            <Save /> Save draft
          </Button>
          <Button type="button" onClick={() => submit("Sent")}>
            <Send /> Save & mark sent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
