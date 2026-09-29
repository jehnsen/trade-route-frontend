"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Boxes, Building2, MoreHorizontal, Plus, Truck } from "lucide-react";
import type { CargoCategory, Leg, Load, LoadStatus, LoadType } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { areaName, LUCENA_WAREHOUSE, PLACES } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { CARGO_CATEGORIES, CARGO_TYPES, cargoByKey } from "@/data/cargo";
import { ACTIVE_TRIP_STATUSES } from "@/lib/logistics";
import { fmtDay, kg, peso, unitQty } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui/primitives";
import { Combobox, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { CapacityBar, EmptyState, FilterBar, FilterSelect, PageHeader } from "@/components/shared/common";
import { LegBadge, LoadTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import { AssignJobDialog, AssignTripDialog } from "@/features/jobs/job-dialogs";

const LOAD_TYPES: LoadType[] = ["Outbound", "Backhaul", "Third-Party", "Company-Owned"];
const LOAD_STATUSES: LoadStatus[] = ["Pending", "Assigned", "Loaded", "In Transit", "Delivered", "Cancelled"];

export function LoadsView({ initialQ, initialTrip }: { initialQ?: string; initialTrip?: string }) {
  const loads = useAppStore((s) => s.loads);
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const assignLoad = useAppStore((s) => s.assignLoadToTrip);
  const customers = useCustomerMap();
  const metrics = useTripMetrics();
  const [q, setQ] = React.useState(initialQ ?? "");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("active");
  const [leg, setLeg] = React.useState("all");
  const [trip, setTrip] = React.useState(initialTrip ?? "all");
  const [adding, setAdding] = React.useState(false);
  const [assigning, setAssigning] = React.useState<Load | null>(null);

  const planTrips = trips.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status) || (t.status === "Planned" && t.date <= TOMORROW)).sort((a, b) => a.departure.localeCompare(b.departure));
  const filtered = loads.filter(
    (l) =>
      (type === "all" || l.type === type) &&
      (leg === "all" || l.leg === leg) &&
      (trip === "all" ? true : trip === "none" ? !l.tripId : l.tripId === trip) &&
      (status === "all" ? true : status === "active" ? l.status !== "Delivered" && l.status !== "Cancelled" : l.status === status),
  );
  const tripOptions = trips.filter((t) => t.date >= "2026-09-20").sort((a, b) => b.departure.localeCompare(a.departure));
  const assigningJob = assigning?.jobId ? jobs.find((j) => j.id === assigning.jobId) : undefined;

  const columns: ColumnDef<Load, unknown>[] = [
    { id: "id", header: "Load ID", accessorFn: (l) => l.id, cell: ({ row }) => <span className="font-mono text-xs whitespace-nowrap">{row.original.id}</span> },
    {
      id: "job",
      header: "Job / owner",
      accessorFn: (l) => l.jobId ?? "",
      cell: ({ row }) => {
        const l = row.original;
        return l.jobId ? (
          <div className="max-w-[190px]">
            <Link href={`/jobs/${l.jobId}`} className="text-xs font-medium text-primary hover:underline">
              {l.jobId}
            </Link>
            <div className="truncate text-xs text-muted-foreground">{customers.get(l.customerId ?? "")?.name}</div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="size-3.5" /> Company cargo
          </span>
        );
      },
    },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (l) => l.cargoDescription,
      cell: ({ row }) => (
        <div className="max-w-[210px]">
          <div className="truncate">{row.original.cargoDescription}</div>
          <div className="text-xs text-muted-foreground">
            {row.original.cargoCategory} · {unitQty(row.original.quantity, row.original.unit)}
          </div>
        </div>
      ),
    },
    { id: "kg", header: "Weight", accessorFn: (l) => l.weightKg, meta: { align: "right" }, cell: ({ row }) => <span className="font-medium">{kg(row.original.weightKg)}</span> },
    {
      id: "route",
      header: "Pickup → destination",
      accessorFn: (l) => `${l.pickup.name} ${l.destination.name}`,
      cell: ({ row }) => (
        <div className="max-w-[240px] text-xs">
          <div className="truncate">{row.original.pickup.name}</div>
          <div className="truncate text-muted-foreground">→ {row.original.destination.name}</div>
          <LegBadge leg={row.original.leg} />
        </div>
      ),
    },
    { id: "type", header: "Type", accessorFn: (l) => l.type, cell: ({ row }) => <LoadTypeBadge type={row.original.type} /> },
    {
      id: "trip",
      header: "Trip / truck",
      accessorFn: (l) => l.tripId ?? "",
      cell: ({ row }) => {
        const t = trips.find((x) => x.id === row.original.tripId);
        return t ? (
          <Link href={`/trips/${t.id}`} className="text-xs whitespace-nowrap hover:underline">
            <div className="font-medium">{truckById(t.truckId).code}</div>
            <div className="text-muted-foreground">{t.id}</div>
          </Link>
        ) : (
          <span className="text-xs font-medium text-[oklch(0.55_0.13_65)]">{row.original.status === "Cancelled" ? "—" : "Unassigned"}</span>
        );
      },
    },
    { id: "status", header: "Status", accessorFn: (l) => l.status, cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const l = row.original;
        if (l.status === "Delivered" || l.status === "Cancelled" || l.status === "In Transit") return null;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAssigning(l)}>
                <Truck /> {l.tripId ? "Change trip" : "Assign to trip"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Loads / Cargo"
        description="Every piece of cargo on or waiting for a truck — customer freight, backhaul, third-party and company-owned. Weights are gross (ice, boxes, sacks) against each van's configured payload."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add company cargo
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {planTrips.map((t) => {
          const m = metrics.get(t.id)!;
          const over = m.outboundKg > m.capacityKg || m.returnKg > m.capacityKg;
          return (
            <Card key={t.id} className="gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/trips/${t.id}`} className="font-semibold hover:underline">
                    {truckById(t.truckId).code}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {t.id} · {fmtDay(t.date)}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label={`Outbound · ${m.outboundLoads.length} loads`} size="sm" />
              <CapacityBar used={m.returnKg} capacity={m.capacityKg} label={`Return · ${m.returnLoads.length} loads`} size="sm" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Remaining out</div>
                  <div className="font-semibold tabular">{kg(m.capacityKg - m.outboundKg)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Remaining return</div>
                  <div className="font-semibold tabular">{kg(m.capacityKg - m.returnKg)}</div>
                </div>
              </div>
              {over && (
                <div className="flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-xs font-medium text-danger" role="alert">
                  <AlertTriangle className="size-3.5" /> Configured payload exceeded
                </div>
              )}
              <button type="button" onClick={() => setTrip(t.id)} className="cursor-pointer justify-self-start text-xs font-medium text-primary hover:underline">
                Show manifest
              </button>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <FilterBar search={q} onSearch={setQ} placeholder="Search load, job, cargo, customer, place…">
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "active", label: "Open loads" }, { value: "all", label: "All statuses" }, ...LOAD_STATUSES.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={type} onChange={setType} label="Load type" options={[{ value: "all", label: "All types" }, ...LOAD_TYPES.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={leg} onChange={setLeg} label="Leg" options={[{ value: "all", label: "Both legs" }, { value: "outbound", label: "Outbound" }, { value: "return", label: "Return leg" }]} />
          <FilterSelect value={trip} onChange={setTrip} label="Trip" className="w-full sm:w-56" options={[{ value: "all", label: "All trips" }, { value: "none", label: "Not on a trip" }, ...tripOptions.map((t) => ({ value: t.id, label: `${t.id} · ${truckById(t.truckId).code}` }))]} />
        </FilterBar>
        {trip !== "all" && trip !== "none" && metrics.get(trip) && (
          <div className="grid gap-2 border-b bg-muted/30 px-4 py-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Total payload</div>
              <div className="font-semibold tabular">{kg(sumBy(filtered, (l) => l.weightKg))}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Truck capacity</div>
              <div className="font-semibold tabular">{kg(metrics.get(trip)!.capacityKg)}</div>
            </div>
            <CapacityBar used={metrics.get(trip)!.outboundKg} capacity={metrics.get(trip)!.capacityKg} label="Outbound used" size="sm" />
            <CapacityBar used={metrics.get(trip)!.returnKg} capacity={metrics.get(trip)!.capacityKg} label="Return used" size="sm" />
          </div>
        )}
        <DataTable
          columns={columns}
          data={filtered}
          search={q}
          searchText={(l) => `${l.id} ${l.jobId ?? ""} ${l.cargoDescription} ${customers.get(l.customerId ?? "")?.name ?? "company"} ${l.pickup.name} ${l.destination.name} ${areaName(l.destination.areaId)} ${l.tripId ?? ""}`}
          initialSorting={[{ id: "id", desc: true }]}
          empty={<EmptyState icon={Boxes} title="No loads match these filters." description="Try All statuses or clear the trip filter." />}
          renderCard={(l) => (
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{l.id}</span>
                <StatusBadge status={l.status} />
              </div>
              <div className="font-medium">{l.cargoDescription}</div>
              <div className="text-xs text-muted-foreground">
                {l.pickup.name} → {l.destination.name}
              </div>
              <div className="flex items-center justify-between">
                <LoadTypeBadge type={l.type} />
                <span className="font-semibold tabular">{kg(l.weightKg)}</span>
              </div>
            </div>
          )}
        />
      </Card>

      <AddCompanyLoadDialog open={adding} onOpenChange={setAdding} />
      {assigning && assigningJob && <AssignJobDialog job={assigningJob} open onOpenChange={(v) => !v && setAssigning(null)} />}
      {assigning && !assigningJob && (
        <AssignTripDialog
          open
          onOpenChange={(v) => !v && setAssigning(null)}
          title={`Assign ${assigning.id} to a trip`}
          leg={assigning.leg}
          date={assigning.createdAt.slice(0, 10) < TODAY ? TODAY : assigning.createdAt.slice(0, 10)}
          weightKg={assigning.weightKg}
          currentTripId={assigning.tripId}
          onAssign={(tripId) => {
            assignLoad(assigning.id, tripId);
            toast.success(tripId ? `${assigning.id} added to ${tripId}` : `${assigning.id} removed from trip`);
          }}
        />
      )}
    </>
  );
}

const loadSchema = z.object({
  preset: z.string(),
  cargoDescription: z.string().trim().min(2, "Describe the cargo"),
  cargoCategory: z.enum(CARGO_CATEGORIES as [CargoCategory, ...CargoCategory[]]),
  quantity: z.number({ message: "Enter quantity" }).positive("Must be more than 0"),
  unit: z.string().trim().min(1, "Unit"),
  weightKg: z.number({ message: "Enter weight" }).positive("Must be more than 0").max(8500, "Exceeds one truck's configured payload"),
  leg: z.enum(["outbound", "return"]),
  pickup: z.string().min(1, "Choose pickup"),
  destination: z.string().min(1, "Choose destination"),
  estimatedValue: z.number().min(0).optional(),
  tripId: z.string(),
  handlingNotes: z.string().max(300).optional(),
});
type LoadValues = z.infer<typeof loadSchema>;

function AddCompanyLoadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useAppStore((s) => s.createCompanyLoad);
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const form = useForm<LoadValues>({
    resolver: zodResolver(loadSchema),
    defaultValues: { preset: "", cargoDescription: "", cargoCategory: "Produce", quantity: 0, unit: "sack", weightKg: 0, leg: "return", pickup: PLACES[4].name, destination: LUCENA_WAREHOUSE.name, estimatedValue: 0, tripId: "", handlingNotes: "" },
  });
  const { register, control, handleSubmit, setValue, watch, formState, reset } = form;
  const v = watch();
  const errors = formState.errors;
  const candidates = trips.filter((t) => (v.leg === "return" ? ["Planned", "Loading", "Ready", "Dispatched", "In Transit"] : ["Planned", "Loading", "Ready"]).includes(t.status) && t.date >= TODAY);
  const placeOptions = PLACES.map((p) => ({ value: p.name, label: p.name, hint: areaName(p.areaId) }));
  const onPreset = (key: string) => {
    const c = cargoByKey(key);
    setValue("preset", key);
    setValue("cargoDescription", c.label, { shouldValidate: true });
    setValue("cargoCategory", c.category);
    setValue("unit", c.unit);
    if (v.quantity) setValue("weightKg", Math.round(v.quantity * c.kgPerUnit));
    if (c.valuePerKg && v.weightKg) setValue("estimatedValue", Math.round(v.weightKg * c.valuePerKg));
  };
  const submit = handleSubmit((vals) => {
    const pickup = PLACES.find((p) => p.name === vals.pickup)!;
    const dest = PLACES.find((p) => p.name === vals.destination)!;
    const id = create({
      cargoDescription: vals.cargoDescription,
      cargoCategory: vals.cargoCategory,
      quantity: vals.quantity,
      unit: vals.unit,
      weightKg: vals.weightKg,
      leg: vals.leg as Leg,
      pickup: { name: pickup.name, areaId: pickup.areaId, address: pickup.address },
      destination: { name: dest.name, areaId: dest.areaId, address: dest.address },
      estimatedValue: vals.estimatedValue || undefined,
      handlingNotes: vals.handlingNotes || undefined,
      tripId: vals.tripId || undefined,
    });
    toast.success(`Company cargo ${id} added`, { description: vals.tripId ? `Assigned to ${vals.tripId}` : "Waiting for a trip on the Loads board." });
    reset();
    onOpenChange(false);
  });
  const tripM = v.tripId ? metrics.get(v.tripId) : undefined;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add company-owned cargo</DialogTitle>
          <DialogDescription>Produce bought for the Lucena bodega, returnable banyeras, or repositioning cargo. No purchase order needed — it is simply cargo on a trip.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Cargo type" htmlFor="cl-preset" className="sm:col-span-2">
            <Combobox id="cl-preset" options={CARGO_TYPES.map((c) => ({ value: c.key, label: c.label, hint: c.category }))} value={v.preset} onChange={onPreset} placeholder="Choose a common cargo type" />
          </Field>
          <Field label="Description" htmlFor="cl-desc" error={errors.cargoDescription?.message} required className="sm:col-span-2">
            <Input id="cl-desc" {...register("cargoDescription")} aria-invalid={!!errors.cargoDescription} />
          </Field>
          <Field label="Quantity" htmlFor="cl-qty" error={errors.quantity?.message} required>
            <Input id="cl-qty" type="number" min={0} {...register("quantity", { valueAsNumber: true, onChange: (e) => v.preset && setValue("weightKg", Math.round(Number(e.target.value) * cargoByKey(v.preset).kgPerUnit)) })} aria-invalid={!!errors.quantity} />
          </Field>
          <Field label="Unit" htmlFor="cl-unit" error={errors.unit?.message}>
            <Input id="cl-unit" {...register("unit")} />
          </Field>
          <Field label="Gross weight (kg)" htmlFor="cl-kg" error={errors.weightKg?.message} required>
            <Input id="cl-kg" type="number" min={0} {...register("weightKg", { valueAsNumber: true })} aria-invalid={!!errors.weightKg} />
          </Field>
          <Field label="Estimated value (₱)" htmlFor="cl-val" hint="Purchase value — reported as backhaul value, not freight revenue">
            <Input id="cl-val" type="number" min={0} {...register("estimatedValue", { valueAsNumber: true })} />
          </Field>
          <Field label="Leg" htmlFor="cl-leg">
            <Controller
              control={control}
              name="leg"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(x) => { field.onChange(x); setValue("tripId", ""); }}>
                  <SelectTrigger id="cl-leg">
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
          <Field label="Trip (optional)" htmlFor="cl-trip">
            <Controller
              control={control}
              name="tripId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(x) => field.onChange(x === "none" ? "" : x)}>
                  <SelectTrigger id="cl-trip">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Assign later</SelectItem>
                    {candidates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.id} · {truckById(t.truckId).code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Pickup" htmlFor="cl-pickup" error={errors.pickup?.message}>
            <Combobox id="cl-pickup" options={placeOptions} value={v.pickup} onChange={(x) => setValue("pickup", x)} />
          </Field>
          <Field label="Destination" htmlFor="cl-dest" error={errors.destination?.message}>
            <Combobox id="cl-dest" options={placeOptions} value={v.destination} onChange={(x) => setValue("destination", x)} />
          </Field>
          {tripM && (
            <div className="sm:col-span-2">
              <CapacityBar used={(v.leg === "return" ? tripM.returnKg : tripM.outboundKg) + (Number.isFinite(v.weightKg) ? v.weightKg : 0)} capacity={tripM.capacityKg} label="Capacity after adding" size="sm" />
            </div>
          )}
          <Field label="Handling notes" htmlFor="cl-notes" className="sm:col-span-2">
            <Textarea id="cl-notes" rows={2} {...register("handlingNotes")} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus /> Add cargo {Number.isFinite(v.estimatedValue) && v.estimatedValue ? `(${peso(v.estimatedValue)})` : ""}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CargoManifestCard({ title, description, loads, capacity, empty }: { title: string; description?: string; loads: Load[]; capacity: number; empty: string }) {
  const customers = useCustomerMap();
  const total = sumBy(loads, (l) => l.weightKg);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        <span className="text-sm font-semibold tabular">
          {kg(total)} <span className="font-normal text-muted-foreground">/ {kg(capacity)}</span>
        </span>
      </CardHeader>
      <CardContent className="grid gap-2">
        <CapacityBar used={total} capacity={capacity} showNumbers={false} />
        {loads.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {loads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.cargoDescription}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.id} · {l.jobId ? customers.get(l.customerId ?? "")?.name : "Company cargo"} · {unitQty(l.quantity, l.unit)} → {l.destination.name}
                  </div>
                </div>
                <div className="grid shrink-0 justify-items-end gap-1">
                  <span className="font-medium tabular">{kg(l.weightKg)}</span>
                  <LoadTypeBadge type={l.type} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
