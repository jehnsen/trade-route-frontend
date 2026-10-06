"use client";

import * as React from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, Building2, Handshake, Phone, Plus, Truck, Users } from "lucide-react";
import type { AreaId, CargoCategory, Leg, LoadBoardSource, Place, TruckType } from "@/types";
import { act } from "@/lib/act";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { AREAS, areaName, PLACES } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { CARGO_CATEGORIES } from "@/data/cargo";
import { dispatchContact, LOAD_BOARD_SOURCES, REQUIRED_TRUCK_TYPES, TRUCK_TYPES, cityPlace, legOpen, routeLine, shortArea, tripLeg } from "@/lib/load-board";
import { fmtDay, fmtTime, kg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Textarea } from "@/components/ui/primitives";
import { Combobox, DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { BoardSourceBadge, CapacityBar, DemoRateNote, EmptyState } from "@/components/shared/common";

// ─── Shared bits ────────────────────────────────────────────────────────────
const tuple = <T extends string>(xs: T[]) => xs as [T, ...T[]];
const ROAD_AREAS = AREAS.filter((a) => !a.interIsland);

/** Towns (city-level) plus the named pickup points we already know. */
const LOCATION_OPTIONS = [
  ...ROAD_AREAS.map((a) => ({ value: `area:${a.id}`, label: a.name, hint: `${a.province} · town / city` })),
  ...PLACES.map((p) => ({ value: `place:${p.name}`, label: p.name, hint: areaName(p.areaId) })),
];
const AREA_OPTIONS = ROAD_AREAS.map((a) => ({ value: a.id, label: a.name, hint: a.province }));

function toPlace(key: string, detail?: string): Place {
  const [kind, value] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const known = kind === "place" ? PLACES.find((p) => p.name === value) : undefined;
  const base: Place = known ? { name: known.name, areaId: known.areaId, address: known.address } : cityPlace(value as AreaId);
  const extra = detail?.trim();
  return extra ? (known ? { ...base, address: extra } : { ...base, name: extra, address: `${extra}, ${areaName(base.areaId)}` }) : base;
}

export function CargoChecklist({ value, onChange, idPrefix }: { value: CargoCategory[]; onChange: (v: CargoCategory[]) => void; idPrefix: string }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-[13px] font-medium">Accepted cargo</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {CARGO_CATEGORIES.map((c) => (
          <label key={c} htmlFor={`${idPrefix}-${c}`} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox id={`${idPrefix}-${c}`} checked={value.includes(c)} onCheckedChange={(on) => onChange(on ? [...value, c] : value.filter((x) => x !== c))} />
            {c}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Leave all unticked if any cargo is fine.</p>
    </fieldset>
  );
}

const timeRe = /^\d{2}:\d{2}$/;
const optionalMoney = { setValueAs: (v: string) => (v === "" || v === undefined ? undefined : Number(v)) };

// ─── Post available load ────────────────────────────────────────────────────
const loadSchema = z
  .object({
    source: z.enum(tuple(LOAD_BOARD_SOURCES)),
    sourceReference: z.string().max(80).optional(),
    partnerId: z.string(),
    customerId: z.string(),
    contactName: z.string().trim().min(2, "Who posted it?"),
    contactPhone: z.string().trim().min(7, "Enter a contact number"),
    pickup: z.string().min(1, "Choose the pickup town or point"),
    pickupDetail: z.string().max(120).optional(),
    destination: z.string().min(1, "Choose the destination"),
    destinationDetail: z.string().max(120).optional(),
    cargoDescription: z.string().trim().min(2, "Describe the cargo"),
    cargoCategory: z.enum(tuple(CARGO_CATEGORIES)),
    weight: z.number({ message: "Enter the weight" }).positive("Must be more than 0"),
    unit: z.enum(["kg", "t"]),
    truckType: z.enum(tuple(REQUIRED_TRUCK_TYPES)),
    pickupDate: z.string().min(1, "Pick a date"),
    pickupTime: z.string().regex(timeRe, "Enter a time"),
    deliveryDate: z.string(),
    deliveryTime: z.string(),
    offeredFreight: z.number().min(0, "Cannot be negative").optional(),
    specialHandling: z.string().max(160).optional(),
    notes: z.string().max(400).optional(),
  })
  .refine((v) => v.source !== "Existing Customer" || !!v.customerId, { path: ["customerId"], message: "Choose the customer" })
  .refine((v) => v.pickup !== v.destination || !!v.destinationDetail?.trim(), { path: ["destination"], message: "Destination is the same as pickup" })
  .refine((v) => (v.unit === "t" ? v.weight * 1000 : v.weight) <= 30000, { path: ["weight"], message: "More than one truck can carry — split it into separate posts" })
  .refine((v) => !v.deliveryDate || timeRe.test(v.deliveryTime), { path: ["deliveryTime"], message: "Enter a time" })
  .refine((v) => !v.deliveryDate || `${v.deliveryDate}T${v.deliveryTime}` > `${v.pickupDate}T${v.pickupTime}`, { path: ["deliveryDate"], message: "Delivery must be after pickup" });
type LoadValues = z.infer<typeof loadSchema>;

const loadDefaults = (): LoadValues => ({
  source: "Messenger GC",
  sourceReference: "",
  partnerId: "",
  customerId: "",
  contactName: "",
  contactPhone: "",
  pickup: "",
  pickupDetail: "",
  destination: "area:lucena",
  destinationDetail: "",
  cargoDescription: "",
  cargoCategory: "Produce",
  weight: 0,
  unit: "kg",
  truckType: "Any Closed Van",
  pickupDate: TODAY,
  pickupTime: "20:00",
  deliveryDate: "",
  deliveryTime: "",
  offeredFreight: undefined,
  specialHandling: "",
  notes: "",
});

export function PostLoadDialog({ open, onOpenChange, onPosted }: { open: boolean; onOpenChange: (v: boolean) => void; onPosted?: (id: string) => void }) {
  const post = useAppStore((s) => s.postBoardLoad);
  const partners = useAppStore((s) => s.truckingPartners);
  const customers = useAppStore((s) => s.customers);
  const form = useForm<LoadValues>({ resolver: zodResolver(loadSchema), defaultValues: loadDefaults() });
  const { register, control, handleSubmit, setValue, watch, reset, formState } = form;
  const errors = formState.errors;
  const v = watch();
  React.useEffect(() => {
    if (open) reset(loadDefaults());
  }, [open, reset]);

  const pickPartner = (id: string) => {
    setValue("partnerId", id);
    const p = partners.find((x) => x.id === id);
    if (!p) return;
    setValue("contactName", p.contact.name, { shouldValidate: true });
    setValue("contactPhone", p.contact.phone, { shouldValidate: true });
    if (p.channelName && !v.sourceReference) setValue("sourceReference", p.channelName);
  };
  const pickCustomer = (id: string) => {
    setValue("customerId", id, { shouldValidate: true });
    const c = customers.find((x) => x.id === id);
    const person = c?.contacts.find((x) => x.primary) ?? c?.contacts[0];
    if (person) {
      setValue("contactName", person.name, { shouldValidate: true });
      setValue("contactPhone", person.phone, { shouldValidate: true });
    }
  };

  const submit = handleSubmit(async (vals) => {
    await act(() => post({
      source: vals.source,
      sourceReference: vals.sourceReference?.trim() || undefined,
      partnerId: vals.source === "Existing Customer" || !vals.partnerId ? undefined : vals.partnerId,
      customerId: vals.source === "Existing Customer" ? vals.customerId : undefined,
      contact: { name: vals.contactName.trim(), phone: vals.contactPhone.trim() },
      pickup: toPlace(vals.pickup, vals.pickupDetail),
      destination: toPlace(vals.destination, vals.destinationDetail),
      cargoDescription: vals.cargoDescription.trim(),
      cargoCategory: vals.cargoCategory,
      weightKg: Math.round(vals.unit === "t" ? vals.weight * 1000 : vals.weight),
      truckType: vals.truckType,
      pickupAt: `${vals.pickupDate}T${vals.pickupTime}`,
      deliveryBy: vals.deliveryDate ? `${vals.deliveryDate}T${vals.deliveryTime}` : undefined,
      offeredFreight: vals.offeredFreight || undefined,
      specialHandling: vals.specialHandling?.trim() || undefined,
      notes: vals.notes?.trim() || undefined,
    }), (id) => {
      toast.success(`${id} posted to the Load Board`, { description: "Possible trucks are listed under Matches." });
      onOpenChange(false);
      onPosted?.(id);
    });
  });

  const selectField = <K extends "source" | "cargoCategory" | "truckType" | "unit">(name: K, options: readonly string[], id: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select value={field.value} onValueChange={field.onChange}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o === "t" ? "tons" : o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post available load</DialogTitle>
          <DialogDescription>Cargo that needs a truck — as seen in a GC, a Facebook post or a direct call. Recording it here does not post anything online.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Source" htmlFor="pl-source">
            {selectField("source", LOAD_BOARD_SOURCES, "pl-source")}
          </Field>
          <Field label="GC / group / post" htmlFor="pl-ref" hint="Optional — where you saw it">
            <Input id="pl-ref" {...register("sourceReference")} placeholder="Quezon–NCR Trucking GC" />
          </Field>
          {v.source === "Existing Customer" ? (
            <Field label="Customer" htmlFor="pl-cust" error={errors.customerId?.message} required className="sm:col-span-2">
              <Combobox id="pl-cust" options={customers.map((c) => ({ value: c.id, label: c.name, hint: `${c.id} · ${areaName(c.areaId)}` }))} value={v.customerId} onChange={pickCustomer} placeholder="Choose customer" invalid={!!errors.customerId} />
            </Field>
          ) : v.source !== "Internal" ? (
            <Field label="Trucking partner / broker" htmlFor="pl-partner" hint="Optional — leave empty for a shipper posting directly" className="sm:col-span-2">
              <Combobox id="pl-partner" options={[{ value: "", label: "None — shipper posted directly" }, ...partners.map((p) => ({ value: p.id, label: p.name, hint: `${p.contact.name} · ${p.channel}` }))]} value={v.partnerId} onChange={pickPartner} placeholder="None — shipper posted directly" />
            </Field>
          ) : null}
          <Field label="Contact person" htmlFor="pl-cname" error={errors.contactName?.message} required>
            <Input id="pl-cname" {...register("contactName")} aria-invalid={!!errors.contactName} />
          </Field>
          <Field label="Contact no." htmlFor="pl-cphone" error={errors.contactPhone?.message} required>
            <Input id="pl-cphone" inputMode="tel" {...register("contactPhone")} aria-invalid={!!errors.contactPhone} placeholder="09XX XXX XXXX" />
          </Field>

          <Field label="Pickup location" htmlFor="pl-pickup" error={errors.pickup?.message} required>
            <Combobox id="pl-pickup" options={LOCATION_OPTIONS} value={v.pickup} onChange={(x) => setValue("pickup", x, { shouldValidate: true })} placeholder="Town or known pickup point" invalid={!!errors.pickup} />
          </Field>
          <Field label="Pickup address / landmark" htmlFor="pl-pdetail" hint="Optional">
            <Input id="pl-pdetail" {...register("pickupDetail")} />
          </Field>
          <Field label="Destination" htmlFor="pl-dest" error={errors.destination?.message} required>
            <Combobox id="pl-dest" options={LOCATION_OPTIONS} value={v.destination} onChange={(x) => setValue("destination", x, { shouldValidate: true })} invalid={!!errors.destination} />
          </Field>
          <Field label="Destination address / landmark" htmlFor="pl-ddetail" hint="Optional">
            <Input id="pl-ddetail" {...register("destinationDetail")} />
          </Field>

          <Field label="Cargo description" htmlFor="pl-cargo" error={errors.cargoDescription?.message} required>
            <Input id="pl-cargo" {...register("cargoDescription")} aria-invalid={!!errors.cargoDescription} placeholder="Red onion, sacked" />
          </Field>
          <Field label="Cargo category" htmlFor="pl-cat">
            {selectField("cargoCategory", CARGO_CATEGORIES, "pl-cat")}
          </Field>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Field label="Weight" htmlFor="pl-weight" error={errors.weight?.message} required>
              <Input id="pl-weight" type="number" min={0} step="any" {...register("weight", { valueAsNumber: true })} aria-invalid={!!errors.weight} />
            </Field>
            <Field label="Unit" htmlFor="pl-unit">
              {selectField("unit", ["kg", "t"], "pl-unit")}
            </Field>
          </div>
          <Field label="Required truck type" htmlFor="pl-truck">
            {selectField("truckType", REQUIRED_TRUCK_TYPES, "pl-truck")}
          </Field>

          <Field label="Pickup date & time" htmlFor="pl-pdate" error={errors.pickupDate?.message ?? errors.pickupTime?.message} required>
            <div className="grid grid-cols-[1fr_7.5rem] gap-2">
              <DatePicker id="pl-pdate" value={v.pickupDate} onChange={(d) => setValue("pickupDate", d, { shouldValidate: true })} minDate={TODAY} invalid={!!errors.pickupDate} />
              <Input type="time" aria-label="Pickup time" {...register("pickupTime")} aria-invalid={!!errors.pickupTime} />
            </div>
          </Field>
          <Field label="Required delivery (optional)" htmlFor="pl-ddate" error={errors.deliveryDate?.message ?? errors.deliveryTime?.message}>
            <div className="grid grid-cols-[1fr_7.5rem] gap-2">
              <DatePicker id="pl-ddate" value={v.deliveryDate || undefined} onChange={(d) => setValue("deliveryDate", d, { shouldValidate: true })} minDate={v.pickupDate || TODAY} invalid={!!errors.deliveryDate} />
              <Input type="time" aria-label="Required delivery time" {...register("deliveryTime")} aria-invalid={!!errors.deliveryTime} />
            </div>
          </Field>
          <Field label="Offered freight / budget (₱)" htmlFor="pl-freight" error={errors.offeredFreight?.message} hint="Optional — leave blank if not stated">
            <Input id="pl-freight" type="number" min={0} {...register("offeredFreight", optionalMoney)} />
          </Field>
          <Field label="Special handling" htmlFor="pl-handling" hint="Optional — e.g. keep iced, fragile, forklift at pickup">
            <Input id="pl-handling" {...register("specialHandling")} />
          </Field>
          <Field label="Notes" htmlFor="pl-notes" className="sm:col-span-2">
            <Textarea id="pl-notes" rows={2} {...register("notes")} />
          </Field>
          <DemoRateNote className="sm:col-span-2" />
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              <Plus /> Post load
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Post available capacity ────────────────────────────────────────────────
export interface CapacityPreset {
  tripId: string;
  leg: Leg;
}

export function PostCapacityDialog({ open, onOpenChange, preset, onPosted }: { open: boolean; onOpenChange: (v: boolean) => void; preset?: CapacityPreset; onPosted?: (id: string) => void }) {
  const [tab, setTab] = React.useState<"internal" | "external">("internal");
  React.useEffect(() => {
    if (open) setTab("internal");
  }, [open]);
  const done = (id: string) => {
    onOpenChange(false);
    onPosted?.(id);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post available capacity</DialogTitle>
          <DialogDescription>Truck space for an upcoming or return trip. For our trucks the space is read from the trip&apos;s loads, so it stays in step with Trips and Backhaul.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(x) => setTab(x as "internal" | "external")}>
          <TabsList>
            <TabsTrigger value="internal">
              <Truck /> Our truck
            </TabsTrigger>
            <TabsTrigger value="external">
              <Handshake /> Partner truck
            </TabsTrigger>
          </TabsList>
          <TabsContent value="internal">{open && <InternalCapacityForm preset={preset} onCancel={() => onOpenChange(false)} onDone={done} />}</TabsContent>
          <TabsContent value="external">{open && <ExternalCapacityForm onCancel={() => onOpenChange(false)} onDone={done} />}</TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

const internalSchema = z.object({
  tripId: z.string().min(1, "Choose the trip"),
  leg: z.enum(["return", "outbound"]),
  acceptedCargo: z.array(z.enum(tuple(CARGO_CATEGORIES))),
  restrictions: z.string().max(200).optional(),
  contactName: z.string().trim().min(2, "Enter a contact"),
  contactPhone: z.string().trim().min(7, "Enter a contact number"),
  notes: z.string().max(300).optional(),
});
type InternalValues = z.infer<typeof internalSchema>;

function InternalCapacityForm({ preset, onCancel, onDone }: { preset?: CapacityPreset; onCancel: () => void; onDone: (id: string) => void }) {
  const trips = useAppStore((s) => s.trips);
  const posts = useAppStore((s) => s.boardCapacity);
  const postCapacity = useAppStore((s) => s.postCapacity);
  const metrics = useTripMetrics();
  const lastDay = format(addDays(parseISO(TODAY), 2), "yyyy-MM-dd");
  const candidates = trips.filter((t) => t.date >= TODAY && t.date <= lastDay && t.status !== "Cancelled" && t.status !== "Completed").sort((a, b) => a.departure.localeCompare(b.departure));
  const form = useForm<InternalValues>({
    resolver: zodResolver(internalSchema),
    defaultValues: { tripId: preset?.tripId ?? "", leg: preset?.leg ?? "return", acceptedCargo: [], restrictions: "Insulated van that also carries seafood — no chemicals, fertilizer or livestock.", contactName: dispatchContact().name, contactPhone: dispatchContact().phone, notes: "" },
  });
  const { register, control, handleSubmit, watch, formState } = form;
  const errors = formState.errors;
  const v = watch();
  const trip = trips.find((t) => t.id === v.tripId);
  const m = trip ? metrics.get(trip.id) : undefined;
  const leg = trip ? tripLeg(trip, v.leg) : undefined;
  const used = m ? (v.leg === "return" ? m.returnKg : m.outboundKg) : 0;
  const isOpen = trip ? legOpen(trip, v.leg) : true;
  const duplicate = posts.find((p) => p.fleet === "internal" && p.tripId === v.tripId && p.leg === v.leg && p.status !== "Cancelled" && p.status !== "Expired");

  const submit = handleSubmit(async (vals) => {
    if (!trip || !isOpen || duplicate) return;
    await act(() => postCapacity({ fleet: "internal", tripId: vals.tripId, leg: vals.leg, source: "Internal", contact: { name: vals.contactName.trim(), phone: vals.contactPhone.trim() }, acceptedCargo: vals.acceptedCargo, restrictions: vals.restrictions?.trim() || undefined, notes: vals.notes?.trim() || undefined }), (id) => {
      toast.success(`${id} posted — ${truckById(trip.truckId).code} ${vals.leg === "return" ? "return" : "outbound"} space`, { description: `${kg(m!.capacityKg - used)} free right now; updates as cargo is added to ${trip.id}.` });
      onDone(id);
    });
  });

  if (candidates.length === 0) return <EmptyState icon={Truck} title="No trips planned in the next 3 days." description={<Link href="/dispatch" className="text-primary hover:underline">Plan a trip on the Dispatch board</Link>} />;

  return (
    <form onSubmit={submit} className="grid gap-4 pt-1 sm:grid-cols-2" noValidate>
      <Field label="Trip" htmlFor="ic-trip" error={errors.tripId?.message} required>
        <Controller
          control={control}
          name="tripId"
          render={({ field }) => (
            <Select value={field.value || undefined} onValueChange={field.onChange}>
              <SelectTrigger id="ic-trip" aria-invalid={!!errors.tripId}>
                <SelectValue placeholder="Choose a trip" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {truckById(t.truckId).code} · {t.id} · {fmtDay(t.date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field label="Leg" htmlFor="ic-leg">
        <Controller
          control={control}
          name="leg"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="ic-leg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="return">Return leg (toward Lucena)</SelectItem>
                <SelectItem value="outbound">Outbound (from Lucena)</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      {trip && m && leg && (
        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:col-span-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Truck</div>
              <div className="font-medium">
                {truckById(trip.truckId).code} · {truckById(trip.truckId).vehicleType}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Route</div>
              <div className="font-medium">{leg.routeAreas.map(shortArea).join(" → ")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Space opens</div>
              <div className="font-medium">
                {fmtDay(leg.departureAt)} · {fmtTime(leg.departureAt)}
              </div>
            </div>
          </div>
          <CapacityBar used={used} capacity={m.capacityKg} label={`Total ${kg(m.capacityKg)} · used ${kg(used)} · available ${kg(m.capacityKg - used)}`} size="sm" />
          <p className="text-xs text-muted-foreground">From {trip.id}&apos;s loads — not typed in, so it cannot drift from the trip.</p>
          {!isOpen && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-danger" role="alert">
              <AlertTriangle className="size-3.5" /> {trip.id} no longer takes cargo on this leg ({trip.status}).
            </p>
          )}
          {duplicate && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-[oklch(0.5_0.13_65)]" role="alert">
              <AlertTriangle className="size-3.5" /> Already on the board as {duplicate.id}.
            </p>
          )}
        </div>
      )}
      <div className="sm:col-span-2">
        <Controller control={control} name="acceptedCargo" render={({ field }) => <CargoChecklist idPrefix="ic-cargo" value={field.value} onChange={field.onChange} />} />
      </div>
      <Field label="Cargo restrictions" htmlFor="ic-restr" className="sm:col-span-2">
        <Input id="ic-restr" {...register("restrictions")} />
      </Field>
      <Field label="Contact" htmlFor="ic-cname" error={errors.contactName?.message} required>
        <Input id="ic-cname" {...register("contactName")} />
      </Field>
      <Field label="Contact no." htmlFor="ic-cphone" error={errors.contactPhone?.message} required>
        <Input id="ic-cphone" inputMode="tel" {...register("contactPhone")} />
      </Field>
      <Field label="Notes" htmlFor="ic-notes" className="sm:col-span-2">
        <Textarea id="ic-notes" rows={2} {...register("notes")} />
      </Field>
      <DialogFooter className="sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={(!!trip && !isOpen) || !!duplicate || formState.isSubmitting}>
          <Plus /> Post our capacity
        </Button>
      </DialogFooter>
    </form>
  );
}

const externalSchema = z
  .object({
    partnerId: z.string().min(1, "Choose the trucking partner"),
    truckType: z.enum(tuple(TRUCK_TYPES)),
    currentLocation: z.string().min(1, "Where is the truck now?"),
    destination: z.string().min(1, "Where is it going?"),
    via: z.string(),
    totalCapacityKg: z.number({ message: "Enter total capacity" }).positive("Must be more than 0").max(30000, "Check the figure"),
    usedCapacityKg: z.number({ message: "Enter 0 if empty" }).min(0, "Cannot be negative"),
    departureDate: z.string().min(1, "Pick a date"),
    departureTime: z.string().regex(timeRe, "Enter a time"),
    acceptedCargo: z.array(z.enum(tuple(CARGO_CATEGORIES))),
    restrictions: z.string().max(200).optional(),
    contactName: z.string().trim().min(2, "Enter a contact"),
    contactPhone: z.string().trim().min(7, "Enter a contact number"),
    source: z.enum(tuple(LOAD_BOARD_SOURCES)),
    sourceReference: z.string().max(80).optional(),
    notes: z.string().max(300).optional(),
  })
  .refine((v) => v.usedCapacityKg < v.totalCapacityKg, { path: ["usedCapacityKg"], message: "Used must be less than total — nothing left to offer" })
  .refine((v) => v.currentLocation !== v.destination, { path: ["destination"], message: "Destination is the same as the current location" });
type ExternalValues = z.infer<typeof externalSchema>;

function ExternalCapacityForm({ onCancel, onDone }: { onCancel: () => void; onDone: (id: string) => void }) {
  const partners = useAppStore((s) => s.truckingPartners);
  const postCapacity = useAppStore((s) => s.postCapacity);
  const [addingPartner, setAddingPartner] = React.useState(false);
  const form = useForm<ExternalValues>({
    resolver: zodResolver(externalSchema),
    defaultValues: { partnerId: "", truckType: "10-Wheeler Closed Van", currentLocation: "", destination: "lucena", via: "", totalCapacityKg: 8000, usedCapacityKg: 0, departureDate: TODAY, departureTime: "21:00", acceptedCargo: [], restrictions: "", contactName: "", contactPhone: "", source: "Messenger GC", sourceReference: "", notes: "" },
  });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const v = watch();
  const available = Math.max(0, (v.totalCapacityKg || 0) - (v.usedCapacityKg || 0));

  const pickPartner = (id: string) => {
    setValue("partnerId", id, { shouldValidate: true });
    const p = partners.find((x) => x.id === id);
    if (!p) return;
    setValue("contactName", p.contact.name, { shouldValidate: true });
    setValue("contactPhone", p.contact.phone, { shouldValidate: true });
    if (p.truckTypes[0]) setValue("truckType", p.truckTypes[0]);
    setValue("source", p.channel === "Internal" ? "Direct Contact" : p.channel);
    setValue("sourceReference", p.channelName ?? "");
  };

  const submit = handleSubmit(async (vals) => {
    await act(() => postCapacity({
      fleet: "external",
      partnerId: vals.partnerId,
      source: vals.source,
      sourceReference: vals.sourceReference?.trim() || undefined,
      contact: { name: vals.contactName.trim(), phone: vals.contactPhone.trim() },
      truckType: vals.truckType,
      currentLocation: cityPlace(vals.currentLocation as AreaId),
      destination: cityPlace(vals.destination as AreaId),
      plannedRoute: vals.via ? [vals.via as AreaId] : [],
      totalCapacityKg: vals.totalCapacityKg,
      usedCapacityKg: vals.usedCapacityKg,
      departureAt: `${vals.departureDate}T${vals.departureTime}`,
      acceptedCargo: vals.acceptedCargo,
      restrictions: vals.restrictions?.trim() || undefined,
      notes: vals.notes?.trim() || undefined,
    }), (id) => {
      toast.success(`${id} posted — ${partners.find((p) => p.id === vals.partnerId)?.name}`, { description: `${kg(vals.totalCapacityKg - vals.usedCapacityKg)} available` });
      onDone(id);
    });
  });

  return (
    <>
      <form onSubmit={submit} className="grid gap-4 pt-1 sm:grid-cols-2" noValidate>
        <Field label="Trucking partner" htmlFor="xc-partner" error={errors.partnerId?.message} required className="sm:col-span-2">
          <div className="flex gap-2">
            <Combobox id="xc-partner" options={partners.map((p) => ({ value: p.id, label: p.name, hint: `${p.contact.name} · ${p.truckTypes.join(", ")}` }))} value={v.partnerId} onChange={pickPartner} placeholder="Choose partner" invalid={!!errors.partnerId} />
            <Button type="button" variant="outline" onClick={() => setAddingPartner(true)}>
              <Plus /> New
            </Button>
          </div>
        </Field>
        <Field label="Truck type" htmlFor="xc-type">
          <Controller
            control={control}
            name="truckType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="xc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRUCK_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="Departure" htmlFor="xc-date" error={errors.departureDate?.message ?? errors.departureTime?.message} required>
          <div className="grid grid-cols-[1fr_7.5rem] gap-2">
            <DatePicker id="xc-date" value={v.departureDate} onChange={(d) => setValue("departureDate", d, { shouldValidate: true })} minDate={TODAY} />
            <Input type="time" aria-label="Departure time" {...register("departureTime")} />
          </div>
        </Field>
        <Field label="Current location" htmlFor="xc-from" error={errors.currentLocation?.message} required>
          <Combobox id="xc-from" options={AREA_OPTIONS} value={v.currentLocation} onChange={(x) => setValue("currentLocation", x, { shouldValidate: true })} placeholder="Town / city" invalid={!!errors.currentLocation} />
        </Field>
        <Field label="Destination" htmlFor="xc-to" error={errors.destination?.message} required>
          <Combobox id="xc-to" options={AREA_OPTIONS} value={v.destination} onChange={(x) => setValue("destination", x, { shouldValidate: true })} invalid={!!errors.destination} />
        </Field>
        <Field label="Planned route — via (optional)" htmlFor="xc-via" hint="A town the truck passes on the way" className="sm:col-span-2">
          <Combobox id="xc-via" options={[{ value: "", label: "Direct" }, ...AREA_OPTIONS]} value={v.via} onChange={(x) => setValue("via", x)} placeholder="Direct" />
        </Field>
        <Field label="Total capacity (kg)" htmlFor="xc-total" error={errors.totalCapacityKg?.message} required>
          <Input id="xc-total" type="number" min={0} {...register("totalCapacityKg", { valueAsNumber: true })} aria-invalid={!!errors.totalCapacityKg} />
        </Field>
        <Field label="Already used (kg)" htmlFor="xc-used" error={errors.usedCapacityKg?.message} required>
          <Input id="xc-used" type="number" min={0} {...register("usedCapacityKg", { valueAsNumber: true })} aria-invalid={!!errors.usedCapacityKg} />
        </Field>
        <div className="sm:col-span-2">
          <CapacityBar used={v.usedCapacityKg || 0} capacity={v.totalCapacityKg || 0} label={`Available capacity: ${kg(available)}`} size="sm" />
        </div>
        <div className="sm:col-span-2">
          <Controller control={control} name="acceptedCargo" render={({ field }) => <CargoChecklist idPrefix="xc-cargo" value={field.value} onChange={field.onChange} />} />
        </div>
        <Field label="Cargo restrictions" htmlFor="xc-restr" className="sm:col-span-2">
          <Input id="xc-restr" {...register("restrictions")} placeholder="e.g. no wet cargo, no livestock" />
        </Field>
        <Field label="Contact" htmlFor="xc-cname" error={errors.contactName?.message} required>
          <Input id="xc-cname" {...register("contactName")} aria-invalid={!!errors.contactName} />
        </Field>
        <Field label="Contact no." htmlFor="xc-cphone" error={errors.contactPhone?.message} required>
          <Input id="xc-cphone" inputMode="tel" {...register("contactPhone")} aria-invalid={!!errors.contactPhone} />
        </Field>
        <Field label="Source" htmlFor="xc-source">
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="xc-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAD_BOARD_SOURCES.filter((s) => s !== "Internal" && s !== "Existing Customer").map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field label="GC / group / post" htmlFor="xc-ref">
          <Input id="xc-ref" {...register("sourceReference")} />
        </Field>
        <Field label="Notes" htmlFor="xc-notes" className="sm:col-span-2">
          <Textarea id="xc-notes" rows={2} {...register("notes")} />
        </Field>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            <Plus /> Post partner capacity
          </Button>
        </DialogFooter>
      </form>
      <PartnersDialog open={addingPartner} onOpenChange={setAddingPartner} startAdding onAdded={(id) => pickPartner(id)} />
    </>
  );
}

// ─── Trucking partners ──────────────────────────────────────────────────────
const partnerSchema = z.object({
  name: z.string().trim().min(2, "Enter the company or contact name"),
  contactName: z.string().trim().min(2, "Enter a contact person"),
  phone: z.string().trim().min(7, "Enter a contact number"),
  truckTypes: z.array(z.enum(tuple(TRUCK_TYPES))).min(1, "Tick at least one truck type"),
  channel: z.enum(tuple(LOAD_BOARD_SOURCES)),
  channelName: z.string().max(80).optional(),
  typicalRoutes: z.string().max(200).optional(),
  notes: z.string().max(300).optional(),
});
type PartnerValues = z.infer<typeof partnerSchema>;

/** Lightweight directory of outside truckers — not a fleet or partner-management module. */
export function PartnersDialog({ open, onOpenChange, startAdding, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; startAdding?: boolean; onAdded?: (id: string) => void }) {
  const partners = useAppStore((s) => s.truckingPartners);
  const capacity = useAppStore((s) => s.boardCapacity);
  const addPartner = useAppStore((s) => s.addTruckingPartner);
  const [adding, setAdding] = React.useState(!!startAdding);
  const form = useForm<PartnerValues>({ resolver: zodResolver(partnerSchema), defaultValues: { name: "", contactName: "", phone: "", truckTypes: [], channel: "Messenger GC", channelName: "", typicalRoutes: "", notes: "" } });
  const { register, control, handleSubmit, reset, formState } = form;
  const errors = formState.errors;
  React.useEffect(() => {
    if (open) {
      setAdding(!!startAdding);
      reset();
    }
  }, [open, startAdding, reset]);

  const submit = handleSubmit(async (v) => {
    await act(() => addPartner({
      name: v.name.trim(),
      contact: { name: v.contactName.trim(), phone: v.phone.trim() },
      truckTypes: v.truckTypes,
      channel: v.channel,
      channelName: v.channelName?.trim() || undefined,
      typicalRoutes: (v.typicalRoutes ?? "")
        .split(/[;\n]|,(?![^(]*\))/)
        .map((x) => x.trim())
        .filter(Boolean),
      notes: v.notes?.trim() || undefined,
    }), (id) => {
      toast.success(`${v.name.trim()} added as ${id}`);
      onAdded?.(id);
      if (startAdding) onOpenChange(false);
      else {
        setAdding(false);
        reset();
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trucking partners</DialogTitle>
          <DialogDescription>Outside truckers we coordinate with through the GCs. They do not need to be in our fleet.</DialogDescription>
        </DialogHeader>
        {adding ? (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Company / trucker name" htmlFor="tp-name" error={errors.name?.message} required className="sm:col-span-2">
              <Input id="tp-name" {...register("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Contact person" htmlFor="tp-contact" error={errors.contactName?.message} required>
              <Input id="tp-contact" {...register("contactName")} aria-invalid={!!errors.contactName} />
            </Field>
            <Field label="Phone" htmlFor="tp-phone" error={errors.phone?.message} required>
              <Input id="tp-phone" inputMode="tel" {...register("phone")} aria-invalid={!!errors.phone} />
            </Field>
            <Controller
              control={control}
              name="truckTypes"
              render={({ field }) => (
                <fieldset className="grid gap-1.5 sm:col-span-2">
                  <legend className="mb-1 text-[13px] font-medium">
                    Truck types<span className="text-destructive"> *</span>
                  </legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {TRUCK_TYPES.map((t: TruckType) => (
                      <label key={t} htmlFor={`tp-${t}`} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox id={`tp-${t}`} checked={field.value.includes(t)} onCheckedChange={(on) => field.onChange(on ? [...field.value, t] : field.value.filter((x) => x !== t))} />
                        {t}
                      </label>
                    ))}
                  </div>
                  {errors.truckTypes && <p className="text-xs text-destructive">{errors.truckTypes.message}</p>}
                </fieldset>
              )}
            />
            <Field label="Usually posts in" htmlFor="tp-channel">
              <Controller
                control={control}
                name="channel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(x) => field.onChange(x as LoadBoardSource)}>
                    <SelectTrigger id="tp-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAD_BOARD_SOURCES.filter((s) => s !== "Internal" && s !== "Existing Customer").map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="GC / group name" htmlFor="tp-chname">
              <Input id="tp-chname" {...register("channelName")} />
            </Field>
            <Field label="Typical routes" htmlFor="tp-routes" hint="Separate with commas, e.g. Valenzuela → Lucena, Lucena → Navotas" className="sm:col-span-2">
              <Input id="tp-routes" {...register("typicalRoutes")} />
            </Field>
            <Field label="Notes" htmlFor="tp-notes" className="sm:col-span-2">
              <Textarea id="tp-notes" rows={2} {...register("notes")} />
            </Field>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => (startAdding ? onOpenChange(false) : setAdding(false))}>
                Back
              </Button>
              <Button type="submit" disabled={formState.isSubmitting}>
                <Plus /> Save partner
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <ul className="grid gap-2">
              {partners.map((p) => {
                const posts = capacity.filter((c) => c.fleet === "external" && c.partnerId === p.id).length;
                return (
                  <li key={p.id} className="grid gap-1.5 rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          <Building2 className="size-4 text-muted-foreground" /> {p.name} <span className="font-mono text-xs font-normal text-muted-foreground">{p.id}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3" /> {p.contact.name} · {p.contact.phone}
                        </div>
                      </div>
                      <BoardSourceBadge source={p.channel} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.truckTypes.join(" · ")}
                      {p.channelName ? ` · ${p.channelName}` : ""} · {posts} capacity post{posts === 1 ? "" : "s"}
                    </div>
                    {p.typicalRoutes.length > 0 && <div className="text-xs">Routes: {p.typicalRoutes.join(", ")}</div>}
                    {p.notes && <div className="rounded-md bg-muted/60 px-2 py-1 text-xs">{p.notes}</div>}
                  </li>
                );
              })}
              {partners.length === 0 && <EmptyState icon={Users} title="No trucking partners yet." />}
            </ul>
            <DialogFooter>
              <Button onClick={() => setAdding(true)}>
                <Plus /> Add partner
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Small status dialogs ───────────────────────────────────────────────────
/** Close a post (cancelled, expired, booked elsewhere) with an optional reason. */
export function ClosePostDialog({ title, description, confirmLabel, destructive, onConfirm, onClose }: { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: (reason?: string) => void; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field label="Reason (optional)" htmlFor="close-reason">
          <Textarea id="close-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Shipper found a truck in the GC" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm(reason.trim() || undefined);
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Partner says the truck took more cargo — update how much space is left. */
export function UpdateUsedDialog({ capacityId, onClose }: { capacityId: string; onClose: () => void }) {
  const post = useAppStore((s) => s.boardCapacity.find((c) => c.id === capacityId));
  const update = useAppStore((s) => s.updateCapacityUsed);
  const [used, setUsed] = React.useState(post?.fleet === "external" ? String(post.usedCapacityKg) : "0");
  if (!post || post.fleet !== "external") return null;
  const n = Number(used);
  const error = !Number.isFinite(n) || n < 0 ? "Enter a weight of 0 or more" : n > post.totalCapacityKg ? `Cannot exceed total ${kg(post.totalCapacityKg)}` : undefined;
  return (
    <Dialog open onOpenChange={(x) => !x && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update used capacity — {post.id}</DialogTitle>
          <DialogDescription>
            {routeLine({ routeAreas: [post.currentLocation.areaId, ...post.plannedRoute, post.destination.areaId] })} · total {kg(post.totalCapacityKg)}
          </DialogDescription>
        </DialogHeader>
        <Field label="Used capacity (kg)" htmlFor="uc-used" error={error} required>
          <Input id="uc-used" type="number" min={0} value={used} onChange={(e) => setUsed(e.target.value)} aria-invalid={!!error} />
        </Field>
        {!error && <CapacityBar used={n} capacity={post.totalCapacityKg} label={`Available after update: ${kg(post.totalCapacityKg - n)}`} size="sm" />}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            disabled={!!error}
            onClick={() =>
              void act(() => update(post.id, n), () => {
                toast.success(`${post.id} updated`, { description: `${kg(post.totalCapacityKg - n)} available` });
                onClose();
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

