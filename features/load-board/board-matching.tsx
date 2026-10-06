"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Bookmark, ChevronDown, ClipboardCopy, ClipboardList, Info, Truck } from "lucide-react";
import type { AvailableLoad, Customer, LogisticsJob, PaymentTerms } from "@/types";
import type { BookBoardLoadInput, BookingResult } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { useBoardMatches, useCapacityViews, useCustomerMap } from "@/hooks/use-data";
import { getTripMetricsMap } from "@/lib/logistics";
import { bookingFreight, bookingLeg, isGoodMatch, legOpen, loadShareMessage, placeLabel, routeLine, type BoardMatch, type CapacityView } from "@/lib/load-board";
import { fmtTime, kg, peso, relativeDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { Combobox, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { CapacityBar, DemoRateNote, EmptyState } from "@/components/shared/common";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LegBadge, StatusBadge } from "@/components/shared/status-badge";
import { copyShareMessage, MatchChecks } from "./board-parts";

const when = (dt: string) => `${relativeDay(dt.slice(0, 10))} ${fmtTime(dt)}`;

export type MatchTarget = { kind: "load"; id: string } | { kind: "capacity"; id: string };

/** Every open truck for a load (or every open load for a truck), best fit first, with the reasons. */
export function MatchesDialog({ target, onClose, onBook }: { target: MatchTarget | null; onClose: () => void; onBook: (loadId: string, capacityId?: string) => void }) {
  const { byLoad, byCapacity } = useBoardMatches();
  const views = useCapacityViews();
  const loads = useAppStore((s) => s.boardLoads);
  const [showPoor, setShowPoor] = React.useState(false);
  React.useEffect(() => setShowPoor(false), [target]);
  if (!target) return null;

  const list = (target.kind === "load" ? byLoad.get(target.id) : byCapacity.get(target.id)) ?? [];
  const good = list.filter(isGoodMatch);
  const poor = list.filter((m) => !isGoodMatch(m));
  const load = target.kind === "load" ? loads.find((l) => l.id === target.id) : undefined;
  const view = target.kind === "capacity" ? views.get(target.id) : undefined;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{target.kind === "load" ? `Trucks for ${target.id}` : `Loads for ${target.id}`}</DialogTitle>
          <DialogDescription>
            {load && (
              <>
                {load.cargoDescription} · <b>{kg(load.weightKg)}</b> · {placeLabel(load.pickup)} → {placeLabel(load.destination)} · pickup {when(load.pickupAt)}
              </>
            )}
            {view && (
              <>
                {view.truckLabel} · {routeLine(view)} · <b>{kg(view.availableKg)} free</b> · departs {when(view.departureAt)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <p className="flex items-start gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" />
          Rule-based check of route, direction, free capacity, timing, truck type and cargo restrictions. Confirm details with the other party before committing.
        </p>

        {list.length === 0 ? (
          <EmptyState title={target.kind === "load" ? "No open truck capacity to compare yet." : "No open loads to compare yet."} description="Post capacity or loads from the GCs and matches appear here." />
        ) : (
          <div className="grid gap-2">
            {good.length === 0 && <p className="text-sm text-muted-foreground">No strong or possible matches right now. See why below.</p>}
            {good.map((m) => (
              <MatchCard key={`${m.loadId}-${m.capacityId}`} match={m} side={target.kind} onBook={onBook} />
            ))}
            {poor.length > 0 && (
              <>
                <button type="button" onClick={() => setShowPoor((v) => !v)} className="flex cursor-pointer items-center gap-1 justify-self-start text-xs font-medium text-muted-foreground hover:text-foreground" aria-expanded={showPoor}>
                  <ChevronDown className={`size-3.5 transition-transform ${showPoor ? "rotate-180" : ""}`} /> {showPoor ? "Hide" : "Show"} {poor.length} poor fit{poor.length === 1 ? "" : "s"}
                </button>
                {showPoor && poor.map((m) => <MatchCard key={`${m.loadId}-${m.capacityId}`} match={m} side={target.kind} onBook={onBook} />)}
              </>
            )}
          </div>
        )}

        {load && !load.jobId && (
          <DialogFooter className="border-t pt-3 sm:justify-between">
            <span className="text-xs text-muted-foreground sm:self-center">Taking it but no trip yet? The job waits on the Dispatch board.</span>
            <Button variant="outline" onClick={() => onBook(load.id)}>
              <ClipboardList /> Create logistics job without a trip
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MatchCard({ match, side, onBook }: { match: BoardMatch; side: "load" | "capacity"; onBook: (loadId: string, capacityId?: string) => void }) {
  const views = useCapacityViews();
  const load = useAppStore((s) => s.boardLoads.find((l) => l.id === match.loadId));
  const reserve = useAppStore((s) => s.reserveOnPartnerTruck);
  const view = views.get(match.capacityId);
  if (!load || !view) return null;
  const usable = match.label !== "Poor Fit";
  return (
    <div className={`grid gap-2 rounded-lg border p-3 ${usable ? "bg-card" : "bg-muted/30"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          {side === "load" ? (
            <>
              <div className="flex flex-wrap items-center gap-2 font-medium">
                <Truck className="size-4 text-primary" /> {view.truckLabel}
                <span className="text-xs font-normal text-muted-foreground">
                  {view.internal ? `Our fleet · ${view.trip?.id}` : "Partner truck"} · {view.truckType}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {routeLine(view)} · departs {when(view.departureAt)}
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">
                <span className="font-mono text-xs">{load.id}</span> · {load.cargoDescription} — {kg(load.weightKg)}
              </div>
              <div className="text-xs text-muted-foreground">
                {placeLabel(load.pickup)} → {placeLabel(load.destination)} · pickup {when(load.pickupAt)}
                {load.offeredFreight ? ` · offers ${peso(load.offeredFreight)}` : ""}
              </div>
            </>
          )}
        </div>
        <StatusBadge status={match.label} />
      </div>
      <MatchChecks checks={match.checks} />
      {usable && (
        <div className="flex flex-col gap-2 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {kg(view.availableKg)} free → <b className="text-foreground">{kg(match.availableAfter)}</b> left after this load
          </span>
          <div className="flex flex-wrap gap-2">
            {view.internal ? (
              <Button size="sm" onClick={() => onBook(load.id, view.post.id)}>
                <Truck /> {load.jobId ? "Add job to" : "Book on"} {view.truckLabel}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => copyShareMessage(loadShareMessage(load))}>
                  <ClipboardCopy /> Copy load message
                </Button>
                {!load.jobId && load.capacityId !== view.post.id && (
                  <ConfirmDialog
                    trigger={
                      <Button size="sm">
                        <Bookmark /> Reserve on partner truck
                      </Button>
                    }
                    title={`Reserve ${load.id} on ${view.truckLabel}?`}
                    description={`Use this once ${view.post.contact.name} confirms the space. ${kg(load.weightKg)} is marked as used on ${view.post.id}; the load moves to Reserved. Nothing is sent to the partner.`}
                    confirmLabel="Reserve"
                    onConfirm={() => void act(() => reserve(load.id, view.post.id), () => toast.success(`${load.id} reserved on ${view.truckLabel}`, { description: `${kg(match.availableAfter)} left on ${view.post.id}` }))}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Accept match → Logistics Job (+ Trip) ─────────────────────────────────
export const PAYMENT_TERMS: [PaymentTerms, ...PaymentTerms[]] = ["COD", "Credit 7 Days", "Credit 15 Days", "Credit 30 Days", "50% Down, Balance on Arrival"];

const bookSchema = z
  .object({
    billTo: z.string().min(1, "Choose who pays the freight"),
    newCustomerName: z.string().optional(),
    freightCharge: z.number({ message: "Enter the agreed freight" }).positive("Must be more than ₱0"),
    paymentTerms: z.enum(PAYMENT_TERMS),
    consigneeName: z.string().trim().min(2, "Enter the receiving contact"),
    consigneePhone: z.string().trim().min(7, "Enter a contact number"),
  })
  .refine((v) => v.billTo !== "new" || (v.newCustomerName ?? "").trim().length >= 2, { path: ["newCustomerName"], message: "Enter the shipper's business name" });
type BookValues = z.infer<typeof bookSchema>;

/**
 * Board load → Logistics Job → Load on the Trip. Matching our truck adds it to the trip
 * (stops, delivery and capacity re-planned); without a truck the job waits for dispatch.
 */
export function BookLoadDialog({ loadId, capacityId, onClose }: { loadId: string; capacityId?: string; onClose: () => void }) {
  const router = useRouter();
  const load = useAppStore((s) => s.boardLoads.find((l) => l.id === loadId));
  const jobs = useAppStore((s) => s.jobs);
  const customers = useAppStore((s) => s.customers);
  const partners = useAppStore((s) => s.truckingPartners);
  const book = useAppStore((s) => s.bookBoardLoad);
  const views = useCapacityViews();
  const view = capacityId ? views.get(capacityId) : undefined;
  if (!load) return null;
  return <BookForm load={load} view={view?.internal ? view : undefined} existingJob={load.jobId ? jobs.find((j) => j.id === load.jobId) : undefined} customers={customers} partnerName={partners.find((p) => p.id === load.partnerId)?.name} onClose={onClose} onBook={book} onViewJob={(id) => router.push(`/jobs/${id}`)} />;
}

function BookForm({
  load,
  view,
  existingJob,
  customers,
  partnerName,
  onClose,
  onBook,
  onViewJob,
}: {
  load: AvailableLoad;
  view?: CapacityView;
  existingJob?: LogisticsJob;
  customers: Customer[];
  partnerName?: string;
  onClose: () => void;
  onBook: (input: BookBoardLoadInput) => Promise<BookingResult>;
  onViewJob: (id: string) => void;
}) {
  const customerMap = useCustomerMap();
  const leg = bookingLeg(load, view?.post);
  const known = load.customerId ? customerMap.get(load.customerId) : undefined;
  const form = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      billTo: load.customerId ?? "new",
      newCustomerName: partnerName ?? load.contact.name,
      freightCharge: bookingFreight(load, leg),
      paymentTerms: known?.paymentTerms ?? "COD",
      consigneeName: load.contact.name,
      consigneePhone: load.contact.phone,
    },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const billTo = watch("billTo");
  const trip = view?.trip;
  const open = trip && view?.post.fleet === "internal" ? legOpen(trip, view.post.leg) : true;
  const alreadyOnTrip = !!existingJob?.tripId && existingJob.tripId === trip?.id;
  const customerOptions = [{ value: "new", label: "+ New customer from this post", hint: `${load.contact.name} · ${load.contact.phone}` }, ...customers.map((c) => ({ value: c.id, label: c.name, hint: `${c.id} · ${c.type}` }))];

  const submit = handleSubmit(async (v) => {
    let res: BookingResult | undefined;
    await act(async () => (res = await onBook({
      loadId: load.id,
      capacityId: view?.post.id,
      customerId: v.billTo === "new" ? undefined : v.billTo,
      newCustomerName: v.newCustomerName,
      freightCharge: v.freightCharge,
      paymentTerms: v.paymentTerms,
      consignee: { name: v.consigneeName, phone: v.consigneePhone },
    })));
    if (!res) return;
    const booked = res;
    let description = "Awaiting dispatch — assign it to a trip on the Dispatch board.";
    if (trip) {
      const st = useAppStore.getState();
      const m = getTripMetricsMap(st.trips, st.jobs, st.loads, st.deliveries, st.expenses).get(trip.id);
      const onTrip = st.jobs.find((j) => j.id === booked.jobId)?.tripId === trip.id;
      description = onTrip && m ? `On ${trip.id} · ${view!.truckLabel} ${leg === "return" ? "return" : "outbound"} space left: ${kg(m.capacityKg - (leg === "return" ? m.returnKg : m.outboundKg))}` : `Could not add to ${trip.id} — the trip no longer takes cargo on this leg.`;
    }
    toast.success(booked.created ? `${booked.jobId} created from ${load.id}` : `${load.id} is already ${booked.jobId} — no duplicate created`, { description, action: { label: "View job", onClick: () => onViewJob(booked.jobId) } });
    onClose();
  });

  const chain = [load.id, existingJob?.id ?? "Logistics Job", "Load / Cargo", trip ? `${trip.id} · ${view!.truckLabel}` : "Dispatch", ...(leg === "return" && trip ? ["Backhaul"] : []), "Delivery"];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{trip ? `Book ${load.id} on ${view!.truckLabel}` : `Create a logistics job from ${load.id}`}</DialogTitle>
          <DialogDescription>
            {load.cargoDescription} · {kg(load.weightKg)} · {placeLabel(load.pickup)} → {placeLabel(load.destination)} · pickup {when(load.pickupAt)}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="What this creates">
          {chain.map((c, i) => (
            <li key={c} className="flex items-center gap-1">
              <span className={`rounded-md px-1.5 py-0.5 ${i === 0 ? "bg-muted" : "bg-accent text-accent-foreground"}`}>{c}</span>
              {i < chain.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        {existingJob && (
          <div className="flex items-start gap-2 rounded-md bg-info-soft px-3 py-2 text-xs">
            <Info className="mt-px size-3.5 shrink-0" />
            <span>
              Already booked as{" "}
              <Link href={`/jobs/${existingJob.id}`} className="font-medium text-primary hover:underline">
                {existingJob.id}
              </Link>
              . {alreadyOnTrip ? "It is already on this trip — nothing new will be created." : "Confirming only adds that job to the trip; no new job or load is created."}
            </span>
          </div>
        )}

        {trip && view && (
          <div className="grid gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                {view.truckLabel} · {trip.id}
              </span>
              {view.post.fleet === "internal" && <LegBadge leg={view.post.leg} />}
            </div>
            <CapacityBar used={view.usedKg + (alreadyOnTrip ? 0 : load.weightKg)} capacity={view.totalKg} label={`${leg === "return" ? "Return" : "Outbound"} load after booking`} size="sm" />
            {!open && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-danger" role="alert">
                <AlertTriangle className="size-3.5" /> {trip.id} no longer takes cargo on this leg ({trip.status}).
              </div>
            )}
            {leg === "return" && <p className="text-xs text-muted-foreground">Return-leg cargo shows on the trip&apos;s Backhaul card as paid third-party cargo.</p>}
          </div>
        )}

        {!existingJob ? (
          <form id="book-load" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Bill freight to" htmlFor="bk-bill" error={errors.billTo?.message} required className="sm:col-span-2">
              <Combobox id="bk-bill" options={customerOptions} value={billTo} onChange={(x) => setValue("billTo", x, { shouldValidate: true })} searchPlaceholder="Search customers…" />
            </Field>
            {billTo === "new" && (
              <Field label="Shipper business name" htmlFor="bk-newname" error={errors.newCustomerName?.message} hint="Saved as a new customer (COD until credit review)." required className="sm:col-span-2">
                <Input id="bk-newname" {...register("newCustomerName")} aria-invalid={!!errors.newCustomerName} />
              </Field>
            )}
            <Field label="Agreed freight (₱)" htmlFor="bk-freight" error={errors.freightCharge?.message} hint={load.offeredFreight ? `Shipper offered ${peso(load.offeredFreight)}` : "From the demo rate card"} required>
              <Input id="bk-freight" type="number" min={0} {...register("freightCharge", { valueAsNumber: true })} aria-invalid={!!errors.freightCharge} />
            </Field>
            <Field label="Payment terms" htmlFor="bk-terms">
              <Controller
                control={control}
                name="paymentTerms"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="bk-terms">
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
            <Field label="Receiving contact" htmlFor="bk-cname" error={errors.consigneeName?.message} required>
              <Input id="bk-cname" {...register("consigneeName")} aria-invalid={!!errors.consigneeName} />
            </Field>
            <Field label="Receiving contact no." htmlFor="bk-cphone" error={errors.consigneePhone?.message} required>
              <Input id="bk-cphone" inputMode="tel" {...register("consigneePhone")} aria-invalid={!!errors.consigneePhone} />
            </Field>
            <DemoRateNote className="sm:col-span-2" />
          </form>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Back
          </Button>
          {existingJob ? (
            <Button type="button" disabled={alreadyOnTrip || !trip || !open} onClick={() => submit()}>
              <Truck /> Add {existingJob.id} to {trip?.id ?? "trip"}
            </Button>
          ) : (
            <Button type="submit" form="book-load" disabled={!open || formState.isSubmitting}>
              {trip ? <Truck /> : <ClipboardList />} {trip ? `Confirm booking on ${view!.truckLabel}` : "Create logistics job"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
