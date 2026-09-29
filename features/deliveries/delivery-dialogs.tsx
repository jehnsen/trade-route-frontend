"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, Eraser, ImagePlus, PenLine } from "lucide-react";
import type { Delivery, DeliveryIssueType } from "@/types";
import { useAppStore } from "@/lib/store";
import { useInvoiceMap } from "@/hooks/use-data";
import { jobTotal } from "@/lib/logistics";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

const podSchema = z.object({
  receivedBy: z.string().trim().min(2, "Who received the cargo?"),
  receiptNo: z.string().optional(),
  signatureCaptured: z.boolean(),
  photoCount: z.number().min(0),
  damagedKg: z.number().min(0, "Cannot be negative").optional(),
  shortKg: z.number().min(0, "Cannot be negative").optional(),
  driverNotes: z.string().max(300).optional(),
  customerRemarks: z.string().max(300).optional(),
  cashCollected: z.number().min(0, "Cannot be negative").optional(),
});
type PodValues = z.infer<typeof podSchema>;

/** Signature pad placeholder: tap or drag to "sign". Stored only as captured / not captured. */
function SignaturePad({ captured, onChange }: { captured: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid gap-1.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn("relative flex h-24 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-sm transition-colors", captured ? "border-primary/50 bg-accent/40" : "hover:bg-muted/50")}
        aria-label={captured ? "Signature captured" : "Tap to capture recipient signature"}
      >
        {captured ? (
          <svg viewBox="0 0 150 50" className="h-14 w-48 text-slate-700" aria-hidden>
            <path d="M 8 30 Q 20 8 30 28 T 52 26 Q 60 12 72 30 T 96 24 Q 108 10 118 30 T 142 22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <PenLine className="size-4" /> Tap to capture signature
          </span>
        )}
      </button>
      {captured && (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange(false)}>
          <Eraser /> Clear signature
        </Button>
      )}
    </div>
  );
}

/** Mark delivered with proof of delivery, or add photos/remarks to an existing POD. */
export function PodDialog({ delivery, open, onOpenChange, mode = "deliver" }: { delivery: Delivery; open: boolean; onOpenChange: (v: boolean) => void; mode?: "deliver" | "upload" }) {
  const job = useAppStore((s) => s.jobs.find((j) => j.id === delivery.jobId));
  const paid = useAppStore((s) => s.payments.filter((p) => p.jobId === delivery.jobId).reduce((a, p) => a + p.amount, 0));
  const invoice = useInvoiceMap().get(delivery.jobId);
  const markDelivered = useAppStore((s) => s.markDelivered);
  const updatePod = useAppStore((s) => s.updatePod);
  const due = job ? (invoice ? invoice.balance : Math.max(0, jobTotal(job) - paid)) : 0;
  const cod = job?.paymentTerms === "COD";
  const form = useForm<PodValues>({
    resolver: zodResolver(podSchema),
    values: {
      receivedBy: delivery.pod?.receivedBy ?? job?.consignee.name ?? "",
      receiptNo: delivery.pod?.receiptNo ?? "",
      signatureCaptured: delivery.pod?.signatureCaptured ?? false,
      photoCount: delivery.pod?.photoCount ?? 0,
      damagedKg: delivery.pod?.damagedKg ?? 0,
      shortKg: delivery.pod?.shortKg ?? 0,
      driverNotes: delivery.pod?.driverNotes ?? "",
      customerRemarks: delivery.pod?.customerRemarks ?? "",
      cashCollected: cod ? due : 0,
    },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const v = watch();
  const e = formState.errors;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const submit = handleSubmit((vals) => {
    if (mode === "deliver" && !vals.signatureCaptured && vals.photoCount === 0) {
      form.setError("signatureCaptured", { message: "Capture a signature or at least one photo as proof" });
      return;
    }
    const pod = {
      receivedBy: vals.receivedBy,
      receiptNo: vals.receiptNo || undefined,
      signatureCaptured: vals.signatureCaptured,
      photoCount: vals.photoCount,
      damagedKg: vals.damagedKg || undefined,
      shortKg: vals.shortKg || undefined,
      driverNotes: vals.driverNotes || undefined,
      customerRemarks: vals.customerRemarks || undefined,
    };
    if (mode === "upload") {
      updatePod(delivery.id, pod);
      toast.success("POD updated", { description: `${vals.photoCount} photo(s) on file for ${delivery.id}.` });
    } else {
      markDelivered(delivery.id, pod, vals.cashCollected);
      toast.success(`${delivery.jobId} delivered`, { description: vals.cashCollected ? `${peso(vals.cashCollected)} COD collected and posted to receivables.` : "POD saved; invoice issued to the customer." });
    }
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "upload" ? "Upload proof of delivery" : "Mark delivered — proof of delivery"}</DialogTitle>
          <DialogDescription>
            {delivery.jobId} · {job?.dropoff.name} · {job?.cargoDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Received by" htmlFor="pod-rec" error={e.receivedBy?.message} required>
              <Input id="pod-rec" {...register("receivedBy")} aria-invalid={!!e.receivedBy} />
            </Field>
            <Field label="Delivery receipt (DR) no." htmlFor="pod-dr" hint="Leave blank to auto-number">
              <Input id="pod-dr" placeholder="DR-00xxxx" {...register("receiptNo")} />
            </Field>
          </div>
          <Field label="Recipient signature" error={e.signatureCaptured?.message}>
            <Controller control={control} name="signatureCaptured" render={({ field }) => <SignaturePad captured={field.value} onChange={field.onChange} />} />
          </Field>
          <Field label="POD photos" hint="Demo: photos are counted, not uploaded">
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: v.photoCount }).map((_, i) => (
                <div key={i} className="flex size-14 items-center justify-center rounded-md bg-gradient-to-br from-slate-200 to-slate-100 text-slate-400" aria-label={`Photo ${i + 1}`}>
                  <Camera className="size-4" />
                </div>
              ))}
              <Button type="button" variant="outline" className="h-14" onClick={() => fileRef.current?.click()}>
                <ImagePlus /> Add photo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                onChange={(ev) => {
                  const n = ev.target.files?.length || 1;
                  setValue("photoCount", v.photoCount + n);
                  ev.target.value = "";
                }}
              />
              {v.photoCount > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("photoCount", 0)}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Damaged (kg)" htmlFor="pod-dmg" error={e.damagedKg?.message}>
              <Input id="pod-dmg" type="number" min={0} {...register("damagedKg", { valueAsNumber: true })} />
            </Field>
            <Field label="Short (kg)" htmlFor="pod-short" error={e.shortKg?.message}>
              <Input id="pod-short" type="number" min={0} {...register("shortKg", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label="Driver notes" htmlFor="pod-dn">
            <Textarea id="pod-dn" rows={2} {...register("driverNotes")} />
          </Field>
          <Field label="Consignee remarks" htmlFor="pod-cr">
            <Textarea id="pod-cr" rows={2} placeholder="e.g. Received complete, weighed on port scale" {...register("customerRemarks")} />
          </Field>
          {mode === "deliver" && cod && due > 0 && (
            <Field label={`COD collected (balance ${peso(due)})`} htmlFor="pod-cash" error={e.cashCollected?.message} hint="Posted as a COD payment on the freight invoice">
              <Input id="pod-cash" type="number" min={0} {...register("cashCollected", { valueAsNumber: true })} />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "deliver" ? "success" : "default"}>
              <CheckCircle2 /> {mode === "upload" ? "Save POD" : "Confirm delivered"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ISSUE_TYPES: DeliveryIssueType[] = ["Late Arrival", "Damaged Cargo", "Short Quantity", "Consignee Unavailable", "Rejected by Consignee", "Road / Access Problem", "Vehicle Problem", "Other"];

export function ReportIssueDialog({ delivery, open, onOpenChange }: { delivery: Delivery; open: boolean; onOpenChange: (v: boolean) => void }) {
  const report = useAppStore((s) => s.reportDeliveryIssue);
  const [type, setType] = React.useState<DeliveryIssueType>("Late Arrival");
  const [note, setNote] = React.useState("");
  const [failed, setFailed] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const canFail = delivery.status !== "Delivered";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report delivery issue</DialogTitle>
          <DialogDescription>{delivery.jobId} — dispatch and sales are notified immediately.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Issue" htmlFor="iss-type" required>
            <Select value={type} onValueChange={(x) => setType(x as DeliveryIssueType)}>
              <SelectTrigger id="iss-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="What happened?" htmlFor="iss-note" error={error} required>
            <Textarea id="iss-note" rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="e.g. Stall closed; consignee not answering calls" aria-invalid={!!error} />
          </Field>
          {canFail && (
            <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <Checkbox checked={failed} onCheckedChange={(x) => setFailed(!!x)} className="mt-0.5" />
              <span>
                <span className="font-medium">Delivery failed — cargo returns to Lucena</span>
                <span className="block text-xs text-muted-foreground">The job goes back to dispatch for rescheduling when the trip closes.</span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={failed ? "destructive" : "default"}
            onClick={() => {
              if (note.trim().length < 5) return setError("Describe the issue (at least 5 characters)");
              report(delivery.id, { type, note: note.trim() }, failed);
              toast.warning(failed ? `${delivery.jobId} marked failed` : `Issue logged on ${delivery.jobId}`, { description: type });
              setNote("");
              setFailed(false);
              onOpenChange(false);
            }}
          >
            <AlertTriangle /> {failed ? "Mark failed" : "Report issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
