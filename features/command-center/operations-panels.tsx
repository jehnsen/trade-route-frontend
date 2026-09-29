"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  MapPin,
  PackageCheck,
  Route,
  Truck,
} from "lucide-react";
import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { driverById, truckById } from "@/data/fleet";
import { areaName } from "@/data/areas";
import { tripProgress } from "@/lib/logistics";
import { fmtDateShort, fmtTime, kg, pct, pesoCompact } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui/primitives";
import { EmptyState, CapacityBar } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { TrendArea } from "@/components/charts/charts";
import type { Trip } from "@/types";

function RouteDiagram({ trip }: { trip: Trip }) {
  const id = useId();
  // A sequence diagram of the actual planned stops, deliberately not a GPS map.
  const groups: { stop: Trip["stops"][number]; stops: Trip["stops"] }[] = [];
  for (const stop of trip.stops) {
    const last = groups[groups.length - 1];
    if (last && last.stop.location.areaId === stop.location.areaId)
      last.stops.push(stop);
    else groups.push({ stop, stops: [stop] });
  }
  const displayed = groups;
  const points = displayed.map((_, index) => ({
    x: 65 + index * (510 / Math.max(1, displayed.length - 1)),
    y: index % 2 === 0 ? 100 : 165,
  }));
  const path = points
    .map((point, index) =>
      index === 0
        ? `M ${point.x} ${point.y}`
        : `C ${point.x - 45} ${points[index - 1].y}, ${point.x - 40} ${point.y}, ${point.x} ${point.y}`,
    )
    .join(" ");
  return (
    <div className="route-board relative overflow-x-auto rounded-xl border border-[#e4e9dd]">
      <div className="absolute top-4 left-5 flex items-center gap-2 text-[10px] font-medium tracking-wider text-[#6d7d60] uppercase">
        <Route className="size-3.5" /> Planned route
      </div>
      <svg
        viewBox="0 0 640 255"
        className="block w-full min-w-[500px]"
        role="img"
        aria-labelledby={id}
      >
        <title
          id={id}
        >{`Planned stop sequence: ${displayed.map(({ stop }) => areaName(stop.location.areaId)).join(" to ")}. Schematic, not a geographic map.`}</title>
        <path
          d={path}
          stroke="#e0e8d9"
          strokeWidth="17"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={path}
          stroke="#71895c"
          strokeWidth="2"
          strokeDasharray="5 5"
          fill="none"
        />
        {displayed.map(({ stop, stops }, index) => {
          const point = points[index];
          const done = stops.every(
            (entry) =>
              entry.status === "Completed" || entry.status === "Skipped",
          );
          return (
            <g key={stop.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r="15"
                fill={done ? "#263e36" : "#fff"}
                stroke={done ? "#263e36" : "#9ab582"}
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={point.y + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={done ? "#d5efbd" : "#3a5230"}
              >
                {done ? "✓" : index + 1}
              </text>
              <text
                x={point.x}
                y={point.y + (index % 2 === 0 ? -30 : 34)}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#374b38"
              >
                {areaName(stop.location.areaId).replace(" City", "")}
              </text>
              <text
                x={point.x}
                y={point.y + (index % 2 === 0 ? -16 : 49)}
                textAnchor="middle"
                fontSize="9"
                fill="#74826c"
              >
                {stops.length > 1
                  ? `${stops.filter((entry) => entry.status === "Completed" || entry.status === "Skipped").length}/${stops.length} stops done`
                  : stop.type === "Warehouse"
                    ? "Home base"
                    : stop.type}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-3 left-5 right-5 flex justify-between gap-2 text-[9px] text-[#74826c]">
        <span>
          ● Completed <span className="ml-3">○ Upcoming</span>
        </span>
        <span>Route schematic · stop updates</span>
      </div>
    </div>
  );
}

export function FleetRoutes() {
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [selectedId, setSelectedId] = useState("");
  const today = trips.filter(
    (trip) => trip.date === TODAY && trip.status !== "Cancelled",
  );
  const selected = today.find((trip) => trip.id === selectedId) ?? today[0];
  const metric = selected ? metrics.get(selected.id) : undefined;
  const progress = selected ? tripProgress(selected) : undefined;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="items-center px-5 pt-5 sm:px-6">
        <div>
          <CardTitle>Fleet & route overview</CardTitle>
          <CardDescription>See where today&apos;s work stands.</CardDescription>
        </div>
        <Link
          href="/dispatch"
          className="flex items-center gap-1.5 text-xs font-medium text-primary"
        >
          Dispatch board <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="px-5 sm:px-6">
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Select a trip"
        >
          {today.map((trip) => (
            <button
              key={trip.id}
              type="button"
              aria-pressed={selected?.id === trip.id}
              onClick={() => setSelectedId(trip.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                selected?.id === trip.id
                  ? "border-[#263e36] bg-[#263e36] text-white"
                  : "bg-white text-muted-foreground hover:bg-muted",
              )}
            >
              <Truck className="size-3.5" />
              {truckById(trip.truckId).code}
              <span
                className={cn(
                  "ml-1 size-1.5 rounded-full",
                  selected?.id === trip.id ? "bg-[#c9ecaa]" : "bg-slate-400",
                )}
              />
            </button>
          ))}
        </div>
        {selected && metric && progress ? (
          <>
            <RouteDiagram trip={selected} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {driverById(selected.driverId).initials}
                </span>
                <div>
                  <div className="text-xs font-semibold">
                    {driverById(selected.driverId).name}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {truckById(selected.truckId).plateNo} · {progress.done}/
                    {progress.total} stops complete
                  </div>
                </div>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight className="size-3.5" /> Outbound load
                  </span>
                  <span className="font-semibold">{pct(metric.outUtil)}</span>
                </div>
                <CapacityBar
                  used={metric.outboundKg}
                  capacity={metric.capacityKg}
                  size="sm"
                  showNumbers={false}
                  className="[&>div:first-child:not([role])]:sr-only"
                />
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {kg(metric.outboundKg)} of {kg(metric.capacityKg)}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownLeft className="size-3.5" /> Return load
                  </span>
                  <span className="font-semibold">{pct(metric.retUtil)}</span>
                </div>
                <CapacityBar
                  used={metric.returnKg}
                  capacity={metric.capacityKg}
                  size="sm"
                  showNumbers={false}
                  className="[&>div:first-child:not([role])]:sr-only"
                />
                <Link
                  href="/backhaul"
                  className="mt-1.5 block text-[10px] text-primary hover:underline"
                >
                  {kg(Math.max(0, metric.capacityKg - metric.returnKg))}{" "}
                  available for backhaul →
                </Link>
              </div>
            </div>
            <Link
              href={`/trips/${selected.id}`}
              className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-[11px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <MapPin className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">
                  {progress.current
                    ? `At ${progress.current.location.name}`
                    : progress.next
                      ? `Next: ${progress.next.location.name}`
                      : "All planned stops completed"}
                </span>
              </span>
              <ArrowRight className="size-3.5 shrink-0" />
            </Link>
          </>
        ) : (
          <EmptyState
            icon={Truck}
            title="No trips scheduled today"
            description="Head to dispatch to plan your next trip."
            action={
              <Button asChild>
                <Link href="/dispatch">Open dispatch</Link>
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

const FILTERS = [
  "All deliveries",
  "In progress",
  "Delivered",
  "Exceptions",
] as const;

export function FreightDeliveries() {
  const deliveries = useAppStore((s) => s.deliveries);
  const trips = useAppStore((s) => s.trips);
  const jobs = useAppStore((s) => s.jobs);
  const customers = useCustomerMap();
  const [filter, setFilter] =
    useState<(typeof FILTERS)[number]>("All deliveries");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const tripMap = new Map(
    trips
      .filter((trip) => trip.date === TODAY && trip.status !== "Cancelled")
      .map((trip) => [trip.id, trip]),
  );
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const today = deliveries
    .filter((delivery) => tripMap.has(delivery.tripId))
    .sort((a, b) => a.eta.localeCompare(b.eta));
  const matches = (delivery: (typeof today)[number], value: string) =>
    value === "All deliveries" ||
    (value === "Delivered"
      ? delivery.status === "Delivered"
      : value === "Exceptions"
        ? ["Failed", "Returned"].includes(delivery.status) ||
          delivery.issues.length > 0
        : !["Delivered", "Failed", "Returned"].includes(delivery.status));
  const filtered = today.filter(
    (delivery) =>
      matches(delivery, filter) &&
      `${delivery.id} ${customers.get(delivery.customerId)?.name} ${jobMap.get(delivery.jobId)?.dropoff.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * 5, current * 5 + 5);
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-wrap items-center px-5 pt-5 sm:px-6">
        <div>
          <CardTitle className="flex items-center gap-2">
            Today&apos;s deliveries{" "}
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {today.length}
            </span>
          </CardTitle>
          <CardDescription>From loading bay to the last mile.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/deliveries">
            View all deliveries <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 sm:px-6">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Filter deliveries"
        >
          {FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
              className={cn(
                "min-h-9 cursor-pointer rounded-lg px-3 text-[11px] font-medium",
                value === filter
                  ? "bg-[#edf2e8] text-[#344d28]"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {value}{" "}
              <span className="ml-1 opacity-60">
                {today.filter((delivery) => matches(delivery, value)).length}
              </span>
            </button>
          ))}
        </div>
        <Input
          aria-label="Search today's deliveries"
          placeholder="Search customer or delivery…"
          className="w-full text-xs sm:w-56"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="ops-table w-full min-w-[700px] text-left text-xs">
          <thead>
            <tr className="border-y">
              <th className="pl-6">Shipment / customer</th>
              <th>Destination</th>
              <th>Vehicle</th>
              <th>Arrival</th>
              <th>Status</th>
              <th className="relative pr-6">
                <span className="sr-only">Open delivery</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((delivery) => {
              const job = jobMap.get(delivery.jobId);
              const trip = tripMap.get(delivery.tripId)!;
              return (
                <tr key={delivery.id} className="group hover:bg-muted/40">
                  <td className="pl-6 pr-5">
                    <Link
                      href={`/deliveries/${delivery.id}`}
                      className="font-semibold hover:text-primary hover:underline"
                    >
                      {delivery.id}
                    </Link>
                    <div className="mt-1.5 max-w-64 truncate text-[11px] text-muted-foreground">
                      {customers.get(delivery.customerId)?.name ?? "Customer"}
                    </div>
                  </td>
                  <td className="pr-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3 text-muted-foreground" />
                      {job ? areaName(job.dropoff.areaId) : "—"}
                    </div>
                    <div className="mt-1.5 max-w-44 truncate text-[10px] text-muted-foreground">
                      {job?.cargoDescription}
                    </div>
                  </td>
                  <td className="pr-4">
                    {truckById(trip.truckId).code}
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      {driverById(trip.driverId).name}
                    </div>
                  </td>
                  <td className="pr-4 tabular">
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="size-3 text-muted-foreground" />
                      {fmtTime(delivery.arrivedAt ?? delivery.eta)}
                    </span>
                    <span className="mt-1.5 block text-[10px] text-muted-foreground">
                      {delivery.arrivedAt ? "Actual arrival" : "Estimated"}
                    </span>
                  </td>
                  <td className="pr-4">
                    <StatusBadge status={delivery.status} icon={false} />
                  </td>
                  <td className="pr-6">
                    <Link
                      href={`/deliveries/${delivery.id}`}
                      aria-label={`View delivery ${delivery.id}`}
                      className="flex size-8 items-center justify-center rounded-lg border bg-white text-muted-foreground hover:text-primary"
                    >
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="p-5">
          <EmptyState
            icon={PackageCheck}
            title="No matching deliveries"
            description="Try another status or search term."
          />
        </div>
      )}
      <div className="flex items-center justify-between border-t px-5 py-3 sm:px-6">
        <p className="text-[11px] text-muted-foreground" role="status">
          {filtered.length
            ? `${current * 5 + 1}–${Math.min(current * 5 + 5, filtered.length)} of ${filtered.length} deliveries`
            : "0 deliveries"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Previous deliveries"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {current + 1} / {pages}
          </span>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Next deliveries"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function FreightPerformance() {
  const trips = useAppStore((s) => s.trips);
  const metrics = useTripMetrics();
  const [period, setPeriod] = useState(7);
  const dates = eachDayOfInterval({
    start: subDays(parseISO(TODAY), period),
    end: subDays(parseISO(TODAY), 1),
  });
  const rows = dates.map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const daily = trips
      .filter((trip) => trip.date === key && trip.status !== "Cancelled")
      .map((trip) => metrics.get(trip.id)!);
    return {
      date: key,
      revenue: sumBy(daily, (m) => m.revenue),
      contribution: sumBy(daily, (m) => m.contribution),
    };
  });
  const revenue = sumBy(rows, (row) => row.revenue);
  const contribution = sumBy(rows, (row) => row.contribution);
  return (
    <Card>
      <CardHeader className="flex-wrap items-center px-5 pt-5 sm:px-6">
        <div>
          <CardTitle>Freight performance</CardTitle>
          <CardDescription>
            {fmtDateShort(rows[0].date)} –{" "}
            {fmtDateShort(rows[rows.length - 1].date)} · completed calendar days
          </CardDescription>
        </div>
        <div
          className="flex gap-1 rounded-lg bg-muted p-1"
          role="group"
          aria-label="Performance period"
        >
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={period === days}
              onClick={() => setPeriod(days)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1.5 text-[10px] font-medium",
                period === days
                  ? "bg-white shadow-xs"
                  : "text-muted-foreground",
              )}
            >
              {days} days
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5 sm:px-6">
        <div className="mb-5 flex flex-wrap gap-8">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CircleDot className="size-3 text-[#547844]" /> Freight revenue
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular">
              {pesoCompact(revenue)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Check className="size-3 text-[#537bae]" /> Trip contribution
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular">
              {pesoCompact(contribution)}
            </div>
          </div>
        </div>
        <TrendArea
          data={rows}
          xKey="date"
          series={[
            { key: "revenue", name: "Freight revenue", color: "#63864d" },
            { key: "contribution", name: "Contribution", color: "#668ab7" },
          ]}
          height={210}
          xFormat={fmtDateShort}
          labelFormat={fmtDateShort}
        />
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Contribution is revenue less trip costs, including estimated diesel
          until a fill-up is logged.
        </p>
      </CardContent>
    </Card>
  );
}
