"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import type { Order, SalesPaymentMethod } from "@/types";
import { useAppStore } from "@/lib/store";
import { useSalesInvoiceMap } from "@/hooks/use-data";
import { productById, productLabel } from "@/data/products";
import { invoiceIdForOrder, orderBilledAmount, orderTotal } from "@/lib/calc";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Input, Textarea } from "@/components/ui/primitives";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

export const SALES_PAYMENT_METHODS: SalesPaymentMethod[] = ["Cash", "GCash", "Maya", "Bank Transfer", "Check", "COD", "Credit Settlement"];

// ─── Record payment ─────────────────────────────────────────────────────────
const paymentSchema = z.object({
  amount: z.number({ message: "Enter an amount" }).positive("Amount must be more than ₱0"),
  method: z.enum(["Cash", "GCash", "Maya", "Bank Transfer", "Check", "COD", "Credit Settlement"]),
  reference: z.string().min(3, "Add a reference (masked is fine, e.g. •••• 4821)"),
  notes: z.string().optional(),
});
type PaymentValues = z.infer<typeof paymentSchema>;

export function RecordPaymentDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (v: boolean) => void }) {
  const invoice = useSalesInvoiceMap().get(order.id);
  const record = useAppStore((s) => s.recordSalesPayment);
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
                      {SALES_PAYMENT_METHODS.map((m) => (
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
          <DialogDescription>This releases reserved stock. The customer should be informed via their usual channel.</DialogDescription>
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
