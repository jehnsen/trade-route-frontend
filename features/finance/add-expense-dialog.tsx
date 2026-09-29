"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { ExpenseCategory } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { truckById } from "@/data/fleet";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ["Diesel", "Toll", "Driver Allowance", "Helper Allowance", "Meals", "Parking", "Loading Fee", "Unloading Fee", "Port Fee", "Repair", "Other"];

const schema = z.object({
  category: z.enum(EXPENSE_CATEGORIES as [ExpenseCategory, ...ExpenseCategory[]]),
  amount: z.number({ message: "Enter the amount" }).positive("Must be more than ₱0").max(200000, "That looks too high — check the amount"),
  description: z.string().trim().min(3, "Describe the expense"),
  paidTo: z.string().trim().min(2, "Who was paid?"),
  date: z.string().min(10),
  tripId: z.string().optional(),
  receiptRef: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** Record a trip expense. Truck and driver are taken from the trip when one is chosen. */
export function AddExpenseDialog({ open, onOpenChange, tripId }: { open: boolean; onOpenChange: (v: boolean) => void; tripId?: string }) {
  const add = useAppStore((s) => s.addExpense);
  const trips = useAppStore((s) => s.trips);
  const tripOptions = trips.filter((t) => t.date >= "2026-09-18" && t.status !== "Cancelled").sort((a, b) => b.departure.localeCompare(a.departure));
  const form = useForm<Values>({ resolver: zodResolver(schema), values: { category: "Toll", amount: 0, description: "", paidTo: "", date: TODAY, tripId: tripId ?? "", receiptRef: "" } });
  const e = form.formState.errors;
  const category = form.watch("category");
  const submit = form.handleSubmit((v) => {
    const trip = v.tripId ? trips.find((t) => t.id === v.tripId) : undefined;
    add({ date: v.date, category: v.category, amount: v.amount, description: v.description, paidTo: v.paidTo, tripId: trip?.id, truckId: trip?.truckId, driverId: trip?.driverId, receiptRef: v.receiptRef || undefined });
    toast.success(`${v.category} expense of ${peso(v.amount)} recorded`, { description: trip ? `Charged to ${trip.id}` : undefined });
    form.reset();
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record trip expense</DialogTitle>
          <DialogDescription>{tripId ? `Charged to ${tripId}` : "Link it to a trip so it counts in that trip's contribution."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="x-cat" required hint={category === "Diesel" ? "Tip: use Log fuel so litres and odometer are tracked" : undefined}>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="x-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Amount (₱)" htmlFor="x-amt" error={e.amount?.message} required>
            <Input id="x-amt" type="number" inputMode="decimal" aria-invalid={!!e.amount} {...form.register("amount", { valueAsNumber: true })} />
          </Field>
          <Field label="Description" htmlFor="x-desc" error={e.description?.message} required className="sm:col-span-2">
            <Input id="x-desc" placeholder="e.g. SLEX / Skyway — Class 3 RFID" aria-invalid={!!e.description} {...form.register("description")} />
          </Field>
          <Field label="Paid to" htmlFor="x-to" error={e.paidTo?.message} required>
            <Input id="x-to" placeholder="e.g. Kargador, toll RFID reload" aria-invalid={!!e.paidTo} {...form.register("paidTo")} />
          </Field>
          <Field label="Receipt / CV no." htmlFor="x-ref">
            <Input id="x-ref" placeholder="Optional" {...form.register("receiptRef")} />
          </Field>
          <Field label="Date" htmlFor="x-date">
            <Controller control={form.control} name="date" render={({ field }) => <DatePicker id="x-date" value={field.value} onChange={field.onChange} />} />
          </Field>
          {!tripId && (
            <Field label="Trip" htmlFor="x-trip">
              <Controller
                control={form.control}
                name="tripId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="x-trip">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not trip-related</SelectItem>
                      {tripOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.id} · {truckById(t.truckId).code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus /> Record expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
