"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Gauge, HandCoins, Inbox, Info, Radio, Store, Truck, Undo2, Waypoints } from "lucide-react";
import type { BackhaulBookingRequest, BackhaulRequestStatus, LogisticsJob } from "@/types";
import { useAppStore } from "@/lib/store";
import { useListingViews } from "@/hooks/use-data";
import { checkRequest, REQUEST_STATUSES, requestStatus, type ListingView } from "@/lib/backhaul-marketplace";
import { placeLabel, shortArea, type MatchLabel } from "@/lib/load-board";
import { fmtDay, fmtRelative, fmtTime, kg, pct, peso, relativeDay } from "@/lib/format";
import { groupBy, sumBy } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState, FilterBar, FilterSelect, KPICard, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ListingCard, ShipperListingCard } from "./marketplace-parts";
import { PublishListingDialog, RequestSpaceDialog, ReviewRequestDialog } from "./marketplace-dialogs";

type Tab = "listings" | "requests" | "shipper";
const TABS: Tab[] = ["listings", "requests", "shipper"];

interface RequestRow {
  request: BackhaulBookingRequest;
  leg?: ListingView;
  job?: LogisticsJob;
  status: BackhaulRequestStatus;
  fit?: MatchLabel;
}

const legName = (v: ListingView) => `${v.truckLabel} · ${relativeDay(v.trip.date)}`;

export function BackhaulMarketplaceView({ initialTab, initialQ }: { initialTab?: string; initialQ?: string }) {
  const requests = useAppStore((s) => s.backhaulRequests);
  const jobs = useAppStore((s) => s.jobs);
  const views = useListingViews();

  const [tab, setTab] = React.useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "listings");
  const [q, setQ] = React.useState(initialQ ?? "");
  const [status, setStatus] = React.useState(initialQ ? "all" : "review");
  const [legFilter, setLegFilter] = React.useState("all");
  const [publishing, setPublishing] = React.useState<{ tripId?: string } | null>(null);
  const [reviewing, setReviewing] = React.useState<string | null>(null);
  const [requesting, setRequesting] = React.useState<string | null>(null);

  const legs = [...views.values()];
  const listed = legs.filter((v) => v.listing);
  const legByListing = new Map(listed.map((v) => [v.listing!.id, v]));
  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const rows: RequestRow[] = requests
    .map((request) => {
      const leg = legByListing.get(request.listingId);
      const job = request.jobId ? jobMap.get(request.jobId) : undefined;
      const st = requestStatus(request, job, leg?.status);
      return { request, leg, job, status: st, fit: st === "Requested" && leg ? checkRequest(request, leg).label : undefined };
    })
    .sort((a, b) => Number(b.status === "Requested") - Number(a.status === "Requested") || b.request.createdAt.localeCompare(a.request.createdAt));
  const waiting = rows.filter((r) => r.status === "Requested");
  const filtered = rows.filter((r) => (status === "all" || (status === "review" ? r.status === "Requested" : r.status === status)) && (legFilter === "all" || r.request.listingId === legFilter));

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const published = legs.filter((v) => v.status === "Published");
  const active = listed.filter((v) => v.status !== "Closed");
  const booked = legs.flatMap((v) => v.booked);
  const unlisted = legs.filter((v) => v.status === "Not Listed" && v.openKg >= 1000 && v.trip.status !== "Cancelled");

  const openReview = (id: string) => setReviewing(id);
  const showRequests = (listingId?: string) => {
    setTab("requests");
    setStatus("review");
    setLegFilter(listingId ?? "all");
  };

  const columns: ColumnDef<RequestRow, unknown>[] = [
    {
      id: "id",
      header: "Request",
      accessorFn: (r) => r.request.createdAt,
      cell: ({ row }) => (
        <div className="grid min-w-[7.5rem] gap-0.5">
          <span className="font-mono text-xs whitespace-nowrap">{row.original.request.id}</span>
          <span className="text-[11px] text-muted-foreground">{fmtRelative(row.original.request.createdAt)}</span>
        </div>
      ),
    },
    {
      id: "shipper",
      header: "Shipper",
      accessorFn: (r) => r.request.shipper.businessName,
      cell: ({ row }) => {
        const r = row.original.request;
        return (
          <div className="max-w-[170px] text-xs">
            <div className="truncate font-medium" title={r.shipper.businessName}>
              {r.shipper.businessName}
            </div>
            <div className="truncate text-muted-foreground">{r.shipper.contactName}</div>
            <a href={`tel:${r.shipper.phone.replace(/\s/g, "")}`} className="text-muted-foreground hover:underline">
              {r.shipper.phone}
            </a>
            {r.customerId && <div className="text-[11px] text-primary">Customer · {r.customerId}</div>}
          </div>
        );
      },
    },
    {
      id: "leg",
      header: "Return leg",
      accessorFn: (r) => r.leg?.trip.departure ?? "",
      cell: ({ row }) => {
        const v = row.original.leg;
        return v ? (
          <div className="text-xs whitespace-nowrap">
            <div className="font-medium">{legName(v)}</div>
            <Link href={`/trips/${v.trip.id}`} className="font-mono text-[11px] text-muted-foreground hover:text-primary hover:underline">
              {v.trip.id}
            </Link>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "route",
      header: "Pickup → drop-off",
      accessorFn: (r) => `${r.request.pickup.name} ${r.request.dropoff.name}`,
      cell: ({ row }) => {
        const r = row.original.request;
        return (
          <div className="max-w-[180px] text-xs">
            <div className="truncate font-medium" title={placeLabel(r.pickup)}>
              {placeLabel(r.pickup)}
            </div>
            <div className="truncate text-muted-foreground" title={placeLabel(r.dropoff)}>
              → {placeLabel(r.dropoff)}
            </div>
            <div className="text-[11px] text-muted-foreground">ready {fmtTime(r.readyAt)}</div>
          </div>
        );
      },
    },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (r) => r.request.weightKg,
      cell: ({ row }) => (
        <div className="max-w-[170px] text-xs">
          <div className="truncate" title={row.original.request.cargoDescription}>
            {row.original.request.cargoDescription}
          </div>
          <div className="text-muted-foreground">
            <b className="text-foreground tabular">{kg(row.original.request.weightKg)}</b> · {row.original.request.cargoCategory}
          </div>
          <div className="text-muted-foreground">
            Quote <b className="text-foreground tabular">{peso(row.original.request.quotedFreight)}</b>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status / fit",
      accessorFn: (r) => r.status,
      cell: ({ row }) => {
        const { status: st, job, request: r, fit } = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={st} />
            {fit && <StatusBadge status={fit} className="text-[11px]" />}
            {job && (
              <Link href={`/jobs/${job.id}`} className="text-xs font-medium text-primary hover:underline">
                {job.id}
              </Link>
            )}
            {st === "Declined" && r.declineReason && <span className="max-w-[160px] text-xs text-muted-foreground">{r.declineReason}</span>}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Button size="sm" variant={row.original.status === "Requested" ? "default" : "ghost"} onClick={() => openReview(row.original.request.id)} aria-label={`Open ${row.original.request.id}`}>
          {row.original.status === "Requested" ? "Review" : <Eye />}
        </Button>
      ),
    },
  ];

  const byDate = groupBy(legs, (v) => v.trip.date);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Future Modules" }, { label: "Backhaul Marketplace" }]}
        title={
          <span className="flex items-center gap-2">
            Backhaul Marketplace <Badge variant="info">Preview</Badge>
          </span>
        }
        description="List open space on our return legs to Lucena. Shippers see the route and pickup times, get an instant quote and request space. Dispatch confirms each request before it becomes a job on the trip."
        actions={
          <>
            <Button variant="outline" onClick={() => setTab("shipper")}>
              <Store /> Shipper view
            </Button>
            <Button onClick={() => setPublishing({})} disabled={!legs.some((v) => !v.listing && v.status !== "Departed")}>
              <Radio /> List a return leg
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KPICard label="Listed open space" value={kg(sumBy(published, (v) => v.openKg))} icon={Undo2} hint={`${published.length} return leg${published.length === 1 ? "" : "s"} taking requests`} />
        <KPICard label="Requests to review" value={waiting.length} icon={Inbox} hint={waiting.length ? `${kg(sumBy(waiting, (r) => r.request.weightKg))} · ${peso(sumBy(waiting, (r) => r.request.quotedFreight))} quoted` : "inbox clear"} tone={waiting.length ? "warning" : "success"} />
        <KPICard label="Booked via marketplace" value={kg(sumBy(booked, (b) => b.job.weightKg))} icon={HandCoins} hint={`${booked.length} shipment${booked.length === 1 ? "" : "s"} · ${peso(sumBy(booked, (b) => b.job.freightCharge))} freight`} />
        <KPICard label="Return fill on listed legs" value={pct(sumBy(active, (v) => v.usedKg) / Math.max(1, sumBy(active, (v) => v.totalKg)))} icon={Gauge} hint={`${kg(sumBy(active, (v) => v.openKg))} still empty`} />
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <span className="font-medium">Preview:</span> published legs also appear on the public{" "}
          <Link href="/return-trips" className="text-primary hover:underline">
            Return trips
          </Link>{" "}
          page, where shippers request space without an account. No online payment or bidding, and only our own trucks are listed. Open space is read from each trip&apos;s loads, so this page, the{" "}
          <Link href="/backhaul" className="text-primary hover:underline">
            Backhaul
          </Link>{" "}
          cards and the{" "}
          <Link href="/load-board?tab=capacity" className="text-primary hover:underline">
            Load Board
          </Link>{" "}
          always agree. Confirmed requests are billed like any other job.
        </div>
      </div>

      <Tabs value={tab} onValueChange={(t) => setTab(t as Tab)}>
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="listings">
            <Waypoints /> Return-leg listings
          </TabsTrigger>
          <TabsTrigger value="requests">
            <Inbox /> Booking requests
            <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{waiting.length}</span>
          </TabsTrigger>
          <TabsTrigger value="shipper">
            <Store /> Shipper view
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-6">
          {unlisted.length > 0 && (
            <Card className="gap-2 border-primary/30 bg-accent/20 p-4">
              <div className="text-sm font-semibold">Return space shippers can&apos;t see yet</div>
              <ul className="grid gap-2">
                {unlisted.map((v) => (
                  <li key={v.trip.id} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <b>{v.truckLabel}</b> · {relativeDay(v.trip.date)} has <b>{kg(v.openKg)}</b> open on {shortArea(v.leg.origin.areaId)} → Lucena.
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setPublishing({ tripId: v.trip.id })}>
                      <Radio /> List this leg
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {legs.length === 0 ? (
            <EmptyState icon={Truck} title="No return legs today or tomorrow." description="Plan a trip in Dispatch, then list its return space here." action={<Button asChild><Link href="/dispatch">Open Dispatch</Link></Button>} className="bg-card" />
          ) : (
            Object.entries(byDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, list]) => (
                <section key={date} aria-label={`Return legs ${fmtDay(date)}`}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    {relativeDay(date)} <span className="font-normal text-muted-foreground">{fmtDay(date)}</span>
                  </h2>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {list.map((v) => (
                      <ListingCard key={v.trip.id} v={v} onEdit={() => setPublishing({ tripId: v.trip.id })} onRequests={() => showRequests(v.listing?.id)} />
                    ))}
                  </div>
                </section>
              ))
          )}
        </TabsContent>

        <TabsContent value="requests">
          <Card className="overflow-hidden">
            <FilterBar search={q} onSearch={setQ} placeholder="Search request, shipper, cargo, place…">
              <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "review", label: "Needs review" }, { value: "all", label: "All statuses" }, ...REQUEST_STATUSES.map((s) => ({ value: s, label: s }))]} />
              <FilterSelect value={legFilter} onChange={setLegFilter} label="Return leg" className="w-full sm:w-48" options={[{ value: "all", label: "All return legs" }, ...listed.map((v) => ({ value: v.listing!.id, label: legName(v) }))]} />
            </FilterBar>
            <DataTable
              columns={columns}
              data={filtered}
              search={q}
              searchText={(r) => `${r.request.id} ${r.request.shipper.businessName} ${r.request.shipper.contactName} ${r.request.cargoDescription} ${r.request.cargoCategory} ${r.request.pickup.name} ${r.request.dropoff.name} ${r.leg?.trip.id ?? ""} ${r.leg?.truckLabel ?? ""} ${r.job?.id ?? ""} ${r.status}`}
              empty={<EmptyState icon={Inbox} title={status === "review" ? "No requests waiting for review." : "No requests match these filters."} description="Shipper requests from listed return legs land here. Try the Shipper view to send one." />}
              renderCard={(r) => (
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{r.request.id}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="font-medium">{r.request.shipper.businessName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.request.cargoDescription} · {kg(r.request.weightKg)} · {shortArea(r.request.pickup.areaId)} → {shortArea(r.request.dropoff.areaId)}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-1.5 text-xs">
                    <span>
                      {r.leg ? legName(r.leg) : "—"} · <b className="tabular">{peso(r.request.quotedFreight)}</b>
                    </span>
                    <Button size="sm" variant={r.status === "Requested" ? "default" : "outline"} onClick={() => openReview(r.request.id)}>
                      {r.status === "Requested" ? "Review" : "View"}
                    </Button>
                  </div>
                </div>
              )}
            />
          </Card>
        </TabsContent>

        <TabsContent value="shipper" className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm">
            <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium">What a trader or shipper sees</span> on the public{" "}
              <Link href="/return-trips" className="text-primary hover:underline">
                Return trips
              </Link>{" "}
              page. Only listed legs that still have space appear, with no trip numbers, plates, other cargo or revenue, and truck times as two-hour windows. Requests you send from here land in{" "}
              <button type="button" onClick={() => showRequests()} className="cursor-pointer text-primary hover:underline">
                Booking requests
              </button>
              .
            </span>
          </div>
          {published.length === 0 ? (
            <EmptyState icon={Truck} title="No return trips open for booking right now." description="List a return leg to make its space visible to shippers." className="bg-card" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {published.map((v) => (
                <ShipperListingCard key={v.trip.id} v={v} onRequest={() => setRequesting(v.trip.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-3 text-xs text-muted-foreground">Demo shippers, requests and rates are fictional and illustrative, not published tariffs.</p>

      {publishing && <PublishListingDialog tripId={publishing.tripId} onClose={() => setPublishing(null)} />}
      {reviewing && <ReviewRequestDialog requestId={reviewing} onClose={() => setReviewing(null)} />}
      {requesting && (
        <RequestSpaceDialog
          tripId={requesting}
          onClose={() => setRequesting(null)}
          onSubmitted={(id) => {
            setRequesting(null);
            setTab("requests");
            setStatus("review");
            setLegFilter("all");
            setQ(id);
          }}
        />
      )}
    </>
  );
}
