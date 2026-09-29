"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, MapPin, Phone, Printer, Truck, UserRound } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { truckById, driverById } from "@/data/fleet";
import { DELIVERY_DONE, minutesLate } from "@/lib/logistics";
import { loadsSummary, tripRouteLine } from "@/lib/domain";
import { fmtDateTime, fmtDay, fmtTime, kg, unitQty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Separator } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Stat, Timeline, type TimelineItem } from "@/components/shared/common";
import { LoadTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import { PodCard } from "@/components/shared/pod";
import { RecordNotFound } from "@/components/shared/states";
import { PodDialog, ReportIssueDialog } from "./delivery-dialogs";

export function DeliveryDetail({ id }: { id: string }) {
  const d = useAppStore((s) => s.deliveries.find((x) => x.id === id));
  const job = useAppStore((s) => s.jobs.find((j) => j.id === d?.jobId));
  const trip = useAppStore((s) => s.trips.find((t) => t.id === d?.tripId));
  const customer = useAppStore((s) => s.customers.find((c) => c.id === d?.customerId));
  const allLoads = useAppStore((s) => s.loads);
  const markArrived = useAppStore((s) => s.markArrived);
  const [dialog, setDialog] = React.useState<"pod" | "upload" | "issue" | null>(null);
  if (!d || !job || !trip || !customer) return <RecordNotFound kind="Delivery" id={id} backHref="/deliveries" backLabel="Back to deliveries" />;

  const loads = allLoads.filter((l) => d.loadIds.includes(l.id));
  const truck = truckById(trip.truckId);
  const driver = driverById(trip.driverId);
  const stop = trip.stops.find((s) => s.unloaded.some((x) => d.loadIds.includes(x)));
  const open = !DELIVERY_DONE.includes(d.status);
  const onRoad = !!trip.actualDeparture && trip.status !== "Completed";
  const lateBy = minutesLate(job.requiredBy, d.arrivedAt ?? d.eta);

  const timeline: TimelineItem[] = [
    { at: fmtDateTime(job.createdAt), title: `Booked — ${job.id}`, meta: job.history[0]?.by },
    ...(job.history.find((e) => e.label.startsWith("Assigned")) ? [{ at: fmtDateTime(job.history.find((e) => e.label.startsWith("Assigned"))!.at), title: `Assigned to ${trip.id}`, meta: `${truck.code} · ${driver.name}` }] : []),
    ...(trip.actualDeparture ? [{ at: fmtDateTime(trip.actualDeparture), title: job.leg === "outbound" ? "Departed Lucena" : "Trip departed", meta: driver.name }] : []),
    ...(d.arrivedAt ? [{ at: fmtDateTime(d.arrivedAt), title: `Arrived at ${job.dropoff.name}`, meta: lateBy > 15 ? `${lateBy} min after required time` : "On time" }] : [{ at: `ETA ${fmtTime(d.eta)}`, title: `Arrival at ${job.dropoff.name}`, state: "pending" as const }]),
    ...d.issues.map((i) => ({ at: fmtDateTime(i.reportedAt), title: `Issue: ${i.type}`, meta: i.reportedBy, note: i.note, state: "failed" as const })),
    ...(d.pod ? [{ at: fmtDateTime(d.pod.signedAt), title: "Delivered — POD captured", meta: `${d.pod.receiptNo} · received by ${d.pod.receivedBy}` }] : d.status === "Failed" || d.status === "Returned" ? [{ at: "", title: d.status === "Returned" ? "Returned to Lucena" : "Delivery failed", note: d.failureReason, state: "failed" as const }] : [{ at: "", title: "Proof of delivery", state: "pending" as const }]),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Deliveries", href: "/deliveries" }, { label: d.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.id} <StatusBadge status={d.status} />
          </span>
        }
        description={
          <>
            <Link href={`/customers/${customer.id}`} className="font-medium text-foreground hover:underline">
              {customer.name}
            </Link>{" "}
            · {job.dropoff.name} · {fmtDay(trip.date)}
          </>
        }
        actions={
          <>
            {open && onRoad && d.status !== "Arrived" && (
              <Button size="sm" variant="outline" onClick={() => { markArrived(d.id); toast.success(`Arrived at ${job.dropoff.name}`); }}>
                <MapPin /> Mark arrived
              </Button>
            )}
            {open && onRoad && (
              <Button size="sm" variant="success" onClick={() => setDialog("pod")}>
                <CheckCircle2 /> Mark delivered
              </Button>
            )}
            {d.status === "Delivered" && (
              <Button size="sm" variant="outline" onClick={() => setDialog("upload")}>
                <Camera /> Upload POD
              </Button>
            )}
            {(open || d.status === "Delivered") && (
              <Button size="sm" variant="ghost" onClick={() => setDialog("issue")}>
                <AlertTriangle /> Report issue
              </Button>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/print/delivery-receipt/${d.id}`} target="_blank">
                <Printer /> Print DR
              </Link>
            </Button>
          </>
        }
      />
      {open && !onRoad && <div className="mb-4 rounded-lg border bg-info-soft px-4 py-2.5 text-sm">This drop is on {trip.id}, which has not departed yet ({trip.status}). Delivery actions unlock once the truck is dispatched.</div>}
      {d.failureReason && <div className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm">{d.failureReason}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Consignee & destination</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <div className="font-medium">{job.dropoff.name}</div>
                <div className="text-xs text-muted-foreground">{job.dropoff.address}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-start gap-2">
                <UserRound className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{job.consignee.name}</div>
                  <div className="text-xs text-muted-foreground">{job.consignee.phone}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${job.consignee.phone.replace(/\s/g, "")}`}>
                  <Phone /> Call
                </a>
              </Button>
            </div>
            {job.instructions && (
              <div className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                <span className="font-medium">Instructions: </span>
                {job.instructions}
              </div>
            )}
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="ETA" value={fmtTime(d.eta)} sub={fmtDay(d.eta)} />
              <Stat label="Required by" value={fmtTime(job.requiredBy)} sub={lateBy > 15 && open ? `ETA ${lateBy} min late` : undefined} />
              <Stat label="Actual arrival" value={d.arrivedAt ? fmtTime(d.arrivedAt) : "—"} />
              <Stat label="Completed" value={d.completedAt ? fmtTime(d.completedAt) : "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cargo</CardTitle>
            <Link href={`/jobs/${job.id}`} className="text-xs font-medium text-primary hover:underline">
              {job.id}
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {loads.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5">
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.cargoDescription}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.id} · {unitQty(l.quantity, l.unit)}
                  </div>
                </div>
                <div className="grid justify-items-end gap-1">
                  <span className="font-medium tabular">{kg(l.weightKg)}</span>
                  <LoadTypeBadge type={l.type} />
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground">Total {kg(job.weightKg)} · {loadsSummary(loads, 3)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip</CardTitle>
            <Link href={`/trips/${trip.id}`} className="text-xs font-medium text-primary hover:underline">
              {trip.id}
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                <Truck className="size-4" />
              </span>
              <div>
                <div className="font-medium">
                  {truck.code} · {truck.plateNo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {driver.name} · {driver.phone}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{tripRouteLine(trip)}</div>
            <div className="flex items-center justify-between text-xs">
              <span>Stop {stop?.seq ?? "—"} of {trip.stops.length}</span>
              <StatusBadge status={trip.status} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Booking to proof of delivery</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Timeline items={timeline} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Proof of delivery</CardTitle>
          </CardHeader>
          <CardContent>
            {d.pod ? (
              <PodCard pod={d.pod} title={job.consignee.name} subtitle={job.dropoff.name} />
            ) : (
              <EmptyState icon={Camera} title="No POD yet" description={open ? "Capture the recipient's signature, DR number and photos when the cargo is handed over." : "No POD for this drop."} />
            )}
          </CardContent>
        </Card>
      </div>

      {dialog === "pod" && <PodDialog delivery={d} open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "upload" && <PodDialog delivery={d} mode="upload" open onOpenChange={(v) => !v && setDialog(null)} />}
      {dialog === "issue" && <ReportIssueDialog delivery={d} open onOpenChange={(v) => !v && setDialog(null)} />}
    </>
  );
}
