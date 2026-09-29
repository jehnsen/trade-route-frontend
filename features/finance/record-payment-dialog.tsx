"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import type { LogisticsJob, PaymentMethod } from "@/types";
import { useAppStore } from "@/lib/store";
import { useInvoiceMap } from "@/hooks/use-data";
import { invoiceIdForJob, jobTotal } from "@/lib/logistics";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Input, Textarea } from "@/components/ui/primitives";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

export const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "GCash", "Maya", "Check", "COD"];

const schema = z.object({
  amount: z.number({ message: "Enter an amount" }).positive("Amount must be more than ₱0"),
  method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
  reference: z.string().trim().min(3, "Add a reference (masked is fine, e.g. •••• 4821)"),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** Record a freight payment against a job's invoice (partial payments allowed). */
export function RecordPaymentDialog({ job, open, onOpenChange }: { job: LogisticsJob; open: boolean; onOpenChange: (v: boolean) => void }) {
  const invoice = useInvoiceMap().get(job.id);
  const paidAdvance = useAppStore((s) => s.payments.filter((p) => p.jobId === job.id).reduce((a, p) => a + p.amount, 0));
  const record = useAppStore((s) => s.recordPayment);
  const balance = invoice ? invoice.balance : Math.max(0, jobTotal(job) - paidAdvance);
  const invoiceId = invoiceIdForJob(job.id);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { amount: balance, method: job.paymentTerms === "COD" ? "Cash" : "Bank Transfer", reference: "", notes: "" },
  });
  const { register, handleSubmit, formState, control, watch } = form;
  const amount = watch("amount");
  const submit = handleSubmit((v) => {
    if (v.amount > balance + 0.5) {
      form.setError("amount", { message: `Cannot exceed the ${peso(balance)} balance` });
      return;
    }
    const receipt = record({ invoiceId, jobId: job.id, customerId: job.customerId, amount: v.amount, method: v.method, reference: v.reference, notes: v.notes || undefined });
    toast.success(`Payment of ${peso(v.amount)} recorded`, { description: `${receipt} · applied to ${invoiceId}` });
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record freight payment</DialogTitle>
          <DialogDescription>
            {invoiceId} · {job.id} · Balance <b className="text-foreground">{peso(balance)}</b>
            {!invoice && " · invoice is issued on delivery; this is recorded as an advance"}
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
            <Button type="submit" disabled={balance <= 0}>
              <CheckCircle2 /> Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
