"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Fuel } from "lucide-react";
import type { AreaId } from "@/types";
import { useAppStore } from "@/lib/store";
import { TODAY } from "@/data/company";
import { AREAS } from "@/data/areas";
import { DRIVERS, TRUCKS, truckById } from "@/data/fleet";
import { DEMO_DIESEL_PRICE, currentOdometer } from "@/lib/logistics";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { DatePicker, Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

const schema = z.object({
  truckId: z.string().min(1),
  tripId: z.string(),
  driverId: z.string().min(1, "Who fueled?"),
  date: z.string().min(10),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Enter a time"),
  odometerKm: z.number({ message: "Enter the odometer reading" }).positive("Enter the odometer reading"),
  liters: z.number({ message: "Enter litres" }).positive("Must be more than 0").max(400, "More than one tank — check the litres"),
  pricePerLiter: z.number({ message: "Enter price per litre" }).positive().max(150, "Check the price per litre"),
  station: z.string().trim().min(3, "Station name"),
  areaId: z.string().min(1),
  fullTank: z.boolean(),
  receiptRef: z.string().optional(),
});
type Values = z.infer<typeof schema>;

/** Log a diesel fill-up. Creates the fuel log and the matching Diesel trip expense. */
export function FuelLogDialog({ open, onOpenChange, tripId, truckId }: { open: boolean; onOpenChange: (v: boolean) => void; tripId?: string; truckId?: string }) {
  const add = useAppStore((s) => s.addFuelLog);
  const trips = useAppStore((s) => s.trips);
  const fuelLogs = useAppStore((s) => s.fuelLogs);
  const trip = tripId ? trips.find((t) => t.id === tripId) : undefined;
  const tId = trip?.truckId ?? truckId ?? "TRK-01";
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      truckId: tId,
      tripId: tripId ?? "",
      driverId: trip?.driverId ?? truckById(tId).primaryDriverId,
      date: TODAY,
      time: "08:00",
      odometerKm: currentOdometer(truckById(tId), trips, fuelLogs),
      liters: 0,
      pricePerLiter: DEMO_DIESEL_PRICE,
      station: "Petron — Diversion Rd., Lucena",
      areaId: "lucena",
      fullTank: true,
      receiptRef: "",
    },
  });
  const { register, control, handleSubmit, watch, formState, setValue } = form;
  const v = watch();
  const e = formState.errors;
  const truckTrips = trips.filter((t) => t.truckId === v.truckId && t.date >= "2026-09-18" && t.status !== "Cancelled").sort((a, b) => b.departure.localeCompare(a.departure));
  const minOdo = Math.max(0, ...fuelLogs.filter((f) => f.truckId === v.truckId).map((f) => f.odometerKm));
  const submit = handleSubmit((vals) => {
    if (vals.odometerKm < minOdo) {
      form.setError("odometerKm", { message: `Lower than the last fill-up (${minOdo.toLocaleString("en-PH")} km)` });
      return;
    }
    const id = add({ truckId: vals.truckId, tripId: vals.tripId || undefined, driverId: vals.driverId, date: `${vals.date}T${vals.time}`, odometerKm: vals.odometerKm, liters: vals.liters, pricePerLiter: vals.pricePerLiter, station: vals.station, areaId: vals.areaId as AreaId, fullTank: vals.fullTank, receiptRef: vals.receiptRef || undefined });
    toast.success(`Fuel log ${id} saved`, { description: `${vals.liters} L · ${peso(vals.liters * vals.pricePerLiter)} added as a Diesel expense${vals.tripId ? ` on ${vals.tripId}` : ""}.` });
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log fuel fill-up</DialogTitle>
          <DialogDescription>Full-tank fill-ups let TradeLoop compute km/L between fill-ups. The amount is recorded as a Diesel trip expense.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Truck" htmlFor="f-truck" required>
            <Controller
              control={control}
              name="truckId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(x) => {
                    field.onChange(x);
                    setValue("tripId", "");
                    setValue("odometerKm", currentOdometer(truckById(x), trips, fuelLogs));
                  }}
                  disabled={!!tripId}
                >
                  <SelectTrigger id="f-truck">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRUCKS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.code} · {t.plateNo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Trip" htmlFor="f-trip">
            <Controller
              control={control}
              name="tripId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(x) => field.onChange(x === "none" ? "" : x)} disabled={!!tripId}>
                  <SelectTrigger id="f-trip">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked to a trip</SelectItem>
                    {truckTrips.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.id} · {t.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Driver" htmlFor="f-driver" error={e.driverId?.message} required>
            <Controller
              control={control}
              name="driverId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="f-driver">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DRIVERS.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Date & time" htmlFor="f-date" required>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Controller control={control} name="date" render={({ field }) => <DatePicker id="f-date" value={field.value} onChange={field.onChange} />} />
              <Input type="time" aria-label="Time" {...register("time")} />
            </div>
          </Field>
          <Field label="Odometer (km)" htmlFor="f-odo" error={e.odometerKm?.message} required>
            <Input id="f-odo" type="number" {...register("odometerKm", { valueAsNumber: true })} aria-invalid={!!e.odometerKm} />
          </Field>
          <Field label="Litres" htmlFor="f-l" error={e.liters?.message} required>
            <Input id="f-l" type="number" step="0.1" {...register("liters", { valueAsNumber: true })} aria-invalid={!!e.liters} />
          </Field>
          <Field label="Price per litre (₱)" htmlFor="f-p" error={e.pricePerLiter?.message} required hint="Demo rate — enter the pump price">
            <Input id="f-p" type="number" step="0.01" {...register("pricePerLiter", { valueAsNumber: true })} />
          </Field>
          <Field label="Location" htmlFor="f-area">
            <Controller
              control={control}
              name="areaId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="f-area">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AREAS.filter((a) => !a.interIsland).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Fuel station" htmlFor="f-st" error={e.station?.message} required className="sm:col-span-2">
            <Input id="f-st" {...register("station")} />
          </Field>
          <Field label="Receipt no." htmlFor="f-ref">
            <Input id="f-ref" placeholder="Optional" {...register("receiptRef")} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm">
            <Controller control={control} name="fullTank" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(x) => field.onChange(!!x)} />} />
            Filled to full tank
          </label>
          <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2 text-sm sm:col-span-2">
            <span>Total cost</span>
            <span className="font-semibold tabular">{peso((Number.isFinite(v.liters) ? v.liters : 0) * (Number.isFinite(v.pricePerLiter) ? v.pricePerLiter : 0), true)}</span>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Fuel /> Save fuel log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
