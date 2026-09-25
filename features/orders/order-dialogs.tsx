"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import type { Order, PaymentMethod } from "@/types";
import { useAppStore } from "@/lib/store";
import { useInvoiceMap, useTripMetrics } from "@/hooks/use-data";
import { routeById } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { productById, productLabel } from "@/data/products";
import { invoiceIdForOrder, orderBilledAmount, orderLoadKg, orderTotal } from "@/lib/calc";
import { fmtDay, fmtTime, kg, peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Input, Textarea } from "@/components/ui/primitives";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { CapacityBar } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "GCash", "Maya", "Bank Transfer", "Check", "COD", "Credit Settlement"];

// ─── Record payment ─────────────────────────────────────────────────────────
const paymentSchema = z.object({
  amount: z.number({ message: "Enter an amount" }).positive("Amount must be more than ₱0"),
  method: z.enum(["Cash", "GCash", "Maya", "Bank Transfer", "Check", "COD", "Credit Settlement"]),
  reference: z.string().min(3, "Add a reference (masked is fine, e.g. •••• 4821)"),
  notes: z.string().optional(),
});
type PaymentValues = z.infer<typeof paymentSchema>;

export function RecordPaymentDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const invoice = useInvoiceMap().get(order.id);
  const record = useAppStore((s) => s.recordPayment);
  const balance = invoice ? invoice.balance : orderBilledAmount(order);
  const form = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    values: { amount: balance, method: order.paymentTerms === "COD" ? "Cash" : "Bank Transfer", reference: "", notes: "" },
  });
  const { register, handleSubmit, formState, control, watch } = form;
  const amount = watch("amount");
  const submit = handleSubmit((v) => {
    if (v.amount > balance + 0.5) {
      form.setError("amount", { message: `Cannot exceed the ${peso(balance)} balance` });
      return;
    }
    const receipt = record({ invoiceId: invoiceIdForOrder(order.id), orderId: order.id, customerId: order.customerId, amount: v.amount, method: v.method, reference: v.reference, notes: v.notes });
    toast.success(`Payment of ${peso(v.amount)} recorded`, { description: `${receipt} · applied to ${invoiceIdForOrder(order.id)}` });
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {invoiceIdForOrder(order.id)} · Balance <b className="text-foreground">{peso(balance)}</b>
            {!invoice && " · invoice will be issued on delivery"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount received" htmlFor="pay-amount" error={formState.errors.amount?.message} required>
              <Input id="pay-amount" type="number" step="0.01" inputMode="decimal" aria-invalid={!!formState.errors.amount} {...register("amount", { valueAsNumber: true })} />
            </Field>
            <Field label="Payment method" htmlFor="pay-method" required>
              <Controller
                control={control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pay-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field label="Reference no." htmlFor="pay-ref" error={formState.errors.reference?.message} hint="Use a masked reference — never store full account numbers." required>
            <Input id="pay-ref" placeholder="e.g. GCash Ref •••• 4821" aria-invalid={!!formState.errors.reference} {...register("reference")} />
          </Field>
          <Field label="Notes" htmlFor="pay-notes">
            <Textarea id="pay-notes" rows={2} placeholder="e.g. Collected by Joel at Navotas port" {...register("notes")} />
          </Field>
          {amount > 0 && amount < balance && <p className="rounded-md bg-warning-soft px-3 py-2 text-xs">Partial payment — {peso(balance - amount)} will remain outstanding.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              <CheckCircle2 /> Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign to trip ─────────────────────────────────────────────────────────
export function AssignTripDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const trips = useAppStore((s) => s.trips);
  const assign = useAppStore((s) => s.assignOrderToTrip);
  const metrics = useTripMetrics();
  const lastDate = format(addDays(parseISO(order.deliveryDate), 3), "yyyy-MM-dd");
  const candidates = trips.filter((t) => t.date >= order.deliveryDate && t.date <= lastDate && (t.status === "Planned" || t.status === "Loading"));
  const [selected, setSelected] = React.useState<string | undefined>(order.tripId);
  const load = orderLoadKg(order);
  const confirm = () => {
    if (!selected) return;
    assign(order.id, selected);
    toast.success(`${order.id} assigned to ${selected}`, { description: `${truckById(trips.find((t) => t.id === selected)!.truckId).code} · ${kg(load)} added to the load` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign {order.id} to a trip</DialogTitle>
          <DialogDescription>
            Estimated load {kg(load)} incl. ice & packaging · requested {fmtDay(order.deliveryDate)}
          </DialogDescription>
        </DialogHeader>
        {order.fulfillment !== "truck" ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">This order is fulfilled by {order.fulfillment === "pickup" ? "bodega pickup" : "the sea-freight partner"} and does not ride on our trucks.</p>
        ) : candidates.length === 0 ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">No planned or loading trips on or after the requested date. Create the trip from the Dispatch Board first.</p>
        ) : (
          <div className="grid gap-2" role="radiogroup" aria-label="Trips">
            {candidates.map((t) => {
              const m = metrics.get(t.id)!;
              const already = order.tripId === t.id;
              const after = m.outboundLoadKg + (already ? 0 : load);
              const over = after > m.capacityKg;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === t.id}
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={cn("grid gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer", selected === t.id ? "border-primary bg-accent/50 ring-2 ring-primary/20" : "hover:bg-muted/50")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Truck className="size-4 text-primary" /> {t.id} · {truckById(t.truckId).code}
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {routeById(t.routeId).name} · departs {fmtDay(t.date)} {fmtTime(t.departure)} · {driverById(t.driverId).name}
                  </div>
                  <CapacityBar used={after} capacity={m.capacityKg} label={already ? "Current load" : "Load after assigning"} size="sm" />
                  {over && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-danger">
                      <AlertTriangle className="size-3.5" /> Truck capacity exceeded by {kg(after - m.capacityKg)}.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <DialogFooter>
          {order.tripId && (
            <Button
              variant="ghost"
              className="sm:mr-auto"
              onClick={() => {
                assign(order.id, null);
                toast.success(`${order.id} removed from ${order.tripId}`);
                onOpenChange(false);
              }}
            >
              Remove from trip
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selected || selected === order.tripId}>
            Assign to trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel ─────────────────────────────────────────────────────────────────
export function CancelOrderDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const cancel = useAppStore((s) => s.cancelOrder);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {order.id}?</DialogTitle>
          <DialogDescription>This releases reserved stock{order.tripId ? ` and removes the drop from ${order.tripId}` : ""}. The customer should be informed via their usual channel.</DialogDescription>
        </DialogHeader>
        <Field label="Reason for cancellation" htmlFor="cancel-reason" error={error} required>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer postponed to Monday" aria-invalid={!!error} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (reason.trim().length < 5) return setError("Please give a short reason (at least 5 characters).");
              cancel(order.id, reason.trim());
              toast.success(`${order.id} cancelled`);
              onOpenChange(false);
            }}
          >
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit ───────────────────────────────────────────────────────────────────
const editSchema = z.object({
  deliveryDate: z.string().min(10, "Pick a delivery date"),
  discount: z.number().min(0, "Discount cannot be negative"),
  deliveryFee: z.number().min(0, "Delivery fee cannot be negative"),
  notes: z.string().optional(),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().positive("Must be more than 0"), unitPrice: z.number().positive("Must be more than 0") })).min(1),
});
type EditValues = z.infer<typeof editSchema>;

export function EditOrderDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const update = useAppStore((s) => s.updateOrder);
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: { deliveryDate: order.deliveryDate, discount: order.discount, deliveryFee: order.deliveryFee, notes: order.notes ?? "", items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })) },
  });
  const { fields } = useFieldArray({ control: form.control, name: "items" });
  const values = form.watch();
  const total = orderTotal({ items: values.items.map((i) => ({ ...i, quantity: i.quantity || 0, unitPrice: i.unitPrice || 0 })), discount: values.discount || 0, deliveryFee: values.deliveryFee || 0 });
  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {order.id}</DialogTitle>
          <DialogDescription>Adjust quantities, negotiated prices and delivery details. Changes are logged in the order history.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => {
            update(order.id, { deliveryDate: v.deliveryDate, discount: v.discount, deliveryFee: v.deliveryFee, notes: v.notes, items: v.items.map((i, idx) => ({ ...order.items[idx], ...i })) }, { label: "Order edited", note: `New total ${peso(orderTotal({ items: v.items, discount: v.discount, deliveryFee: v.deliveryFee }))}` });
            toast.success(`${order.id} updated`);
            onOpenChange(false);
          })}
        >
          <div className="grid gap-2">
            {fields.map((f, idx) => {
              const p = productById(f.productId);
              return (
                <div key={f.id} className="grid grid-cols-[1fr_96px_110px] items-end gap-2">
                  <div className="text-sm">
                    <div className="font-medium">{productLabel(p)}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </div>
                  <Field label={`Qty (${p.unit})`} htmlFor={`e-q-${idx}`} error={errors.items?.[idx]?.quantity?.message}>
                    <Input id={`e-q-${idx}`} type="number" {...form.register(`items.${idx}.quantity`, { valueAsNumber: true })} />
                  </Field>
                  <Field label="Unit price" htmlFor={`e-p-${idx}`} error={errors.items?.[idx]?.unitPrice?.message}>
                    <Input id={`e-p-${idx}`} type="number" {...form.register(`items.${idx}.unitPrice`, { valueAsNumber: true })} />
                  </Field>
                </div>
              );
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Delivery date" htmlFor="e-date" error={errors.deliveryDate?.message}>
              <Controller control={form.control} name="deliveryDate" render={({ field }) => <DatePicker id="e-date" value={field.value} onChange={field.onChange} />} />
            </Field>
            <Field label="Wholesale discount (₱)" htmlFor="e-disc" error={errors.discount?.message}>
              <Input id="e-disc" type="number" {...form.register("discount", { valueAsNumber: true })} />
            </Field>
            <Field label="Delivery fee (₱)" htmlFor="e-fee" error={errors.deliveryFee?.message}>
              <Input id="e-fee" type="number" {...form.register("deliveryFee", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label="Notes" htmlFor="e-notes">
            <Textarea id="e-notes" rows={2} {...form.register("notes")} />
          </Field>
          <DialogFooter className="items-center">
            <div className="mr-auto text-sm">
              New total <b className="tabular">{peso(total)}</b>
            </div>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
