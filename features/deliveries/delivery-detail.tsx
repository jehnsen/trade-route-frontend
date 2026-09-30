"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  CornerUpLeft,
  FileCheck2,
  Info,
  MapPin,
  Package,
  Phone,
  Printer,
  Truck,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { truckById, driverById } from "@/data/fleet";
import { DELIVERY_DONE, minutesLate } from "@/lib/logistics";
import { loadsSummary, tripRouteLine } from "@/lib/domain";
import { fmtDateTime, fmtDay, fmtTime, kg, unitQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/primitives";
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
  const late = lateBy > 15;
  const failed = d.status === "Failed" || d.status === "Returned";
  const assigned = job.history.find((e) => e.label.startsWith("Assigned"));

  const stages: Stage[] = [
    { label: "Booked", sub: fmtDateTime(job.createdAt), icon: ClipboardList, done: true },
    { label: "Dispatched", sub: trip.actualDeparture ? fmtDateTime(trip.actualDeparture) : `Planned ${fmtDay(trip.date)}`, icon: Truck, done: !!trip.actualDeparture },
    { label: "Arrived", sub: d.arrivedAt ? fmtTime(d.arrivedAt) : `ETA ${fmtTime(d.eta)}`, icon: MapPin, done: !!d.arrivedAt || !open },
    failed
      ? { label: d.status, sub: d.status === "Returned" ? "Back to Lucena" : "Not delivered", icon: d.status === "Returned" ? CornerUpLeft : XCircle, done: false, failed: true }
      : { label: "Delivered", sub: d.completedAt ? fmtTime(d.completedAt) : "Awaiting POD", icon: CheckCircle2, done: d.status === "Delivered" },
  ];

  const timeline: TimelineItem[] = [
    { at: fmtDateTime(job.createdAt), title: `Booked — ${job.id}`, meta: job.history[0]?.by },
    ...(assigned ? [{ at: fmtDateTime(assigned.at), title: `Assigned to ${trip.id}`, meta: `${truck.code} · ${driver.name}` }] : []),
    ...(trip.actualDeparture ? [{ at: fmtDateTime(trip.actualDeparture), title: job.leg === "outbound" ? "Departed Lucena" : "Trip departed", meta: driver.name }] : []),
    ...(d.arrivedAt ? [{ at: fmtDateTime(d.arrivedAt), title: `Arrived at ${job.dropoff.name}`, meta: late ? `${lateBy} min after required time` : "On time" }] : [{ at: `ETA ${fmtTime(d.eta)}`, title: `Arrival at ${job.dropoff.name}`, state: "pending" as const }]),
    ...d.issues.map((i) => ({ at: fmtDateTime(i.reportedAt), title: `Issue: ${i.type}`, meta: i.reportedBy, note: i.note, state: "failed" as const })),
    ...(d.pod ? [{ at: fmtDateTime(d.pod.signedAt), title: "Delivered — POD captured", meta: `${d.pod.receiptNo} · received by ${d.pod.receivedBy}` }] : failed ? [{ at: "", title: d.status === "Returned" ? "Returned to Lucena" : "Delivery failed", note: d.failureReason, state: "failed" as const }] : [{ at: "", title: "Proof of delivery", state: "pending" as const }]),
  ];

  const stopPct = stop ? Math.round((stop.seq / trip.stops.length) * 100) : 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Deliveries", href: "/deliveries" }, { label: d.id }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {d.id} <StatusBadge status={d.status} />
            {late && open && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                <Clock className="size-3" /> ETA {lateBy} min late
              </span>
            )}
          </span>
        }
        description={
          <>
            <Link href={`/customers/${customer.id}`} className="font-medium text-foreground hover:underline">
              {customer.name}
            </Link>
            {job.dropoff.name !== customer.name && <> · {job.dropoff.name}</>} · {fmtDay(trip.date)}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/print/delivery-receipt/${d.id}`} target="_blank">
                <Printer /> Print DR
              </Link>
            </Button>
            {(open || d.status === "Delivered") && (
              <Button size="sm" variant="outline" onClick={() => setDialog("issue")}>
                <AlertTriangle /> Report issue
              </Button>
            )}
            {d.status === "Delivered" && (
              <Button size="sm" variant="outline" onClick={() => setDialog("upload")}>
                <Camera /> Upload POD
              </Button>
            )}
            {open && onRoad && d.status !== "Arrived" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  markArrived(d.id);
                  toast.success(`Arrived at ${job.dropoff.name}`);
                }}
              >
                <MapPin /> Mark arrived
              </Button>
            )}
            {open && onRoad && (
              <Button size="sm" variant="success" onClick={() => setDialog("pod")}>
                <CheckCircle2 /> Mark delivered
              </Button>
            )}
          </>
        }
      />

      {open && !onRoad && (
        <Notice icon={Info} tone="info">
          This drop is on{" "}
          <Link href={`/trips/${trip.id}`} className="font-medium underline-offset-2 hover:underline">
            {trip.id}
          </Link>
          , which has not departed yet ({trip.status}). Delivery actions unlock once the truck is dispatched.
        </Notice>
      )}
      {d.failureReason && (
        <Notice icon={AlertTriangle} tone="danger">
          {d.failureReason}
        </Notice>
      )}

      <Card className="mb-4 px-4 py-5 sm:px-6">
        <StageTracker stages={stages} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardHeading icon={MapPin} title="Consignee & destination" />
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <div className="font-medium">{job.dropoff.name}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{job.dropoff.address}</div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{job.consignee.name}</div>
                  <div className="text-xs text-muted-foreground tabular">{job.consignee.phone}</div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${job.consignee.phone.replace(/\s/g, "")}`} aria-label={`Call ${job.consignee.name}`}>
                  <Phone /> Call
                </a>
              </Button>
            </div>
            {job.instructions && (
              <div className="rounded-lg border-l-2 border-primary/50 bg-muted/50 px-3 py-2 text-xs leading-relaxed">
                <div className="mb-0.5 font-medium text-foreground">Instructions</div>
                <span className="text-foreground/80">{job.instructions}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              <div className="bg-card p-3">
                <Stat label="ETA" value={fmtTime(d.eta)} sub={fmtDay(d.eta)} />
              </div>
              <div className={cn("p-3", late && open ? "bg-danger-soft" : "bg-card")}>
                <Stat label="Required by" value={fmtTime(job.requiredBy)} sub={late && open ? <span className="font-medium text-danger">ETA {lateBy} min late</span> : undefined} />
              </div>
              <div className="bg-card p-3">
                <Stat label="Actual arrival" value={d.arrivedAt ? fmtTime(d.arrivedAt) : "—"} sub={d.arrivedAt ? (late ? <span className="text-danger">{lateBy} min late</span> : "On time") : undefined} />
              </div>
              <div className="bg-card p-3">
                <Stat label="Completed" value={d.completedAt ? fmtTime(d.completedAt) : "—"} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeading icon={Package} title="Cargo" />
            <RecordLink href={`/jobs/${job.id}`}>{job.id}</RecordLink>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-2 text-sm">
            {loads.map((l) => (
              <div key={l.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 font-medium">{l.cargoDescription}</div>
                  <span className="shrink-0 font-semibold tabular">{kg(l.weightKg)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate text-xs text-muted-foreground">
                    <span className="font-mono">{l.id}</span> · {unitQty(l.quantity, l.unit)}
                  </div>
                  <LoadTypeBadge type={l.type} />
                </div>
              </div>
            ))}
            <div className="mt-auto flex items-baseline justify-between gap-3 border-t pt-3">
              <span className="text-xs text-muted-foreground">{loadsSummary(loads, 3)}</span>
              <span className="text-xs text-muted-foreground">
                Total <span className="text-sm font-semibold text-foreground tabular">{kg(job.weightKg)}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardHeading icon={Truck} title="Trip" />
            <RecordLink href={`/trips/${trip.id}`}>{trip.id}</RecordLink>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {truck.code} <span className="text-muted-foreground">·</span> {truck.plateNo}
                </div>
                <div className="text-xs text-muted-foreground">
                  {truck.make} {truck.model} · {kg(truck.capacityKg)} payload
                </div>
              </div>
              <StatusBadge status={trip.status} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{driver.name}</div>
                  <div className="text-xs text-muted-foreground tabular">Driver · {driver.phone}</div>
                </div>
              </div>
              <Button variant="outline" size="icon" className="size-8" asChild>
                <a href={`tel:${driver.phone.replace(/\s/g, "")}`} aria-label={`Call ${driver.name}`}>
                  <Phone />
                </a>
              </Button>
            </div>
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Route</span>
                <span className="font-medium tabular">{stop ? `Stop ${stop.seq} of ${trip.stops.length}` : `${trip.stops.length} stops`}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label="Stop position on route" aria-valuenow={stopPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${stopPct}%` }} />
              </div>
              <div className="text-xs leading-relaxed text-muted-foreground">{tripRouteLine(trip)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardHeading icon={Clock} title="Timeline" description="Booking to proof of delivery" />
          </CardHeader>
          <CardContent>
            <Timeline items={timeline} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardHeading icon={FileCheck2} title="Proof of delivery" />
            {d.pod && <StatusBadge status="Received" label="Captured" />}
          </CardHeader>
          <CardContent>
            {d.pod ? (
              <PodCard pod={d.pod} title={job.consignee.name} subtitle={job.dropoff.name} />
            ) : (
              <EmptyState
                icon={Camera}
                title="No POD yet"
                description={open ? "Capture the recipient's signature, DR number and photos when the cargo is handed over." : "No POD for this drop."}
                action={
                  open && onRoad ? (
                    <Button size="sm" variant="success" onClick={() => setDialog("pod")}>
                      <CheckCircle2 /> Mark delivered
                    </Button>
                  ) : undefined
                }
              />
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

interface Stage {
  label: string;
  sub: string;
  icon: LucideIcon;
  done: boolean;
  failed?: boolean;
}

function StageTracker({ stages }: { stages: Stage[] }) {
  const current = stages.findIndex((s) => !s.done && !s.failed);
  return (
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }} aria-label="Delivery progress">
      {stages.map((s, i) => {
        const state = s.failed ? "failed" : s.done ? "done" : i === current ? "current" : "pending";
        const Icon = state === "done" && i > 0 ? CheckCircle2 : s.icon;
        return (
          <li key={s.label} className="relative flex flex-col items-center text-center" aria-current={state === "current" ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute top-[18px] right-1/2 h-0.5 w-full -translate-y-1/2", stages[i - 1].done && state !== "pending" ? "bg-primary" : "bg-border")} aria-hidden />}
            <span
              className={cn(
                "relative z-10 flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary bg-card text-primary ring-4 ring-primary/15",
                state === "pending" && "border-border bg-card text-muted-foreground",
                state === "failed" && "border-danger bg-danger text-white",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className={cn("mt-2 text-xs font-semibold sm:text-sm", state === "pending" && "text-muted-foreground", state === "failed" && "text-danger")}>{s.label}</div>
            <div className="mt-0.5 hidden text-xs text-muted-foreground tabular sm:block">{s.sub}</div>
            <span className="sr-only">{state === "done" ? "completed" : state === "current" ? "in progress" : state === "failed" ? "failed" : "pending"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CardHeading({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </div>
    </div>
  );
}

function RecordLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 font-mono text-xs font-medium text-primary transition-colors hover:bg-accent">
      {children}
      <ArrowUpRight className="size-3" />
    </Link>
  );
}

function Notice({ icon: Icon, tone, children }: { icon: LucideIcon; tone: "info" | "danger"; children: React.ReactNode }) {
  return (
    <div className={cn("mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm", tone === "info" ? "border-info/30 bg-info-soft" : "border-danger/30 bg-danger-soft")} role={tone === "danger" ? "alert" : "status"}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "info" ? "text-[oklch(0.45_0.14_250)]" : "text-danger")} />
      <div>{children}</div>
    </div>
  );
}
