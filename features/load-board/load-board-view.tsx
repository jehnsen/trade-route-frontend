"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowRight, Boxes, CalendarCheck2, ClipboardCopy, ClipboardList, Eye, Handshake, Info, MoreHorizontal, PackageSearch, Plus, RotateCcw, Scale, Search, Truck, Undo2, Users, XCircle } from "lucide-react";
import type { AvailableLoad, AvailableLoadStatus, CapacityStatus, LogisticsJob } from "@/types";
import { useAppStore } from "@/lib/store";
import { useBoardMatches, useCapacityViews, useCustomerMap, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW } from "@/data/company";
import { AREAS, areaName } from "@/data/areas";
import { truckById } from "@/data/fleet";
import {
  CAPACITY_STATUSES,
  LOAD_BOARD_SOURCES,
  LOAD_STATUSES,
  OPEN_CAPACITY,
  REQUIRED_TRUCK_TYPES,
  TRUCK_TYPES,
  capacityShareMessage,
  isGoodMatch,
  loadShareMessage,
  loadStatus,
  needsTruck,
  placeLabel,
  routeLine,
  shortArea,
  unpostedReturnCapacity,
  type BoardMatch,
  type CapacityView,
} from "@/lib/load-board";
import { fmtRelative, fmtTime, kg, peso, relativeDay } from "@/lib/format";
import { sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/form-controls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { DataTable } from "@/components/data-table/data-table";
import { BoardSourceBadge, CapacityBar, EmptyState, FilterBar, FilterSelect, KPICard, PageHeader } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { copyShareMessage, MatchCount } from "./board-parts";
import { BookLoadDialog, MatchesDialog, type MatchTarget } from "./board-matching";
import { ClosePostDialog, PartnersDialog, PostCapacityDialog, PostLoadDialog, UpdateUsedDialog, type CapacityPreset } from "./board-forms";

interface LoadRow {
  load: AvailableLoad;
  job?: LogisticsJob;
  status: AvailableLoadStatus;
  open: boolean;
  matches: BoardMatch[];
}
interface CapacityRow {
  view: CapacityView;
  open: boolean;
  matches: BoardMatch[];
}

type Closing = { kind: "load"; id: string; status: Extract<AvailableLoadStatus, "Booked" | "Expired" | "Cancelled"> } | { kind: "capacity"; id: string; status: Extract<CapacityStatus, "Expired" | "Cancelled"> };

const when = (dt: string) => `${relativeDay(dt.slice(0, 10))} · ${fmtTime(dt)}`;
const isOurs = (l: AvailableLoad) => l.source === "Internal" || l.source === "Existing Customer";
const AREA_FILTER = [{ value: "all", label: "Any" }, ...AREAS.filter((a) => !a.interIsland).map((a) => ({ value: a.id, label: a.name }))];
const DATE_FILTER = [
  { value: "all", label: "Any date" },
  { value: TODAY, label: "Today (Sep 25)" },
  { value: TOMORROW, label: "Tomorrow (Sep 26)" },
];
const KG_FILTER = [
  { value: "0", label: "Any weight" },
  { value: "1000", label: "1,000 kg +" },
  { value: "2000", label: "2,000 kg +" },
  { value: "4000", label: "4,000 kg +" },
];

interface RowHandlers {
  find: (t: MatchTarget) => void;
  book: (b: { loadId: string; capacityId?: string }) => void;
  close: (c: Closing) => void;
  updateUsed: (capacityId: string) => void;
}

function LoadActions({ row, on }: { row: LoadRow; on: RowHandlers }) {
  const setLoadStatus = useAppStore((s) => s.setBoardLoadStatus);
  const { load: l, job, status: st, open } = row;
  const closed = st === "Expired" || st === "Cancelled" || (st === "Booked" && !job);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${l.id}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {open && (
          <DropdownMenuItem onSelect={() => on.find({ kind: "load", id: l.id })}>
            <Search /> Find trucks
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => copyShareMessage(loadShareMessage(l))}>
          <ClipboardCopy /> Copy share message
        </DropdownMenuItem>
        {job ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/jobs/${job.id}`}>
                <Eye /> View {job.id}
              </Link>
            </DropdownMenuItem>
            {job.tripId && (
              <DropdownMenuItem asChild>
                <Link href={`/trips/${job.tripId}`}>
                  <Truck /> View {job.tripId}
                </Link>
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <>
            {open && (
              <DropdownMenuItem onSelect={() => on.book({ loadId: l.id })}>
                <ClipboardList /> Create logistics job
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {st === "Looking for Truck" && (
              <DropdownMenuItem
                onSelect={() => {
                  setLoadStatus(l.id, "Matching");
                  toast(`${l.id} marked Matching`, { description: "You're talking to a trucker about it." });
                }}
              >
                <Handshake /> Mark matching
              </DropdownMenuItem>
            )}
            {(st === "Matching" || closed || st === "Reserved") && (
              <DropdownMenuItem
                onSelect={() => {
                  setLoadStatus(l.id, "Looking for Truck");
                  toast(`${l.id} back to Looking for Truck`);
                }}
              >
                <RotateCcw /> {closed ? "Reopen" : "Back to looking for truck"}
              </DropdownMenuItem>
            )}
            {!closed && (
              <>
                <DropdownMenuItem onSelect={() => on.close({ kind: "load", id: l.id, status: "Booked" })}>
                  <CalendarCheck2 /> Booked elsewhere
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => on.close({ kind: "load", id: l.id, status: "Expired" })}>
                  <Undo2 /> Mark expired
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => on.close({ kind: "load", id: l.id, status: "Cancelled" })}>
                  <XCircle /> Cancel post
                </DropdownMenuItem>
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CapacityActions({ row, on }: { row: CapacityRow; on: RowHandlers }) {
  const setCapacityStatus = useAppStore((s) => s.setCapacityStatus);
  const v = row.view;
  const p = v.post;
  const closed = p.status === "Cancelled" || p.status === "Expired";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.id}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {row.open && (
          <DropdownMenuItem onSelect={() => on.find({ kind: "capacity", id: p.id })}>
            <PackageSearch /> Find loads
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => copyShareMessage(capacityShareMessage(v))}>
          <ClipboardCopy /> Copy share message
        </DropdownMenuItem>
        {v.trip && (
          <DropdownMenuItem asChild>
            <Link href={`/trips/${v.trip.id}`}>
              <Truck /> View {v.trip.id}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {p.fleet === "external" && !closed && v.status !== "Departed" && (
          <>
            <DropdownMenuItem onSelect={() => on.updateUsed(p.id)}>
              <Scale /> Update used capacity
            </DropdownMenuItem>
            {p.status === "Full" ? (
              <DropdownMenuItem onSelect={() => setCapacityStatus(p.id, "Open")}>
                <RotateCcw /> Reopen — space available again
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={() => {
                  setCapacityStatus(p.id, "Full");
                  toast(`${p.id} marked full`);
                }}
              >
                <Boxes /> Mark full
              </DropdownMenuItem>
            )}
          </>
        )}
        {closed ? (
          <DropdownMenuItem onSelect={() => setCapacityStatus(p.id, "Open")}>
            <RotateCcw /> Reopen
          </DropdownMenuItem>
        ) : (
          v.status !== "Departed" && (
            <>
              <DropdownMenuItem onSelect={() => on.close({ kind: "capacity", id: p.id, status: "Expired" })}>
                <Undo2 /> Mark expired
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => on.close({ kind: "capacity", id: p.id, status: "Cancelled" })}>
                <XCircle /> Cancel post
              </DropdownMenuItem>
            </>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LoadBoardView({ initialTab, initialQ }: { initialTab?: string; initialQ?: string }) {
  const boardLoads = useAppStore((s) => s.boardLoads);
  const boardCapacity = useAppStore((s) => s.boardCapacity);
  const jobs = useAppStore((s) => s.jobs);
  const trips = useAppStore((s) => s.trips);
  const setLoadStatus = useAppStore((s) => s.setBoardLoadStatus);
  const setCapacityStatus = useAppStore((s) => s.setCapacityStatus);
  const views = useCapacityViews();
  const { byLoad, byCapacity } = useBoardMatches();
  const metrics = useTripMetrics();
  const customers = useCustomerMap();
  const partners = useAppStore((s) => s.truckingPartners);

  const [tab, setTab] = React.useState<"loads" | "capacity">(initialTab === "capacity" ? "capacity" : "loads");
  const [q, setQ] = React.useState(initialQ ?? "");
  const [status, setStatus] = React.useState("open");
  const [source, setSource] = React.useState("all");
  const [pickup, setPickup] = React.useState("all");
  const [dest, setDest] = React.useState("all");
  const [date, setDate] = React.useState("all");
  const [truck, setTruck] = React.useState("all");
  const [fleet, setFleet] = React.useState("all");
  const [minKg, setMinKg] = React.useState("0");

  const [postingLoad, setPostingLoad] = React.useState(false);
  const [postingCapacity, setPostingCapacity] = React.useState<{ preset?: CapacityPreset } | null>(null);
  const [partnersOpen, setPartnersOpen] = React.useState(false);
  const [matchTarget, setMatchTarget] = React.useState<MatchTarget | null>(null);
  const [booking, setBooking] = React.useState<{ loadId: string; capacityId?: string } | null>(null);
  const [closing, setClosing] = React.useState<Closing | null>(null);
  const [updatingUsed, setUpdatingUsed] = React.useState<string | null>(null);

  const handlers: RowHandlers = { find: setMatchTarget, book: setBooking, close: setClosing, updateUsed: setUpdatingUsed };

  const switchTab = (t: string) => {
    setTab(t === "capacity" ? "capacity" : "loads");
    setStatus("open");
    setTruck("all");
  };

  // ─── Rows ───────────────────────────────────────────────────────────────
  const jobMap = React.useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const loadRows: LoadRow[] = boardLoads
    .map((load) => {
      const job = load.jobId ? jobMap.get(load.jobId) : undefined;
      const st = loadStatus(load, job);
      return { load, job, status: st, open: needsTruck(load, st), matches: byLoad.get(load.id) ?? [] };
    })
    .sort((a, b) => Number(b.open) - Number(a.open) || (a.open ? a.load.pickupAt.localeCompare(b.load.pickupAt) : b.load.createdAt.localeCompare(a.load.createdAt)));
  const capacityRows: CapacityRow[] = [...views.values()]
    .map((view) => ({ view, open: OPEN_CAPACITY.includes(view.status), matches: byCapacity.get(view.post.id) ?? [] }))
    .sort((a, b) => Number(b.open) - Number(a.open) || a.view.departureAt.localeCompare(b.view.departureAt));

  const min = Number(minKg);
  const filteredLoads = loadRows.filter(
    ({ load: l, status: st, open }) =>
      (status === "all" || (status === "open" ? open : st === status)) &&
      (source === "all" || l.source === source) &&
      (pickup === "all" || l.pickup.areaId === pickup) &&
      (dest === "all" || l.destination.areaId === dest) &&
      (date === "all" || l.pickupAt.startsWith(date)) &&
      (truck === "all" || l.truckType === truck) &&
      (fleet === "all" || (fleet === "internal") === isOurs(l)) &&
      l.weightKg >= min,
  );
  const filteredCapacity = capacityRows.filter(
    ({ view: v, open }) =>
      (status === "all" || (status === "open" ? open : v.status === status)) &&
      (source === "all" || v.post.source === source) &&
      (pickup === "all" || (v.routeAreas.slice(0, -1) as string[]).includes(pickup)) &&
      (dest === "all" || (v.routeAreas.slice(1) as string[]).includes(dest)) &&
      (date === "all" || v.departureAt.startsWith(date)) &&
      (truck === "all" || v.truckType === truck) &&
      (fleet === "all" || (fleet === "internal") === v.internal) &&
      v.availableKg >= min,
  );

  // ─── KPIs ───────────────────────────────────────────────────────────────
  const openLoads = loadRows.filter((r) => r.open);
  const openCaps = capacityRows.filter((r) => r.open);
  const internalOpen = openCaps.filter((r) => r.view.internal);
  const goodPairs = [...byLoad.values()].flat().filter(isGoodMatch);
  const coveredLoads = openLoads.filter((r) => r.matches.some(isGoodMatch)).length;
  const bookedToday = loadRows.filter((r) => r.load.bookedAt?.startsWith(TODAY) && (r.status === "Booked" || r.status === "Reserved"));
  const unposted = unpostedReturnCapacity(trips, metrics, boardCapacity, [TODAY, TOMORROW]);

  // ─── Columns ────────────────────────────────────────────────────────────
  const loadColumns: ColumnDef<LoadRow, unknown>[] = [
    {
      id: "id",
      header: "Opportunity",
      accessorFn: (r) => r.load.id,
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-xs whitespace-nowrap">{row.original.load.id}</span>
          <BoardSourceBadge source={row.original.load.source} />
          <span className="text-[11px] text-muted-foreground">{fmtRelative(row.original.load.createdAt)}</span>
        </div>
      ),
    },
    {
      id: "route",
      header: "Pickup → destination",
      accessorFn: (r) => `${r.load.pickup.name} ${r.load.destination.name}`,
      cell: ({ row }) => (
        <div className="max-w-[220px] text-xs">
          <div className="truncate font-medium" title={placeLabel(row.original.load.pickup)}>
            {placeLabel(row.original.load.pickup)}
          </div>
          <div className="truncate text-muted-foreground" title={placeLabel(row.original.load.destination)}>
            → {placeLabel(row.original.load.destination)}
          </div>
        </div>
      ),
    },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (r) => r.load.weightKg,
      cell: ({ row }) => (
        <div className="max-w-[190px]">
          <div className="truncate">{row.original.load.cargoDescription}</div>
          <div className="text-xs text-muted-foreground">
            <b className="text-foreground tabular">{kg(row.original.load.weightKg)}</b> · {row.original.load.cargoCategory}
          </div>
        </div>
      ),
    },
    { id: "truck", header: "Truck needed", accessorFn: (r) => r.load.truckType, cell: ({ row }) => <span className="text-xs whitespace-nowrap">{row.original.load.truckType}</span> },
    {
      id: "pickup",
      header: "Pickup",
      accessorFn: (r) => r.load.pickupAt,
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          <div className="font-medium">{when(row.original.load.pickupAt)}</div>
          {row.original.load.deliveryBy && <div className="text-muted-foreground">deliver by {when(row.original.load.deliveryBy)}</div>}
        </div>
      ),
    },
    { id: "freight", header: "Offered", accessorFn: (r) => r.load.offeredFreight ?? 0, meta: { align: "right" }, cell: ({ row }) => (row.original.load.offeredFreight ? <span className="tabular">{peso(row.original.load.offeredFreight)}</span> : <span className="text-xs text-muted-foreground">Not stated</span>) },
    {
      id: "contact",
      header: "Contact",
      accessorFn: (r) => r.load.contact.name,
      cell: ({ row }) => {
        const l = row.original.load;
        const org = l.customerId ? customers.get(l.customerId)?.name : partners.find((p) => p.id === l.partnerId)?.name;
        return (
          <div className="max-w-[170px] text-xs">
            <div className="truncate font-medium">{l.contact.name}</div>
            {org && org !== l.contact.name && <div className="truncate text-muted-foreground">{org}</div>}
            <a href={`tel:${l.contact.phone.replace(/\s/g, "")}`} className="text-muted-foreground hover:underline">
              {l.contact.phone}
            </a>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.status,
      cell: ({ row }) => {
        const { load: l, job, status: st } = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={st} />
            {job && (
              <Link href={`/jobs/${job.id}`} className="text-xs font-medium text-primary hover:underline">
                {job.id}
                {job.tripId ? ` · ${job.tripId}` : ""}
              </Link>
            )}
            {!job && l.capacityId && st === "Reserved" && <span className="text-xs text-muted-foreground">on {l.capacityId}</span>}
            {l.closedReason && (st === "Cancelled" || st === "Booked") && <span className="max-w-[160px] text-xs text-muted-foreground">{l.closedReason}</span>}
          </div>
        );
      },
    },
    { id: "matches", header: "Possible matches", enableSorting: false, cell: ({ row }) => <MatchCount matches={row.original.matches} disabled={!row.original.open} onOpen={() => setMatchTarget({ kind: "load", id: row.original.load.id })} /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, cell: ({ row }) => <LoadActions row={row.original} on={handlers} /> },
  ];

  const capacityColumns: ColumnDef<CapacityRow, unknown>[] = [
    {
      id: "id",
      header: "Availability",
      accessorFn: (r) => r.view.post.id,
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono text-xs whitespace-nowrap">{row.original.view.post.id}</span>
          <BoardSourceBadge source={row.original.view.post.source} />
        </div>
      ),
    },
    {
      id: "truck",
      header: "Truck / partner",
      accessorFn: (r) => r.view.truckLabel,
      cell: ({ row }) => {
        const v = row.original.view;
        return (
          <div className="max-w-[190px] text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {v.internal && v.trip && <span className="size-2 shrink-0 rounded-full" style={{ background: truckById(v.trip.truckId).color }} aria-hidden />}
              <span className="truncate">{v.truckLabel}</span>
            </div>
            <div className="text-muted-foreground">{v.truckType}</div>
            {v.internal && v.trip ? (
              <Link href={`/trips/${v.trip.id}`} className="text-primary hover:underline">
                Our fleet · {v.trip.id}
              </Link>
            ) : (
              <span className="text-muted-foreground">Partner truck</span>
            )}
          </div>
        );
      },
    },
    {
      id: "route",
      header: "Route",
      accessorFn: (r) => routeLine(r.view),
      cell: ({ row }) => (
        <div className="max-w-[220px] text-xs">
          <div className="font-medium">{routeLine(row.original.view)}</div>
          <div className="truncate text-muted-foreground">Now: {row.original.view.currentLocation}</div>
        </div>
      ),
    },
    {
      id: "capacity",
      header: "Capacity",
      accessorFn: (r) => r.view.availableKg,
      cell: ({ row }) => {
        const v = row.original.view;
        return (
          <div className="grid w-44 gap-1">
            <CapacityBar used={v.usedKg} capacity={v.totalKg} showNumbers={false} size="sm" />
            <div className="text-xs">
              <b className="tabular">{kg(v.availableKg)}</b> free <span className="text-muted-foreground">of {kg(v.totalKg)}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "departure",
      header: "Departure",
      accessorFn: (r) => r.view.departureAt,
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          <div className="font-medium">{when(row.original.view.departureAt)}</div>
          <div className="text-muted-foreground">arrives ~{fmtTime(row.original.view.arrivalAt)}</div>
        </div>
      ),
    },
    {
      id: "accepts",
      header: "Accepts",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original.view.post;
        return (
          <div className="max-w-[160px] text-xs">
            <div>{p.acceptedCargo.length ? p.acceptedCargo.join(", ") : "Any cargo"}</div>
            {p.restrictions && (
              <div className="truncate text-muted-foreground" title={p.restrictions}>
                {p.restrictions}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "contact",
      header: "Contact",
      accessorFn: (r) => r.view.post.contact.name,
      cell: ({ row }) => {
        const c = row.original.view.post.contact;
        return (
          <div className="text-xs whitespace-nowrap">
            <div className="font-medium">{c.name}</div>
            <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="text-muted-foreground hover:underline">
              {c.phone}
            </a>
          </div>
        );
      },
    },
    { id: "status", header: "Status", accessorFn: (r) => r.view.status, cell: ({ row }) => <StatusBadge status={row.original.view.status} /> },
    { id: "matches", header: "Possible loads", enableSorting: false, cell: ({ row }) => <MatchCount matches={row.original.matches} disabled={!row.original.open} onOpen={() => setMatchTarget({ kind: "capacity", id: row.original.view.post.id })} /> },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, cell: ({ row }) => <CapacityActions row={row.original} on={handlers} /> },
  ];

  const statusOptions = tab === "loads" ? LOAD_STATUSES : CAPACITY_STATUSES;
  const truckOptions: readonly string[] = tab === "loads" ? REQUIRED_TRUCK_TYPES : TRUCK_TYPES;
  const loadSearch = (r: LoadRow) => `${r.load.id} ${r.load.source} ${r.load.sourceReference ?? ""} ${r.load.cargoDescription} ${r.load.cargoCategory} ${r.load.pickup.name} ${areaName(r.load.pickup.areaId)} ${r.load.destination.name} ${areaName(r.load.destination.areaId)} ${r.load.contact.name} ${r.load.jobId ?? ""} ${r.status}`;
  const capacitySearch = (r: CapacityRow) => `${r.view.post.id} ${r.view.post.source} ${r.view.truckLabel} ${r.view.truckType} ${routeLine(r.view)} ${r.view.routeAreas.map(areaName).join(" ")} ${r.view.post.contact.name} ${r.view.trip?.id ?? ""} ${r.view.status}`;

  return (
    <>
      <PageHeader
        title="Load Board"
        description="Loads and truck space shared in Messenger / Viber GCs, Facebook groups and direct calls — logged in one place and matched against our trips."
        actions={
          <>
            <Button variant="outline" onClick={() => setPartnersOpen(true)}>
              <Users /> Partners
            </Button>
            <Button variant="outline" onClick={() => setPostingCapacity({})}>
              <Truck /> Post available capacity
            </Button>
            <Button onClick={() => setPostingLoad(true)}>
              <Plus /> Post available load
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPICard label="Open loads" value={openLoads.length} icon={Boxes} hint={`${kg(sumBy(openLoads, (r) => r.load.weightKg))} needs a truck`} tone={openLoads.length ? "warning" : "success"} />
        <KPICard label="Available trucks" value={openCaps.length} icon={Truck} hint={`${internalOpen.length} ours · ${openCaps.length - internalOpen.length} partners`} />
        <KPICard label="Available internal capacity" value={kg(sumBy(internalOpen, (r) => r.view.availableKg))} icon={Undo2} hint={`across ${internalOpen.length} posted trip leg${internalOpen.length === 1 ? "" : "s"}`} />
        <KPICard label="Potential matches" value={goodPairs.length} icon={Handshake} hint={`${goodPairs.filter((m) => m.label === "Strong Match").length} strong · ${coveredLoads} of ${openLoads.length} loads covered`} />
        <KPICard label="Booked today" value={bookedToday.length} icon={CalendarCheck2} hint={bookedToday.length ? `${kg(sumBy(bookedToday, (r) => r.load.weightKg))} moved to jobs / trucks` : "nothing booked yet today"} tone={bookedToday.length ? "success" : "default"} className="col-span-2 md:col-span-1" />
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-lg border bg-card px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <span className="font-medium">Load Board vs Backhaul:</span> the board holds offers that are <b>not yet on a trip</b>. Booking a load onto our truck makes it a{" "}
          <Link href="/jobs" className="text-primary hover:underline">
            Logistics Job
          </Link>{" "}
          + Load on the{" "}
          <Link href="/trips" className="text-primary hover:underline">
            Trip
          </Link>
          ; return-leg cargo then shows on{" "}
          <Link href="/backhaul" className="text-primary hover:underline">
            Backhaul
          </Link>{" "}
          and the truck&apos;s remaining space here drops automatically.
        </div>
      </div>

      {unposted.length > 0 && (
        <Card className="mb-4 gap-2 border-primary/30 bg-accent/20 p-4">
          <div className="text-sm font-semibold">Return space not on the board yet</div>
          <ul className="grid gap-2">
            {unposted.map(({ trip, availableKg }) => (
              <li key={trip.id} className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <b>{truckById(trip.truckId).code}</b> ·{" "}
                  <Link href={`/trips/${trip.id}`} className="hover:underline">
                    {trip.id}
                  </Link>{" "}
                  ({relativeDay(trip.date)}) has <b>{kg(availableKg)}</b> unused return capacity.
                </span>
                <Button size="sm" variant="outline" onClick={() => setPostingCapacity({ preset: { tripId: trip.id, leg: "return" } })}>
                  <Truck /> Post capacity <ArrowRight />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 pt-3">
          <Tabs value={tab} onValueChange={switchTab}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="loads">
                <Boxes /> Available loads
                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{openLoads.length}</span>
              </TabsTrigger>
              <TabsTrigger value="capacity">
                <Truck /> Truck capacity
                <span className="rounded-full bg-muted-foreground/10 px-1.5 text-[10.5px] tabular">{openCaps.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <FilterBar search={q} onSearch={setQ} placeholder={tab === "loads" ? "Search load, cargo, place, contact…" : "Search truck, partner, route, contact…"}>
          <FilterSelect value={status} onChange={setStatus} label="Status" options={[{ value: "open", label: tab === "loads" ? "Needs a truck" : "Open space" }, { value: "all", label: "All statuses" }, ...statusOptions.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={source} onChange={setSource} label="Source" options={[{ value: "all", label: "All sources" }, ...LOAD_BOARD_SOURCES.map((s) => ({ value: s, label: s }))]} />
          <FilterSelect value={pickup} onChange={setPickup} label={tab === "loads" ? "Pickup" : "Passes (can pick up in)"} className="w-full sm:w-40" options={AREA_FILTER.map((o) => (o.value === "all" ? { ...o, label: tab === "loads" ? "Any pickup" : "Any pickup area" } : o))} />
          <FilterSelect value={dest} onChange={setDest} label="Destination" className="w-full sm:w-40" options={AREA_FILTER.map((o) => (o.value === "all" ? { ...o, label: "Any destination" } : o))} />
          <FilterSelect value={date} onChange={setDate} label={tab === "loads" ? "Pickup date" : "Departure date"} className="w-full sm:w-40" options={DATE_FILTER} />
          <FilterSelect value={truck} onChange={setTruck} label="Truck type" options={[{ value: "all", label: "Any truck type" }, ...truckOptions.map((t) => ({ value: t, label: t }))]} />
          <FilterSelect value={fleet} onChange={setFleet} label="Internal / external" className="w-full sm:w-40" options={[{ value: "all", label: "Internal & external" }, { value: "internal", label: tab === "loads" ? "Ours & customers" : "Our fleet" }, { value: "external", label: tab === "loads" ? "Outside shippers" : "Partner trucks" }]} />
          <FilterSelect value={minKg} onChange={setMinKg} label={tab === "loads" ? "Weight" : "Available capacity"} className="w-full sm:w-36" options={KG_FILTER} />
        </FilterBar>
        {tab === "loads" ? (
          <DataTable
            key="loads"
            columns={loadColumns}
            data={filteredLoads}
            search={q}
            searchText={loadSearch}
            empty={
              <EmptyState
                icon={Boxes}
                title={status === "open" ? "No loads waiting for a truck." : "No loads match these filters."}
                description="Log one from the GC with Post available load, or switch Status to All statuses."
                action={
                  <Button size="sm" onClick={() => setPostingLoad(true)}>
                    <Plus /> Post available load
                  </Button>
                }
              />
            }
            renderCard={(r) => (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{r.load.id}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="font-medium">
                  {r.load.cargoDescription} — {kg(r.load.weightKg)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {shortArea(r.load.pickup.areaId)} → {shortArea(r.load.destination.areaId)} · pickup {when(r.load.pickupAt)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <BoardSourceBadge source={r.load.source} />
                  <span className="text-xs">{r.load.offeredFreight ? peso(r.load.offeredFreight) : "Freight not stated"}</span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t pt-1.5">
                  <MatchCount matches={r.matches} disabled={!r.open} onOpen={() => setMatchTarget({ kind: "load", id: r.load.id })} />
                  <LoadActions row={r} on={handlers} />
                </div>
              </div>
            )}
          />
        ) : (
          <DataTable
            key="capacity"
            columns={capacityColumns}
            data={filteredCapacity}
            search={q}
            searchText={capacitySearch}
            empty={
              <EmptyState
                icon={Truck}
                title={status === "open" ? "No trucks with open space right now." : "No truck capacity matches these filters."}
                description="Post our own trip space or a partner's truck from the GC."
                action={
                  <Button size="sm" onClick={() => setPostingCapacity({})}>
                    <Truck /> Post available capacity
                  </Button>
                }
              />
            }
            renderCard={(r) => (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{r.view.post.id}</span>
                  <StatusBadge status={r.view.status} />
                </div>
                <div className="font-medium">
                  {r.view.truckLabel} <span className="text-xs font-normal text-muted-foreground">· {r.view.internal ? "our fleet" : "partner"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {routeLine(r.view)} · departs {when(r.view.departureAt)}
                </div>
                <CapacityBar used={r.view.usedKg} capacity={r.view.totalKg} label={`${kg(r.view.availableKg)} free`} size="sm" />
                <div className="flex items-center justify-between gap-2 border-t pt-1.5">
                  <MatchCount matches={r.matches} disabled={!r.open} onOpen={() => setMatchTarget({ kind: "capacity", id: r.view.post.id })} />
                  <CapacityActions row={r} on={handlers} />
                </div>
              </div>
            )}
          />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Demo posts, businesses and offered freight are fictional and illustrative — not live freight rates. Nothing here is published to Facebook, Messenger or Viber.</p>

      <PostLoadDialog open={postingLoad} onOpenChange={setPostingLoad} onPosted={() => switchTab("loads")} />
      <PostCapacityDialog open={!!postingCapacity} onOpenChange={(v) => !v && setPostingCapacity(null)} preset={postingCapacity?.preset} onPosted={() => switchTab("capacity")} />
      <PartnersDialog open={partnersOpen} onOpenChange={setPartnersOpen} />
      <MatchesDialog
        target={matchTarget}
        onClose={() => setMatchTarget(null)}
        onBook={(loadId, capacityId) => {
          setMatchTarget(null);
          setBooking({ loadId, capacityId });
        }}
      />
      {booking && <BookLoadDialog loadId={booking.loadId} capacityId={booking.capacityId} onClose={() => setBooking(null)} />}
      {updatingUsed && <UpdateUsedDialog capacityId={updatingUsed} onClose={() => setUpdatingUsed(null)} />}
      {closing && (
        <ClosePostDialog
          title={closing.status === "Cancelled" ? `Cancel ${closing.id}?` : closing.status === "Expired" ? `Mark ${closing.id} expired?` : `Mark ${closing.id} booked elsewhere?`}
          description={closing.status === "Booked" ? "The shipper got a truck through another channel. The post leaves the open list." : "The post leaves the open list. You can reopen it later."}
          confirmLabel={closing.status === "Cancelled" ? "Cancel post" : closing.status === "Expired" ? "Mark expired" : "Mark booked elsewhere"}
          destructive={closing.status === "Cancelled"}
          onClose={() => setClosing(null)}
          onConfirm={(reason) => {
            if (closing.kind === "load") setLoadStatus(closing.id, closing.status, reason ?? (closing.status === "Booked" ? "Booked through another trucker" : undefined));
            else setCapacityStatus(closing.id, closing.status, reason);
            toast(`${closing.id} ${closing.status === "Booked" ? "marked booked elsewhere" : closing.status === "Expired" ? "marked expired" : "cancelled"}`);
          }}
        />
      )}
    </>
  );
}
