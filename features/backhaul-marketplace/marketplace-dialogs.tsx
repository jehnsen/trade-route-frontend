"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Radio, Send, Truck, XCircle } from "lucide-react";
import type { AreaId, BackhaulBookingRequest, CargoCategory } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useListingViews } from "@/hooks/use-data";
import { AREAS, areaName, PLACES } from "@/data/areas";
import { CARGO_CATEGORIES, CARGO_TYPES } from "@/data/cargo";
import { checkRequest, DEFAULT_LISTING_TERMS, legRouteLine, marketplaceQuote, requestStatus, type ListingView } from "@/lib/backhaul-marketplace";
import { etaAt, isQuezon, placeLabel, shortArea } from "@/lib/load-board";
import { deliveryIdForJob, jobTotal } from "@/lib/logistics";
import { fmtDay, fmtTime, fmtTimeWindow, kg, peso, relativeDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { Combobox, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { CapacityBar, DemoRateNote, LineItem } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { MatchChecks } from "@/features/load-board/board-parts";
import { CargoChecklist } from "@/features/load-board/board-forms";
import { PAYMENT_TERMS } from "@/features/load-board/board-matching";

const legLabel = (v: ListingView) => `${v.truckLabel} · ${relativeDay(v.trip.date)} (${v.trip.id})`;
const rateLabel = (rate: number) => `${peso(rate, true)}/kg`;

// ─── Publish / edit a listing ───────────────────────────────────────────────
const listingSchema = z.object({
  tripId: z.string().min(1, "Choose a return leg"),
  ratePerKg: z.number({ message: "Enter a rate" }).min(1, "At least ₱1/kg").max(30, "Check the rate — that is above outbound freight"),
  minimumCharge: z.number({ message: "Enter a minimum" }).min(0, "Cannot be negative"),
  acceptedCargo: z.array(z.enum(CARGO_CATEGORIES as [CargoCategory, ...CargoCategory[]])),
  restrictions: z.string().max(160).optional(),
});
type ListingValues = z.infer<typeof listingSchema>;

export function PublishListingDialog({ tripId, onClose }: { tripId?: string; onClose: () => void }) {
  const views = useListingViews();
  const publish = useAppStore((s) => s.publishBackhaulListing);
  const options = [...views.values()].filter((v) => v.status !== "Departed" && (!v.listing || v.trip.id === tripId));
  const preset = tripId ? views.get(tripId) : undefined;
  const terms = preset?.listing ?? DEFAULT_LISTING_TERMS;
  const form = useForm<ListingValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: { tripId: tripId ?? options.find((v) => !v.listing)?.trip.id ?? "", ratePerKg: terms.ratePerKg, minimumCharge: terms.minimumCharge, acceptedCargo: terms.acceptedCargo, restrictions: terms.restrictions ?? "" },
  });
  const { register, control, handleSubmit, watch, formState } = form;
  const errors = formState.errors;
  const v = views.get(watch("tripId"));
  const rate = watch("ratePerKg");
  const minimum = watch("minimumCharge");
  const editing = !!preset?.listing;

  const submit = handleSubmit((x) => {
    const id = publish({ ...x, restrictions: x.restrictions?.trim() || undefined });
    if (!id) {
      toast.error("That return leg no longer takes cargo.");
      return;
    }
    const leg = views.get(x.tripId)!;
    toast.success(editing && preset?.status === "Published" ? `${id} terms updated` : `${leg.truckLabel}'s return leg is listed (${id})`, { description: `${kg(leg.openKg)} open · ${rateLabel(x.ratePerKg)}` });
    onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Listing terms · ${preset!.listing!.id}` : "List a return leg"}</DialogTitle>
          <DialogDescription>Shippers see the route, pickup times, open space and your rate, and get an instant quote. Open space always comes from the trip&apos;s loads.</DialogDescription>
        </DialogHeader>
        <form id="publish-listing" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Return leg" htmlFor="pl-trip" error={errors.tripId?.message} required className="sm:col-span-2">
            <Controller
              control={control}
              name="tripId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!tripId}>
                  <SelectTrigger id="pl-trip" aria-invalid={!!errors.tripId}>
                    <SelectValue placeholder="Choose a trip" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.trip.id} value={o.trip.id}>
                        {legLabel(o)} — {kg(o.openKg)} open
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {v && (
            <div className="grid gap-2 rounded-lg border p-3 text-xs sm:col-span-2">
              <div className="font-medium">{legRouteLine(v)}</div>
              <div className="text-muted-foreground">
                Pickups {v.pickupAreas.map((a) => `${shortArea(a)} ~${fmtTime(etaAt(v.leg, a))}`).join(" · ")} · Lucena ~{fmtTime(v.leg.arrivalAt)}
              </div>
              <CapacityBar used={v.usedKg} capacity={v.totalKg} label="Return load now" size="sm" />
            </div>
          )}
          <Field label="Rate (₱ per kg)" htmlFor="pl-rate" error={errors.ratePerKg?.message} hint="Gross weight incl. packaging" required>
            <Input id="pl-rate" type="number" step={0.25} min={0} {...register("ratePerKg", { valueAsNumber: true })} aria-invalid={!!errors.ratePerKg} />
          </Field>
          <Field label="Minimum charge (₱)" htmlFor="pl-min" error={errors.minimumCharge?.message} hint="Per shipment" required>
            <Input id="pl-min" type="number" step={50} min={0} {...register("minimumCharge", { valueAsNumber: true })} aria-invalid={!!errors.minimumCharge} />
          </Field>
          <div className="sm:col-span-2">
            <Controller control={control} name="acceptedCargo" render={({ field }) => <CargoChecklist idPrefix="pl-cargo" value={field.value} onChange={field.onChange} />} />
          </div>
          <Field label="Restrictions shown to shippers" htmlFor="pl-restr" error={errors.restrictions?.message} className="sm:col-span-2">
            <Textarea id="pl-restr" rows={2} {...register("restrictions")} />
          </Field>
          {Number.isFinite(rate) && Number.isFinite(minimum) && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs sm:col-span-2">
              Instant quote examples: 500 kg → <b className="tabular">{peso(marketplaceQuote({ ratePerKg: rate, minimumCharge: minimum }, 500))}</b> · 1,000 kg → <b className="tabular">{peso(marketplaceQuote({ ratePerKg: rate, minimumCharge: minimum }, 1000))}</b> · 2,000 kg → <b className="tabular">{peso(marketplaceQuote({ ratePerKg: rate, minimumCharge: minimum }, 2000))}</b>
            </p>
          )}
          <DemoRateNote className="sm:col-span-2" />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="publish-listing" disabled={formState.isSubmitting || options.length === 0}>
            <Radio /> {editing ? (preset?.listing?.status === "Published" ? "Save terms" : "Save & publish") : "Publish listing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Review a shipper request (dispatch) ────────────────────────────────────
const confirmSchema = z.object({
  billTo: z.string().min(1, "Choose who pays the freight"),
  freightCharge: z.number({ message: "Enter the freight" }).positive("Must be more than 0"),
  paymentTerms: z.enum(PAYMENT_TERMS),
});
type ConfirmValues = z.infer<typeof confirmSchema>;

export function ReviewRequestDialog({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const req = useAppStore((s) => s.backhaulRequests.find((r) => r.id === requestId));
  const views = useListingViews();
  const v = req ? [...views.values()].find((x) => x.listing?.id === req.listingId) : undefined;
  if (!req) return null;
  return <ReviewBody req={req} v={v} onClose={onClose} />;
}

function ReviewBody({ req, v, onClose }: { req: BackhaulBookingRequest; v?: ListingView; onClose: () => void }) {
  const router = useRouter();
  const customers = useAppStore((s) => s.customers);
  const job = useAppStore((s) => (req.jobId ? s.jobs.find((j) => j.id === req.jobId) : undefined));
  const hasDelivery = useAppStore((s) => !!req.jobId && s.deliveries.some((d) => d.id === deliveryIdForJob(req.jobId!)));
  const confirm = useAppStore((s) => s.confirmBackhaulRequest);
  const decline = useAppStore((s) => s.declineBackhaulRequest);
  const customerMap = useCustomerMap();
  const status = requestStatus(req, job, v?.status);
  const pending = status === "Requested";
  const fit = v ? checkRequest(req, v, { onTrip: !pending }) : undefined;
  const spaceFails = fit?.checks.some((c) => c.rule === "capacity" && c.result === "fail");
  const canConfirm = pending && !!v?.bookable && !spaceFails;
  const known = req.customerId ? customerMap.get(req.customerId) : undefined;
  const [declining, setDeclining] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string>();

  const form = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { billTo: req.customerId ?? "new", freightCharge: req.quotedFreight, paymentTerms: known?.paymentTerms ?? "COD" },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const customerOptions = [{ value: "new", label: "+ New customer from this request", hint: `${req.shipper.businessName} · ${req.shipper.phone}` }, ...customers.map((c) => ({ value: c.id, label: c.name, hint: `${c.id} · ${c.type}` }))];

  const submit = handleSubmit((x) => {
    const res = confirm({ requestId: req.id, customerId: x.billTo === "new" ? undefined : x.billTo, freightCharge: x.freightCharge, paymentTerms: x.paymentTerms });
    if (!res) {
      toast.error(`Could not confirm ${req.id}`, { description: "The return leg is closed or no longer has the space." });
      return;
    }
    toast.success(`${req.id} confirmed as ${res.jobId}`, { description: `On ${v!.truckLabel}'s return leg (${v!.trip.id}). Call ${req.shipper.contactName} to confirm the pickup time.`, action: { label: "View job", onClick: () => router.push(`/jobs/${res.jobId}`) } });
    onClose();
  });

  const submitDecline = () => {
    if (reason.trim().length < 3) {
      setReasonError("Tell the shipper why");
      return;
    }
    decline(req.id, reason.trim());
    toast(`${req.id} declined`, { description: `Let ${req.shipper.contactName} know: ${reason.trim()}` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {req.id} · {req.shipper.businessName} <StatusBadge status={status} />
          </DialogTitle>
          <DialogDescription>
            {req.cargoDescription} · {kg(req.weightKg)} ({req.quantity} {req.unit}) · {placeLabel(req.pickup)} → {placeLabel(req.dropoff)} · ready {relativeDay(req.readyAt.slice(0, 10))} {fmtTime(req.readyAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-1 rounded-lg border p-3 text-xs">
            <div className="font-medium">Shipper</div>
            <div>
              {req.shipper.contactName} ·{" "}
              <a href={`tel:${req.shipper.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                {req.shipper.phone}
              </a>
            </div>
            {known ? (
              <Link href={`/customers/${known.id}`} className="text-primary hover:underline">
                Existing customer · {known.id}
              </Link>
            ) : (
              <span className="text-muted-foreground">New to us — first booking</span>
            )}
            {req.notes && <p className="mt-1 text-muted-foreground">“{req.notes}”</p>}
            <LineItem label="Instant quote" value={peso(req.quotedFreight)} className="mt-1 border-t pt-1.5" strong />
          </div>
          {v ? (
            <div className="grid content-start gap-2 rounded-lg border p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/trips/${v.trip.id}`} className="font-medium hover:text-primary hover:underline">
                  {legLabel(v)}
                </Link>
                <StatusBadge status={v.status} />
              </div>
              <div className="text-muted-foreground">{legRouteLine(v)}</div>
              <CapacityBar used={v.usedKg + (pending ? req.weightKg : 0)} capacity={v.totalKg} label={pending ? "Return load if confirmed" : "Return load"} size="sm" />
            </div>
          ) : (
            <div className="rounded-lg border p-3 text-xs text-muted-foreground">The listed trip is no longer on the schedule.</div>
          )}
        </div>

        {fit && (
          <div className="grid gap-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2 text-xs font-medium">
              Fit on this leg <StatusBadge status={fit.label} />
            </div>
            <MatchChecks checks={fit.checks} />
            {v?.listing?.restrictions && <p className="text-xs text-muted-foreground">Listing note: {v.listing.restrictions}</p>}
          </div>
        )}

        {status === "Confirmed" && job && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-success-soft px-3 py-2 text-xs">
            <CheckCircle2 className="size-3.5" />
            <span>
              Booked as{" "}
              <Link href={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                {job.id}
              </Link>{" "}
              · {job.status} · {peso(jobTotal(job))} freight
            </span>
            {hasDelivery && (
              <Link href={`/print/delivery-receipt/${deliveryIdForJob(job.id)}`} target="_blank" className="font-medium text-primary hover:underline">
                Waybill / DR
              </Link>
            )}
          </div>
        )}
        {status === "Declined" && (
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs">
            <XCircle className="mt-px size-3.5 shrink-0" /> Declined by {req.respondedBy}: {req.declineReason}
          </div>
        )}
        {(status === "Expired" || status === "Cancelled") && (
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs">
            <Info className="mt-px size-3.5 shrink-0" /> {status === "Expired" ? "The return leg closed before anyone confirmed this request." : `The job was cancelled${job?.cancelReason ? `: ${job.cancelReason}` : "."}`}
          </div>
        )}

        {pending && !declining && (
          <>
            {!canConfirm && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-danger" role="alert">
                <AlertTriangle className="size-3.5" /> {spaceFails ? "Not enough return space left — decline or offer another leg." : "This return leg no longer takes cargo."}
              </div>
            )}
            <form id="confirm-request" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Field label="Bill freight to" htmlFor="rq-bill" error={errors.billTo?.message} required className="sm:col-span-2">
                <Combobox id="rq-bill" options={customerOptions} value={watch("billTo")} onChange={(x) => setValue("billTo", x, { shouldValidate: true })} searchPlaceholder="Search customers…" />
              </Field>
              <Field label="Agreed freight (₱)" htmlFor="rq-freight" error={errors.freightCharge?.message} hint={`Instant quote ${peso(req.quotedFreight)}`} required>
                <Input id="rq-freight" type="number" min={0} {...register("freightCharge", { valueAsNumber: true })} aria-invalid={!!errors.freightCharge} />
              </Field>
              <Field label="Payment terms" htmlFor="rq-terms">
                <Controller
                  control={control}
                  name="paymentTerms"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="rq-terms">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <p className="text-xs text-muted-foreground sm:col-span-2">Confirming creates a Logistics Job and a third-party Load on {v?.trip.id ?? "the trip"}&apos;s return leg. It shows on Backhaul, gets its own delivery and DR / waybill, and is invoiced on delivery.</p>
            </form>
          </>
        )}
        {pending && declining && (
          <Field label="Reason for declining" htmlFor="rq-reason" error={reasonError} required>
            <Textarea id="rq-reason" rows={2} value={reason} onChange={(e) => {
                setReason(e.target.value);
                setReasonError(undefined);
              }} placeholder="e.g. Cement isn't carried — the van also carries seafood" aria-invalid={!!reasonError} autoFocus />
          </Field>
        )}

        <DialogFooter>
          {!pending ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : declining ? (
            <>
              <Button type="button" variant="outline" onClick={() => setDeclining(false)}>
                Back
              </Button>
              <Button type="button" variant="destructive" onClick={submitDecline}>
                <XCircle /> Decline request
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setDeclining(true)}>
                <XCircle /> Decline
              </Button>
              <Button type="submit" form="confirm-request" disabled={!canConfirm || formState.isSubmitting}>
                <Truck /> Confirm on {v?.truckLabel ?? "trip"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Request space (shipper preview) ────────────────────────────────────────
const QUEZON_AREAS = AREAS.filter((a) => isQuezon(a.id));
const timeRe = /^\d{2}:\d{2}$/;
const requestSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name"),
  contactName: z.string().trim().min(2, "Who should we call?"),
  phone: z.string().trim().regex(/^(09|\+639)\d{2}\s?\d{3}\s?\d{4}$/, "Use a PH mobile number, e.g. 0917 123 4567"),
  pickup: z.string().min(1, "Choose where we pick up"),
  pickupAddress: z.string().trim().max(120).optional(),
  dropoffArea: z.string().min(1, "Choose the drop-off town"),
  dropoffAddress: z.string().trim().min(5, "Enter the drop-off address"),
  cargoKey: z.string().min(1, "Choose the cargo"),
  quantity: z.number({ message: "Enter a quantity" }).int("Whole units only").positive("Must be more than 0"),
  weightKg: z.number({ message: "Enter the gross weight" }).positive("Must be more than 0"),
  readyTime: z.string().regex(timeRe, "Enter a time"),
  notes: z.string().max(240).optional(),
});
type RequestValues = z.infer<typeof requestSchema>;

/** Pickup options for a leg: our known pickup points on the route, plus "any address in <town>". */
function pickupOptions(v: ListingView) {
  return v.pickupAreas.flatMap((a) => [...PLACES.filter((p) => p.areaId === a).map((p) => ({ value: `place:${p.name}`, label: p.name, area: a })), { value: `area:${a}`, label: `Other address in ${areaName(a)}`, area: a }]);
}

export function RequestSpaceDialog({ tripId, onClose, onSubmitted }: { tripId: string; onClose: () => void; onSubmitted: (id: string) => void }) {
  const v = useListingViews().get(tripId);
  const request = useAppStore((s) => s.requestBackhaulSpace);
  const pickups = v ? pickupOptions(v) : [];
  const form = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { businessName: "", contactName: "", phone: "", pickup: pickups[0]?.value ?? "", pickupAddress: "", dropoffArea: "lucena", dropoffAddress: "", cargoKey: "red-onion", quantity: 40, weightKg: 1000, readyTime: v ? `${etaAt(v.leg, v.pickupAreas[0] ?? "lucena").slice(11, 13)}:00` : "12:00", notes: "" },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  if (!v?.listing) return null;
  const listing = v.listing;

  const cargo = CARGO_TYPES.find((c) => c.key === watch("cargoKey"));
  const weight = watch("weightKg");
  const pickupKey = watch("pickup");
  const toPickup = (key: string, detail?: string) => {
    const opt = pickups.find((p) => p.value === key);
    const known = key.startsWith("place:") ? PLACES.find((p) => `place:${p.name}` === key) : undefined;
    if (known) return { name: known.name, areaId: known.areaId, address: known.address };
    const area = (opt?.area ?? "lucena") as AreaId;
    return { name: detail?.trim() || areaName(area), areaId: area, address: detail?.trim() ? `${detail.trim()}, ${areaName(area)}` : undefined };
  };
  const draft = {
    pickup: toPickup(pickupKey, watch("pickupAddress")),
    dropoff: { name: watch("businessName") || areaName(watch("dropoffArea") as AreaId), areaId: watch("dropoffArea") as AreaId },
    weightKg: Number.isFinite(weight) ? weight : 0,
    cargoCategory: cargo?.category ?? "General Cargo",
    readyAt: `${v.trip.date}T${timeRe.test(watch("readyTime")) ? watch("readyTime") : "00:00"}`,
  };
  const fit = draft.weightKg > 0 ? checkRequest(draft, v, { shipper: true }) : undefined;
  const blocked = fit?.checks.some((c) => c.result === "fail" && (c.rule === "capacity" || c.rule === "cargo"));
  const quote = draft.weightKg > 0 ? marketplaceQuote(listing, draft.weightKg) : 0;

  const submit = handleSubmit((x) => {
    const c = CARGO_TYPES.find((t) => t.key === x.cargoKey)!;
    const dropArea = x.dropoffArea as AreaId;
    const id = request({
      listingId: listing.id,
      shipper: { businessName: x.businessName.trim(), contactName: x.contactName.trim(), phone: x.phone.trim() },
      pickup: toPickup(x.pickup, x.pickupAddress),
      dropoff: { name: x.businessName.trim(), areaId: dropArea, address: `${x.dropoffAddress.trim()}, ${areaName(dropArea)}` },
      cargoDescription: c.label,
      cargoCategory: c.category,
      quantity: x.quantity,
      unit: c.unit,
      weightKg: x.weightKg,
      readyAt: `${v.trip.date}T${x.readyTime}`,
      notes: x.notes?.trim() || undefined,
    });
    if (!id) {
      toast.error("This return leg can't take that request anymore", { description: "It may have filled up or closed. Try another trip." });
      return;
    }
    toast.success(`Request ${id} sent`, { description: `Instant quote ${peso(quote)}. Dispatch confirms by phone before pickup.` });
    onSubmitted(id);
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request space · return trip to Lucena, {fmtDay(v.trip.date)}</DialogTitle>
          <DialogDescription>
            {legRouteLine(v)} · {kg(v.openKg)} open · {rateLabel(listing.ratePerKg)}, minimum {peso(listing.minimumCharge)}
          </DialogDescription>
        </DialogHeader>
        <form id="request-space" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Business name" htmlFor="rs-biz" error={errors.businessName?.message} required>
            <Input id="rs-biz" autoComplete="organization" {...register("businessName")} aria-invalid={!!errors.businessName} />
          </Field>
          <Field label="Contact person" htmlFor="rs-contact" error={errors.contactName?.message} required>
            <Input id="rs-contact" autoComplete="name" {...register("contactName")} aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Mobile number" htmlFor="rs-phone" error={errors.phone?.message} required>
            <Input id="rs-phone" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxxx" {...register("phone")} aria-invalid={!!errors.phone} />
          </Field>
          <Field label="Cargo ready by" htmlFor="rs-ready" error={errors.readyTime?.message} hint={`On ${fmtDay(v.trip.date)}`} required>
            <Input id="rs-ready" type="time" {...register("readyTime")} aria-invalid={!!errors.readyTime} />
          </Field>
          <Field label="Pickup point" htmlFor="rs-pickup" error={errors.pickup?.message} required>
            <Controller
              control={control}
              name="pickup"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rs-pickup">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pickups.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} · {fmtTimeWindow(etaAt(v.leg, p.area))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={pickupKey.startsWith("area:") ? "Pickup address" : "Stall / bodega no. (optional)"} htmlFor="rs-paddr" error={errors.pickupAddress?.message}>
            <Input id="rs-paddr" {...register("pickupAddress")} />
          </Field>
          <Field label="Drop-off town" htmlFor="rs-drop" error={errors.dropoffArea?.message} required>
            <Controller
              control={control}
              name="dropoffArea"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="rs-drop">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUEZON_AREAS.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Drop-off address" htmlFor="rs-daddr" error={errors.dropoffAddress?.message} required>
            <Input id="rs-daddr" placeholder="Street, barangay" {...register("dropoffAddress")} aria-invalid={!!errors.dropoffAddress} />
          </Field>
          <Field label="Cargo" htmlFor="rs-cargo" error={errors.cargoKey?.message} required className="sm:col-span-2">
            <Controller
              control={control}
              name="cargoKey"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(k) => {
                    field.onChange(k);
                    const c = CARGO_TYPES.find((t) => t.key === k);
                    const q = form.getValues("quantity");
                    if (c && q > 0) setValue("weightKg", q * c.kgPerUnit, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger id="rs-cargo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARGO_TYPES.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label} · {c.category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label={`Quantity (${cargo?.unit ?? "units"})`} htmlFor="rs-qty" error={errors.quantity?.message} required>
            <Input
              id="rs-qty"
              type="number"
              min={1}
              {...register("quantity", {
                valueAsNumber: true,
                onChange: (e) => {
                  const q = Number(e.target.value);
                  if (cargo && q > 0) setValue("weightKg", q * cargo.kgPerUnit, { shouldValidate: true });
                },
              })}
              aria-invalid={!!errors.quantity}
            />
          </Field>
          <Field label="Gross weight (kg)" htmlFor="rs-kg" error={errors.weightKg?.message} hint={cargo ? `≈ ${cargo.kgPerUnit} kg per ${cargo.unit} incl. packaging` : undefined} required>
            <Input id="rs-kg" type="number" min={1} {...register("weightKg", { valueAsNumber: true })} aria-invalid={!!errors.weightKg} />
          </Field>
          <Field label="Notes for dispatch" htmlFor="rs-notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="rs-notes" rows={2} placeholder="Loading help, landmarks, receiving hours…" {...register("notes")} />
          </Field>
        </form>

        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[180px_1fr]">
          <div>
            <div className="text-xs text-muted-foreground">Instant quote</div>
            <div className="text-2xl font-semibold tracking-tight tabular">{quote ? peso(quote) : "—"}</div>
            <div className="text-xs text-muted-foreground">{draft.weightKg > 0 ? `${kg(draft.weightKg)} × ${rateLabel(listing.ratePerKg)}${quote === listing.minimumCharge ? " · minimum charge" : ""}` : "Enter the weight"}</div>
          </div>
          {fit ? <MatchChecks checks={fit.checks} /> : <p className="text-xs text-muted-foreground">Fit checks appear once you enter the cargo weight.</p>}
        </div>
        {listing.restrictions && <p className="text-xs text-muted-foreground">Note from the trucker: {listing.restrictions}</p>}
        <DemoRateNote />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="request-space" disabled={!!blocked || formState.isSubmitting}>
            <Send /> Request space <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
