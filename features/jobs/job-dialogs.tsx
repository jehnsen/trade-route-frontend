"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, Ban, Truck } from "lucide-react";
import type { Leg, LogisticsJob, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useTripMetrics } from "@/hooks/use-data";
import { truckById, driverById } from "@/data/fleet";
import { canAddReturnCargo, isTripEditable, tripWarnings } from "@/lib/logistics";
import { tripRouteLine } from "@/lib/domain";
import { fmtDay, fmtTime, kg } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Textarea } from "@/components/ui/primitives";
import { Field } from "@/components/ui/form-controls";
import { CapacityBar } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";

/** Trips that can take cargo on the given leg around a pickup date. */
export function useCandidateTrips(leg: Leg, date: string) {
  const trips = useAppStore((s) => s.trips);
  const last = format(addDays(parseISO(date), 2), "yyyy-MM-dd");
  const first = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
  return trips.filter((t) => t.date >= first && t.date <= last && (leg === "return" ? canAddReturnCargo(t) : isTripEditable(t)));
}

export function AssignTripDialog({
  open,
  onOpenChange,
  title,
  leg,
  date,
  weightKg,
  currentTripId,
  onAssign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  leg: Leg;
  date: string;
  weightKg: number;
  currentTripId?: string;
  onAssign: (tripId: string | null) => void;
}) {
  const candidates = useCandidateTrips(leg, date);
  const metrics = useTripMetrics();
  const allTrips = useAppStore((s) => s.trips);
  const maintenance = useAppStore((s) => s.maintenance);
  const documents = useAppStore((s) => s.documents);
  const [selected, setSelected] = React.useState<string | undefined>(currentTripId);
  React.useEffect(() => setSelected(currentTripId), [currentTripId, open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kg(weightKg)} on the {leg === "outbound" ? "outbound" : "return (backhaul)"} leg · pickup {fmtDay(date)}. Capacity is the configured operational payload.
          </DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <div className="rounded-md bg-muted px-3 py-3 text-sm">
            No trips can take this cargo around {fmtDay(date)}.{" "}
            <Link href="/dispatch" className="font-medium text-primary hover:underline">
              Plan a trip on the Dispatch board
            </Link>
            .
          </div>
        ) : (
          <ul className="grid max-h-[60vh] gap-2 overflow-y-auto" role="radiogroup" aria-label="Trips">
            {candidates.map((t: Trip) => {
              const m = metrics.get(t.id)!;
              const already = currentTripId === t.id;
              const used = (leg === "outbound" ? m.outboundKg : m.returnKg) + (already ? 0 : weightKg);
              const over = used > m.capacityKg;
              const warn = tripWarnings(t, m, allTrips, maintenance, documents).filter((w) => w.kind !== "capacity");
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected === t.id}
                    onClick={() => setSelected(t.id)}
                    className={cn("grid w-full cursor-pointer gap-2 rounded-lg border p-3 text-left transition-colors", selected === t.id ? "border-primary bg-accent/40 ring-1 ring-primary" : "hover:bg-muted/40")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <Truck className="size-4 text-primary" /> {truckById(t.truckId).code} · {t.id}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {fmtDay(t.date)} · departs {fmtTime(t.actualDeparture ?? t.departure)} · {driverById(t.driverId).name}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{tripRouteLine(t)}</div>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <CapacityBar used={used} capacity={m.capacityKg} label={`${leg === "outbound" ? "Outbound" : "Return"} after assignment`} size="sm" />
                    {over && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-danger">
                        <AlertTriangle className="size-3.5" /> Exceeds configured payload by {kg(used - m.capacityKg)}
                      </div>
                    )}
                    {warn.map((w) => (
                      <div key={w.message} className="flex items-center gap-1.5 text-xs text-[oklch(0.5_0.13_65)]">
                        <AlertTriangle className="size-3.5" /> {w.message}
                      </div>
                    ))}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {currentTripId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onAssign(null);
                onOpenChange(false);
              }}
            >
              Remove from {currentTripId}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected || selected === currentTripId}
              onClick={() => {
                onAssign(selected!);
                onOpenChange(false);
              }}
            >
              <Truck /> Assign to trip
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignJobDialog({ job, open, onOpenChange }: { job: LogisticsJob; open: boolean; onOpenChange: (v: boolean) => void }) {
  const assign = useAppStore((s) => s.assignJobToTrip);
  const trips = useAppStore((s) => s.trips);
  return (
    <AssignTripDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Assign ${job.id} to a trip`}
      leg={job.leg}
      date={job.pickupAt.slice(0, 10)}
      weightKg={job.weightKg}
      currentTripId={job.tripId}
      onAssign={(tripId) => {
        assign(job.id, tripId);
        const t = trips.find((x) => x.id === tripId);
        if (t) toast.success(`${job.id} assigned to ${truckById(t.truckId).code}`, { description: `${t.id} · stops and deliveries updated` });
        else toast(`${job.id} moved back to unassigned`);
      }}
    />
  );
}

export function CancelJobDialog({ job, open, onOpenChange }: { job: LogisticsJob; open: boolean; onOpenChange: (v: boolean) => void }) {
  const cancel = useAppStore((s) => s.cancelJob);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {job.id}?</DialogTitle>
          <DialogDescription>This releases the cargo from {job.tripId ?? "dispatch"} and removes the delivery stop. Let the customer know through their usual channel.</DialogDescription>
        </DialogHeader>
        <Field label="Reason" htmlFor="cancel-reason" error={error} required>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Shipper's harvest moved to Monday" aria-invalid={!!error} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep job
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (reason.trim().length < 5) return setError("Give a short reason (at least 5 characters)");
              cancel(job.id, reason.trim());
              toast.success(`${job.id} cancelled`);
              onOpenChange(false);
            }}
          >
            <Ban /> Cancel job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
