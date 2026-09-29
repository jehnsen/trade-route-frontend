"use client";

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Send, Save, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { SUPPLIERS, supplierById } from "@/data/suppliers";
import { productById, productLabel } from "@/data/products";
import { LUCENA_WAREHOUSE, routeById } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { itemLoadKg } from "@/lib/calc";
import { fmtDay, kg, peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Combobox, DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

const schema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  pickupDate: z.string().min(10, "Pick a date"),
  tripId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({ productId: z.string().min(1, "Choose a product"), quantity: z.number({ message: "Enter qty" }).positive("Must be > 0"), unitCost: z.number({ message: "Enter cost" }).positive("Must be > ₱0") })).min(1),
});
type Values = z.infer<typeof schema>;

export interface PODraft {
  supplierId?: string;
  productId?: string;
  quantity?: number;
  unitCost?: number;
  tripId?: string;
}

export function CreatePODialog({ open, onOpenChange, draft }: { open: boolean; onOpenChange: (v: boolean) => void; draft?: PODraft }) {
  const createPO = useAppStore((s) => s.createPO);
  const createCompanyLoad = useAppStore((s) => s.createCompanyLoad);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      supplierId: draft?.supplierId ?? "",
      pickupDate: TODAY,
      tripId: draft?.tripId ?? "",
      notes: "",
      items: [{ productId: draft?.productId ?? "", quantity: draft?.quantity ?? 0, unitCost: draft?.unitCost ?? 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const v = form.watch();
  const supplier = v.supplierId ? supplierById(v.supplierId) : undefined;
  const tripOptions = trips.filter((t) => t.date >= TODAY && ["Planned", "Loading", "Ready", "Dispatched", "In Transit"].includes(t.status) && (!supplier || routeById(t.routeId).returnAreas.includes(supplier.pickupAreaId)));
  const total = v.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitCost || 0), 0);
  const load = v.items.filter((i) => i.productId).reduce((s, i) => s + itemLoadKg({ productId: i.productId, quantity: i.quantity || 0 }), 0);
  const tripM = v.tripId ? metrics.get(v.tripId) : undefined;
  const e = form.formState.errors;

  const submit = (status: "Draft" | "Sent") =>
    form.handleSubmit((vals) => {
      const trip = vals.tripId ? trips.find((t) => t.id === vals.tripId) : undefined;
      const sup = supplierById(vals.supplierId);
      const id = createPO({ supplierId: vals.supplierId, items: vals.items, pickupDate: trip?.date ?? vals.pickupDate, status, notes: vals.notes || undefined });
      // The pickup rides the trip as plain company-owned cargo; the load does not depend on the PO.
      if (trip)
        for (const i of vals.items) {
          const p = productById(i.productId);
          createCompanyLoad({ cargoDescription: productLabel(p), cargoCategory: p.category === "seafood" ? "Seafood" : "Produce", quantity: i.quantity, unit: p.unit === "pc" ? "pc" : "kg", weightKg: Math.round(itemLoadKg({ productId: i.productId, quantity: i.quantity })), leg: "return", pickup: { name: sup.pickupLocation, areaId: sup.pickupAreaId }, destination: LUCENA_WAREHOUSE, estimatedValue: Math.round(i.quantity * i.unitCost), handlingNotes: `Company purchase (${id}) — pay supplier on pickup.`, tripId: trip.id });
        }
      toast.success(status === "Draft" ? `${id} saved as draft` : `${id} sent to ${sup.name}`, { description: trip ? `Pickup added as company cargo on ${trip.id} (${truckById(trip.truckId).code})` : undefined });
      onOpenChange(false);
    })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
          <DialogDescription>Optionally pick a return trip — the pickup is added to that trip as company-owned cargo, using empty backhaul capacity.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(ev) => ev.preventDefault()} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="po-sup" error={e.supplierId?.message} required>
              <Combobox
                id="po-sup"
                value={v.supplierId}
                invalid={!!e.supplierId}
                onChange={(id) => {
                  form.setValue("supplierId", id, { shouldValidate: true });
                  form.setValue("tripId", "");
                }}
                options={SUPPLIERS.map((s) => ({ value: s.id, label: s.name, hint: `${s.type} · ${s.pickupLocation}` }))}
                placeholder="Choose supplier"
              />
            </Field>
            <Field label="Return trip (backhaul)" htmlFor="po-trip" hint={supplier ? `Trips whose return leg passes ${supplier.pickupLocation}` : "Choose a supplier first"}>
              <Controller
                control={form.control}
                name="tripId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(x) => field.onChange(x === "none" ? "" : x)} disabled={!supplier}>
                    <SelectTrigger id="po-trip">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{supplier?.pickupAreaId && ["lucena", "pagbilao", "tayabas", "sariaya", "candelaria"].includes(supplier.pickupAreaId) ? "Supplier delivers to bodega" : "Not assigned yet"}</SelectItem>
                      {tripOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.id} · {truckById(t.truckId).code} · {fmtDay(t.date)} · {kg(metrics.get(t.id)!.capacityKg - metrics.get(t.id)!.returnKg)} free
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {!v.tripId && (
              <Field label="Pickup / delivery date" htmlFor="po-date">
                <Controller control={form.control} name="pickupDate" render={({ field }) => <DatePicker id="po-date" value={field.value} onChange={field.onChange} minDate={TODAY} />} />
              </Field>
            )}
          </div>

          <div className="grid gap-2">
            {fields.map((f, idx) => (
              <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_90px_100px_36px] items-end gap-2">
                <Field label={idx === 0 ? "Product" : ""} htmlFor={`po-p-${idx}`} error={e.items?.[idx]?.productId?.message}>
                  <Combobox
                    id={`po-p-${idx}`}
                    value={v.items[idx]?.productId}
                    invalid={!!e.items?.[idx]?.productId}
                    onChange={(pid) => {
                      form.setValue(`items.${idx}.productId`, pid, { shouldValidate: true });
                      if (!v.items[idx]?.unitCost) form.setValue(`items.${idx}.unitCost`, productById(pid).cost);
                    }}
                    options={(supplier ? supplier.productIds : []).map((pid) => ({ value: pid, label: productLabel(productById(pid)), hint: `demo cost ~${peso(productById(pid).cost)}/${productById(pid).unit}` }))}
                    placeholder={supplier ? "Choose product" : "Choose supplier first"}
                  />
                </Field>
                <Field label={idx === 0 ? "Qty (kg)" : ""} htmlFor={`po-q-${idx}`} error={e.items?.[idx]?.quantity?.message}>
                  <Input id={`po-q-${idx}`} type="number" {...form.register(`items.${idx}.quantity`, { valueAsNumber: true })} />
                </Field>
                <Field label={idx === 0 ? "Unit cost (₱)" : ""} htmlFor={`po-c-${idx}`} error={e.items?.[idx]?.unitCost?.message}>
                  <Input id={`po-c-${idx}`} type="number" {...form.register(`items.${idx}.unitCost`, { valueAsNumber: true })} />
                </Field>
                <Button type="button" variant="ghost" size="icon" disabled={fields.length === 1} onClick={() => remove(idx)} aria-label="Remove line">
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => append({ productId: "", quantity: 0, unitCost: 0 })} disabled={!supplier}>
              <Plus /> Add line
            </Button>
          </div>
          <Field label="Notes to supplier" htmlFor="po-notes">
            <Textarea id="po-notes" rows={2} placeholder="e.g. Ready by 12:00 NN, 25 kg sacks" {...form.register("notes")} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 p-3 text-sm">
            <span>
              PO value <b className="tabular">{peso(total)}</b> · {kg(load)}
            </span>
            {tripM && (
              <span className={tripM.returnKg + load > tripM.capacityKg ? "font-medium text-danger" : "text-muted-foreground"}>
                Return load after pickup: {kg(tripM.returnKg + load)} / {kg(tripM.capacityKg)}
              </span>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => submit("Draft")}>
              <Save /> Save draft
            </Button>
            <Button type="button" onClick={() => submit("Sent")}>
              <Send /> Send to supplier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
