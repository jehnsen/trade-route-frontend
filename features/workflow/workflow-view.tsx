"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  ExternalLink,
  FileText,
  HandCoins,
  Kanban,
  Megaphone,
  PackageCheck,
  Pause,
  Play,
  Receipt,
  Route,
  TrendingUp,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Delivery, FreightQuote, Invoice, Lead, Load, LogisticsJob, Payment, Trip } from "@/types";
import { useAppStore } from "@/lib/store";
import { useCustomerMap, useInvoiceMap, useInvoices, useTripMetrics } from "@/hooks/use-data";
import { TODAY, TOMORROW, staffById } from "@/data/company";
import { driverById, truckById } from "@/data/fleet";
import { jobTotal, unassignedJobs, type TripMetrics } from "@/lib/logistics";
import { jobLane, tripRouteLine } from "@/lib/domain";
import { fmtDate, fmtDateTime, kg, peso, pesoCompact, pct, unitQty } from "@/lib/format";
import { cn, sumBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { CapacityBar, EmptyState, JobSourceBadge, MoneyDisplay, PageHeader, Stat } from "@/components/shared/common";
import { LegBadge, LoadTypeBadge, ReceivableBadge, StatusBadge } from "@/components/shared/status-badge";

// ─── The loop ───────────────────────────────────────────────────────────────
type StageKey = "lead" | "quote" | "job" | "loads" | "dispatch" | "trip" | "delivery" | "backhaul" | "costs" | "invoice" | "collection" | "profit";

interface Stage {
  key: StageKey;
  label: string;
  icon: LucideIcon;
  /** Who does this step in the business. */
  owner: string;
  /** What the step replaces in today's manual process. */
  replaces: string;
  what: string;
  benefits: string[];
}

const STAGES: Stage[] = [
  {
    key: "lead",
    label: "Lead",
    icon: Megaphone,
    owner: "Sales",
    replaces: "Inquiries scattered across Messenger, FB groups and phone call logs",
    what: "Every inquiry — from a Facebook group post, a Messenger chat, a referral or a walk-in — is captured as a lead with the cargo, lane and expected volume, then moved through the pipeline until it is won or lost.",
    benefits: ["No inquiry is forgotten in a chat thread", "Pipeline value shows which lanes are worth chasing", "Won leads convert to a customer in one click"],
  },
  {
    key: "quote",
    label: "Quote",
    icon: FileText,
    owner: "Sales",
    replaces: "Rates typed from memory into Messenger",
    what: "Sales prices the move from the demo rate card (lane, weight, truck requirement) plus additional charges, sends the quote, and converts an accepted quote into a logistics job. Repeat customers on an agreed rate can skip straight to a job.",
    benefits: ["Consistent rates across staff", "Quote validity and follow-ups are tracked", "Accepted quote becomes the job — nothing retyped"],
  },
  {
    key: "job",
    label: "Logistics job",
    icon: ClipboardList,
    owner: "Sales",
    replaces: "A notebook entry or a screenshot of the chat",
    what: "The job is the customer's shipment request: pickup, drop-off, consignee, cargo, weight, time window, freight charge and payment terms. Bookings from phone, Messenger, Facebook, sales staff and repeat customers all land here.",
    benefits: ["One record for every channel", "Full history of who confirmed what, and when", "Payment terms known before the truck leaves"],
  },
  {
    key: "loads",
    label: "Loads & cargo",
    icon: Boxes,
    owner: "Warehouse",
    replaces: "Guessing whether it will fit in the van",
    what: "Each job is broken into loads — boxes, sacks or pallets with gross weight — and checked against the van's configured payload. Company-owned cargo (such as produce bought for resale) is a load without a customer job.",
    benefits: ["Capacity checked before dispatch", "Handling notes travel with the cargo", "Clear manifest for loading and unloading"],
  },
  {
    key: "dispatch",
    label: "Dispatch",
    icon: Kanban,
    owner: "Dispatcher",
    replaces: "Phone calls to drivers and a whiteboard",
    what: "The dispatch board lists unassigned jobs and today's trips. The dispatcher assigns the job to a trip, and the platform warns about over-capacity, unavailable drivers, truck maintenance and expired documents.",
    benefits: ["See every truck's remaining capacity at once", "Warnings before a problem reaches the road", "Stops are re-planned automatically"],
  },
  {
    key: "trip",
    label: "Trip & stops",
    icon: Route,
    owner: "Dispatcher · Driver",
    replaces: "“Nasaan na kayo?” calls every hour",
    what: "The trip is the truck's run: truck, driver, helpers, outbound drops, return pickups and the drive back to Lucena. Stops are planned from the loads, and the driver marks each stop from the phone view.",
    benefits: ["Live stop progress without phone calls", "Planned vs. actual arrival times", "Late-risk drops flagged early"],
  },
  {
    key: "delivery",
    label: "Delivery & POD",
    icon: PackageCheck,
    owner: "Driver",
    replaces: "Paper DRs that come back days later, or not at all",
    what: "At the drop, the driver captures proof of delivery: who received it, the DR number, signature, photos and any short or damaged kilos. Issues like late arrival or rejected cargo are reported on the spot.",
    benefits: ["POD available the moment cargo is received", "Disputes settled with photos and signatures", "Delivery triggers billing automatically"],
  },
  {
    key: "backhaul",
    label: "Backhaul",
    icon: Undo2,
    owner: "Dispatcher · Procurement",
    replaces: "Trucks driving home half-empty",
    what: "Every trip has a return leg. Backhaul fills it with paid return cargo (backhaul or third-party jobs) and company-owned produce, so the Manila → Lucena drive earns money instead of burning diesel empty.",
    benefits: ["Return capacity is visible per trip", "Unused kilos are flagged while the truck is still out", "Loaded vs. empty kilometers tracked"],
  },
  {
    key: "costs",
    label: "Trip costs",
    icon: Wallet,
    owner: "Driver · Accounting",
    replaces: "Receipts in the driver's pocket",
    what: "Diesel, tolls, allowances, meals, loading fees and port fees are recorded against the trip. Diesel is estimated from distance and fuel efficiency until the actual fill-up is logged.",
    benefits: ["Every peso tied to a trip and truck", "Fuel efficiency tracked per fill-up", "Cash advances reconciled per run"],
  },
  {
    key: "invoice",
    label: "Invoice",
    icon: Receipt,
    owner: "Accounting",
    replaces: "Billing prepared from memory at month-end",
    what: "When a job is delivered, its freight invoice is created from the job's charges, dated on the POD and due according to the customer's payment terms.",
    benefits: ["No delivered job goes unbilled", "Due dates computed from terms", "Invoice links back to job, trip and POD"],
  },
  {
    key: "collection",
    label: "Collection",
    icon: HandCoins,
    owner: "Accounting",
    replaces: "A notebook of “utang” and reminder texts",
    what: "Payments — cash, COD, GCash, Maya, bank transfer or check — are recorded against the invoice with an official receipt. Balances age into Current, 1–7, 8–30, 31–60 and 60+ days.",
    benefits: ["Overdue exposure visible to the owner", "Every payment traceable to an OR", "Credit decisions based on real history"],
  },
  {
    key: "profit",
    label: "Trip profitability",
    icon: TrendingUp,
    owner: "Owner",
    replaces: "Not knowing which trips actually made money",
    what: "Freight revenue and additional charges, minus trip expenses (and estimated diesel if not yet logged), gives each trip's contribution. Reports roll this up by truck, lane, customer and week.",
    benefits: ["Contribution per trip, truck and lane", "Cost per kilometer", "Pricing decisions backed by numbers"],
  },
];

interface Journey {
  jobId: string;
  title: string;
  blurb: string;
}

const JOURNEYS: Journey[] = [
  { jobId: "JOB-260925-001", title: "Messenger booking, delivered this morning", blurb: "A repeat customer books iced sugpo to Navotas the night before. Delivered with POD, invoice on 7-day credit." },
  { jobId: "JOB-260925-019", title: "New customer won from a Facebook lead", blurb: "A lead from a Facebook group is quoted, won and booked. The job is waiting on the dispatch board." },
  { jobId: "JOB-260925-009", title: "Paid cargo on the return leg", blurb: "Produce hauled Manila → Quezon on Truck 01's return leg, filling capacity that would otherwise run empty." },
  { jobId: "JOB-260826-006", title: "Full cycle, delivered and paid", blurb: "A completed August job: delivered, invoiced, collected by GCash and rolled into trip profitability." },
];

type StageState = "done" | "current" | "upcoming";

const DEPARTED: Trip["status"][] = ["Dispatched", "In Transit", "Returning", "Completed"];
const AUTOPLAY_MS = 7000;

// ─── View ───────────────────────────────────────────────────────────────────
/** Deep-linkable: /workflow?job=JOB-260925-001&step=delivery */
export function WorkflowView({ initialJobId, initialStep }: { initialJobId?: string; initialStep?: string }) {
  const jobs = useAppStore((s) => s.jobs);
  const allLoads = useAppStore((s) => s.loads);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
  const quotes = useAppStore((s) => s.quotes);
  const leads = useAppStore((s) => s.leads);
  const payments = useAppStore((s) => s.payments);
  const customers = useCustomerMap();
  const invoiceMap = useInvoiceMap();
  const invoices = useInvoices();
  const metrics = useTripMetrics();

  const journeys = JOURNEYS.filter((j) => jobs.some((x) => x.id === j.jobId));
  const [jobId, setJobId] = useState(initialJobId && jobs.some((j) => j.id === initialJobId) ? initialJobId : (journeys[0]?.jobId ?? ""));
  const [index, setIndex] = useState(Math.max(0, STAGES.findIndex((s) => s.key === initialStep)));
  const [playing, setPlaying] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Keep the active step centred in the rail without scrolling the page.
  useEffect(() => {
    const rail = railRef.current;
    const el = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (rail && el) rail.scrollTo({ left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2, behavior: "smooth" });
  }, [index, jobId]);

  useEffect(() => {
    if (jobId) window.history.replaceState(null, "", `?job=${jobId}&step=${STAGES[index].key}`);
  }, [jobId, index]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (index >= STAGES.length - 1) setPlaying(false);
      else setIndex(index + 1);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, index]);

  const job = jobs.find((j) => j.id === jobId);
  if (!job)
    return (
      <EmptyState
        title="No example shipments found."
        description="Reset the demo data from the Demo Data badge in the header to restore the sample jobs."
      />
    );

  const customer = customers.get(job.customerId)!;
  const quote = quotes.find((q) => q.id === job.quoteId || q.jobId === job.id);
  const lead = leads.find((l) => (quote?.leadId ? l.id === quote.leadId : l.convertedCustomerId === job.customerId));
  const loads = allLoads.filter((l) => l.jobId === job.id && l.status !== "Cancelled");
  const loadIds = new Set(loads.map((l) => l.id));
  const trip = trips.find((t) => t.id === job.tripId);
  const m = trip ? metrics.get(trip.id) : undefined;
  const delivery = deliveries.find((d) => d.jobId === job.id);
  const invoice = invoiceMap.get(job.id);
  const jobPayments = payments.filter((p) => p.jobId === job.id);

  const done: Record<StageKey, boolean> = {
    lead: true,
    quote: job.status !== "Inquiry",
    job: job.status !== "Inquiry" && job.status !== "Quoted",
    loads: loads.length > 0,
    dispatch: !!trip,
    trip: !!trip && DEPARTED.includes(trip.status),
    delivery: delivery?.status === "Delivered",
    backhaul: !!trip && (trip.status === "Completed" || trip.status === "Returning"),
    costs: !!m && m.dieselLogged,
    invoice: !!invoice,
    collection: !!invoice && invoice.balance <= 0,
    profit: trip?.status === "Completed",
  };
  const currentIdx = STAGES.findIndex((s) => !done[s.key]);
  const stateOf = (i: number): StageState => (done[STAGES[i].key] ? "done" : i === currentIdx ? "current" : "upcoming");
  const reached = STAGES.filter((s) => done[s.key]).length;

  const stage = STAGES[index];
  const go = (i: number) => setIndex(Math.max(0, Math.min(STAGES.length - 1, i)));
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (index >= STAGES.length - 1) setIndex(0);
    setPlaying(true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  };

  const ctx: Ctx = { job, customer: customer.name, quote, lead, loads, loadIds, trip, m, delivery, invoice, payments: jobPayments };

  return (
    <div className="ops-enter">
      <div className="ops-eyebrow mb-2">Platform walkthrough</div>
      <PageHeader
        title="How TradeLoop runs a shipment"
        description="Follow a real demo shipment from first inquiry to collected payment. Every record below is live demo data — open any step in the app."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/command-center">Command Center</Link>
            </Button>
            <Button asChild>
              <Link href="/jobs/new">
                Book a job yourself <ArrowRight />
              </Link>
            </Button>
          </>
        }
      />

      <BusinessPulse jobs={jobs} trips={trips} metrics={metrics} invoices={invoices} leadsOpen={leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost").length} quotesOpen={quotes.filter((q) => q.status === "Sent" || q.status === "Draft").length} />

      <section aria-labelledby="journey-heading" className="mt-6">
        <h2 id="journey-heading" className="mb-3 text-sm font-semibold">
          1. Pick a shipment to follow
        </h2>
        <div role="radiogroup" aria-label="Example shipments" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {journeys.map((j) => {
            const active = j.jobId === jobId;
            const jb = jobs.find((x) => x.id === j.jobId)!;
            return (
              <button
                key={j.jobId}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setJobId(j.jobId);
                  setIndex(0);
                  setPlaying(false);
                }}
                className={cn("ops-metric cursor-pointer p-4 text-left", active && "!border-[#9fbf83] !bg-[#edf3e5] ring-2 ring-[#c9ecaa]")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{j.jobId}</span>
                  <LegBadge leg={jb.leg} />
                </div>
                <div className="mt-1.5 text-sm font-semibold">{j.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{j.blurb}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-2 text-[11px]">
                  <span className="truncate text-muted-foreground">{customers.get(jb.customerId)?.name}</span>
                  <StatusBadge status={jb.status} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="loop-heading" className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="loop-heading" className="text-sm font-semibold">
            2. Walk through the loop{" "}
            <span className="font-normal text-muted-foreground">
              · {job.id} has reached {reached} of {STAGES.length} steps
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Previous step" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={togglePlay} aria-pressed={playing}>
              {playing ? <Pause /> : <Play />} {playing ? "Pause" : "Auto-play"}
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Next step" onClick={() => go(index + 1)} disabled={index === STAGES.length - 1}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div ref={railRef} className="route-board relative overflow-x-auto rounded-2xl border p-3 scrollbar-thin" onKeyDown={onKey}>
          <ol className="flex min-w-max items-stretch gap-1.5" aria-label="Workflow steps">
            {STAGES.map((s, i) => {
              const st = stateOf(i);
              const active = i === index;
              return (
                <li key={s.key} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIndex(i);
                      setPlaying(false);
                    }}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "flex w-[92px] cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
                      active ? "border-[#263e36] bg-[#263e36] text-white shadow-md" : "border-transparent bg-white/80 hover:border-border hover:bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full",
                        active ? "bg-[#c9ecaa] text-[#1c3024]" : st === "done" ? "bg-[#e3eed8] text-[#4d6b36]" : st === "current" ? "bg-warning-soft text-[oklch(0.5_0.12_65)]" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <s.icon className="size-4" />
                    </span>
                    <span className="text-[11px] leading-tight font-medium">{s.label}</span>
                    <span className={cn("flex items-center gap-1 text-[10px]", active ? "text-white/75" : "text-muted-foreground")}>
                      {st === "done" ? <CircleCheck className="size-3" /> : <CircleDashed className="size-3" />}
                      {st === "done" ? "Done" : st === "current" ? "Next up" : "Later"}
                    </span>
                  </button>
                  {i < STAGES.length - 1 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />}
                </li>
              );
            })}
          </ol>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Tip: focus the step rail and use ← → to move between steps.</p>
      </section>

      <div key={`${jobId}-${stage.key}`} className="ops-enter mt-4 grid gap-4 lg:grid-cols-5" aria-live="polite">
        <Card className="lg:col-span-2">
          <CardContent className="grid gap-4 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e5] text-[#4d6b36]">
                <stage.icon className="size-5" />
              </span>
              <div>
                <div className="ops-eyebrow">
                  Step {index + 1} of {STAGES.length} · {stage.owner}
                </div>
                <h3 className="text-lg font-semibold tracking-tight">{stage.label}</h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85">{stage.what}</p>
            <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
              <span className="font-semibold">Replaces: </span>
              <span className="text-muted-foreground">{stage.replaces}</span>
            </div>
            <ul className="grid gap-1.5">
              {stage.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardContent className="py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="ops-eyebrow">In this shipment · {job.id}</div>
              <StageBadge state={stateOf(index)} />
            </div>
            <StageDetail stage={stage.key} ctx={ctx} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft /> {index > 0 ? STAGES[index - 1].label : "Previous"}
        </Button>
        <Button variant="ghost" onClick={() => go(index + 1)} disabled={index === STAGES.length - 1}>
          {index < STAGES.length - 1 ? STAGES[index + 1].label : "Next"} <ChevronRight />
        </Button>
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Try the loop yourself</div>
            <p className="text-xs text-muted-foreground">Book a job, assign it on the dispatch board, then capture POD from the driver view. Every screen stays in sync. Use the Demo Data badge in the header to reset.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/jobs/new">1 · Book a job</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dispatch">2 · Dispatch</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/driver">3 · Driver view</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/accounts-receivable">4 · Collect</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Business pulse ─────────────────────────────────────────────────────────
function BusinessPulse({ jobs, trips, metrics, invoices, leadsOpen, quotesOpen }: { jobs: LogisticsJob[]; trips: Trip[]; metrics: Map<string, TripMetrics>; invoices: Invoice[]; leadsOpen: number; quotesOpen: number }) {
  const today = trips.filter((t) => t.date === TODAY && t.status !== "Cancelled");
  const todayM = today.map((t) => metrics.get(t.id)!).filter(Boolean);
  const unusedReturn = sumBy(todayM, (x) => Math.max(0, x.capacityKg - x.returnKg));
  const outstanding = sumBy(invoices, (i) => i.balance);
  const overdue = sumBy(
    invoices.filter((i) => i.daysOverdue > 0),
    (i) => i.balance,
  );
  const items = [
    { label: "Open leads", value: String(leadsOpen), href: "/leads" },
    { label: "Quotes out", value: String(quotesOpen), href: "/quotes" },
    { label: "Awaiting dispatch", value: String(unassignedJobs(jobs).filter((j) => j.pickupAt.slice(0, 10) <= TOMORROW).length), href: "/dispatch" },
    { label: "Trips today", value: String(today.length), href: "/trips" },
    { label: "Deliveries done today", value: `${sumBy(todayM, (x) => x.delivered)}/${sumBy(todayM, (x) => x.deliveryCount)}`, href: "/deliveries" },
    { label: "Unused return capacity", value: kg(unusedReturn), href: "/backhaul" },
    { label: "Outstanding freight AR", value: pesoCompact(outstanding), href: "/accounts-receivable" },
    { label: "Overdue", value: pesoCompact(overdue), href: "/accounts-receivable", danger: true },
  ];
  return (
    <section aria-label="The whole operation today" className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-semibold">The whole loop, right now</div>
        <div className="text-[11px] text-muted-foreground">Demo snapshot · {fmtDate(TODAY)}</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-8">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className="group rounded-lg p-1 -m-1 hover:bg-muted/50">
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            <div className={cn("mt-0.5 text-lg font-semibold tracking-tight tabular", it.danger && "text-danger")}>{it.value}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Stage details (live records) ───────────────────────────────────────────
interface Ctx {
  job: LogisticsJob;
  customer: string;
  quote: FreightQuote | undefined;
  lead: Lead | undefined;
  loads: Load[];
  loadIds: Set<string>;
  trip: Trip | undefined;
  m: TripMetrics | undefined;
  delivery: Delivery | undefined;
  invoice: Invoice | undefined;
  payments: Payment[];
}

function StageBadge({ state }: { state: StageState }) {
  if (state === "done")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-[oklch(0.42_0.12_150)]">
        <CircleCheck className="size-3.5" /> Completed for this shipment
      </span>
    );
  if (state === "current")
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-[oklch(0.48_0.12_65)]">
        <CircleDashed className="size-3.5" /> This shipment is here now
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      <CircleDashed className="size-3.5" /> Not reached yet
    </span>
  );
}

function Facts({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</div>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-foreground/80">{children}</p>;
}

function OpenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={href}>
        {children} <ExternalLink />
      </Link>
    </Button>
  );
}

function Detail({ children, links }: { children: ReactNode; links: ReactNode }) {
  return (
    <div className="grid gap-4">
      {children}
      <div className="flex flex-wrap gap-2 border-t pt-4">{links}</div>
    </div>
  );
}

function StageDetail({ stage, ctx }: { stage: StageKey; ctx: Ctx }) {
  const { job, customer, quote, lead, loads, loadIds, trip, m, delivery, invoice, payments } = ctx;
  const truck = trip ? truckById(trip.truckId) : undefined;
  const assigned = job.history.find((e) => e.label.startsWith("Assigned"));
  const salesperson = staffById(job.salespersonId)?.name;

  switch (stage) {
    case "lead":
      return lead ? (
        <Detail links={<OpenLink href="/leads">Open Leads pipeline</OpenLink>}>
          <Facts>
            <Stat label="Lead" value={lead.businessName} sub={`${lead.id} · ${lead.contactName}`} />
            <Stat label="Source" value={lead.source} sub={lead.location} />
            <Stat label="Stage" value={<StatusBadge status={lead.stage} />} />
            <Stat label="Cargo interest" value={lead.cargoInterest} />
            <Stat label="Lane" value={lead.lane} sub={lead.potentialVolume} />
            <Stat label="Potential freight" value={`${peso(lead.potentialMonthlyValue)}/mo`} sub="Demo estimate" />
          </Facts>
          {lead.convertedCustomerId && <Note>Won and converted to customer {customer} — the same record now carries its quotes, jobs, invoices and payments.</Note>}
        </Detail>
      ) : (
        <Detail links={<OpenLink href={`/customers/${job.customerId}`}>Open customer profile</OpenLink>}>
          <Facts>
            <Stat label="Customer" value={customer} sub={job.customerId} />
            <Stat label="Booked via" value={<JobSourceBadge source={job.source} />} />
            <Stat label="Handled by" value={salesperson ?? "—"} />
          </Facts>
          <Note>
            {customer} is already a customer, so there is no lead to work — the booking came in by {job.source.toLowerCase()} and went straight to a job. Manual channels stay first-class; the platform does not force customers onto a portal.
          </Note>
        </Detail>
      );

    case "quote":
      return quote ? (
        <Detail links={<OpenLink href="/quotes">Open Quotes</OpenLink>}>
          <Facts>
            <Stat label="Quote" value={quote.id} sub={`Created ${fmtDate(quote.createdAt)}`} />
            <Stat label="Status" value={<StatusBadge status={quote.status} />} sub={quote.respondedAt ? `Responded ${fmtDate(quote.respondedAt)}` : undefined} />
            <Stat label="Freight" value={peso(quote.freightCharge + sumBy(quote.additionalCharges, (c) => c.amount))} sub="Demo rate" />
            <Stat label="Cargo" value={quote.cargoDescription} sub={kg(quote.weightKg)} />
            <Stat label="Truck" value={quote.truckRequirement} />
            <Stat label="Valid until" value={fmtDate(quote.validUntil)} />
          </Facts>
          {quote.jobId && <Note>Accepted and converted to {quote.jobId} — pickup, drop-off, cargo and charges carried over without retyping.</Note>}
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/settings">View demo rate card</OpenLink>}>
          <Facts>
            <Stat label="Freight" value={peso(job.freightCharge)} sub="Agreed lane rate · demo" />
            <Stat label="Lane" value={jobLane(job)} />
            <Stat label="Terms" value={job.paymentTerms} />
          </Facts>
          <Note>No formal quote needed — {customer} books this lane regularly at an agreed rate. New customers and unusual moves go through a quote first.</Note>
        </Detail>
      );

    case "job":
      return (
        <Detail links={<OpenLink href={`/jobs/${job.id}`}>Open {job.id}</OpenLink>}>
          <Facts>
            <Stat label="Job" value={job.id} sub={<StatusBadge status={job.status} />} />
            <Stat label="Source" value={<JobSourceBadge source={job.source} />} sub={salesperson} />
            <Stat label="Lane" value={jobLane(job)} sub={<LegBadge leg={job.leg} />} />
            <Stat label="Cargo" value={job.cargoDescription} sub={`${kg(job.weightKg)} · ${job.cargoCategory}`} />
            <Stat label="Pickup" value={job.pickup.name} sub={fmtDateTime(job.pickupAt)} />
            <Stat label="Deliver to" value={job.dropoff.name} sub={`By ${fmtDateTime(job.requiredBy)}`} />
            <Stat label="Consignee" value={job.consignee.name} sub={job.consignee.phone} />
            <Stat label="Charges" value={peso(jobTotal(job))} sub="Demo rate" />
            <Stat label="Payment terms" value={job.paymentTerms} />
          </Facts>
          {job.instructions && <Note>Instructions: {job.instructions}</Note>}
        </Detail>
      );

    case "loads":
      return (
        <Detail links={<OpenLink href="/loads">Open Loads / Cargo</OpenLink>}>
          {loads.length === 0 ? (
            <Note>No loads yet — the warehouse breaks the job into loads once the cargo is confirmed.</Note>
          ) : (
            <ul className="divide-y rounded-lg border">
              {loads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{l.cargoDescription}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.id} · {unitQty(l.quantity, l.unit)}
                      {l.handlingNotes ? ` · ${l.handlingNotes}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <LoadTypeBadge type={l.type} />
                    <span className="text-sm font-semibold tabular">{kg(l.weightKg)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <CapacityBar used={sumBy(loads, (l) => l.weightKg)} capacity={truck?.capacityKg ?? 8500} label="Share of one van's configured payload" />
        </Detail>
      );

    case "dispatch":
      return trip && truck ? (
        <Detail links={<OpenLink href="/dispatch">Open Dispatch board</OpenLink>}>
          <Facts>
            <Stat label="Trip" value={trip.id} sub={fmtDate(trip.date)} />
            <Stat label="Truck" value={`${truck.code} · ${truck.make} ${truck.model}`} sub={truck.plateNo} />
            <Stat label="Driver" value={driverById(trip.driverId).name} sub={`${trip.helperIds.length} helper${trip.helperIds.length === 1 ? "" : "s"}`} />
          </Facts>
          {m && (
            <div className="grid gap-3 sm:grid-cols-2">
              <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label="Outbound leg" />
              <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return leg" />
            </div>
          )}
          {assigned && (
            <Note>
              {assigned.label} by {assigned.by} on {fmtDateTime(assigned.at)}. The trip&apos;s stops were re-planned automatically.
            </Note>
          )}
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/dispatch">Assign it on the Dispatch board</OpenLink>}>
          <Facts>
            <Stat label="Status" value={<StatusBadge status={job.status} />} />
            <Stat label="Weight to place" value={kg(job.weightKg)} />
            <Stat label="Pickup" value={fmtDateTime(job.pickupAt)} />
          </Facts>
          <Note>This job is on the dispatch board waiting for a truck. The dispatcher picks a trip with enough remaining capacity; the platform warns about overloads, driver leave, truck maintenance and expired documents.</Note>
        </Detail>
      );

    case "trip":
      return trip ? (
        <Detail links={<OpenLink href={`/trips/${trip.id}`}>Open {trip.id}</OpenLink>}>
          <Facts>
            <Stat label="Status" value={<StatusBadge status={trip.status} />} />
            <Stat label="Departure" value={fmtDateTime(trip.actualDeparture ?? trip.departure)} sub={trip.actualDeparture ? "Actual" : "Planned"} />
            <Stat label="Route" value={tripRouteLine(trip)} />
          </Facts>
          <ol className="max-h-64 divide-y overflow-y-auto rounded-lg border scrollbar-thin" aria-label="Trip stops">
            {trip.stops.map((s) => {
              const mine = s.loaded.some((id) => loadIds.has(id)) || s.unloaded.some((id) => loadIds.has(id));
              return (
                <li key={s.id} className={cn("flex items-center justify-between gap-2 px-3 py-2 text-xs", mine && "bg-[#edf3e5]")}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-right text-muted-foreground tabular">{s.seq}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.location.name}</span>
                      <span className="text-muted-foreground">
                        {s.type} · {fmtDateTime(s.actualArrival ?? s.plannedArrival)}
                        {mine ? " · this shipment" : ""}
                      </span>
                    </span>
                  </span>
                  <StatusBadge status={s.status} />
                </li>
              );
            })}
          </ol>
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/trips">Open Trips</OpenLink>}>
          <Note>Stops are planned once the job is on a trip: warehouse loading, each drop in route order, return pickups and the drive back to Lucena.</Note>
        </Detail>
      );

    case "delivery":
      return delivery ? (
        <Detail
          links={
            <>
              <OpenLink href={`/deliveries/${delivery.id}`}>Open {delivery.id}</OpenLink>
              {delivery.pod && <OpenLink href={`/print/delivery-receipt/${delivery.id}`}>Print DR</OpenLink>}
            </>
          }
        >
          <Facts>
            <Stat label="Delivery" value={delivery.id} sub={<StatusBadge status={delivery.status} />} />
            <Stat label="ETA" value={fmtDateTime(delivery.eta)} sub={delivery.arrivedAt ? `Arrived ${fmtDateTime(delivery.arrivedAt)}` : undefined} />
            <Stat label="Consignee" value={job.consignee.name} sub={job.dropoff.name} />
            {delivery.pod && (
              <>
                <Stat label="Received by" value={delivery.pod.receivedBy} sub={fmtDateTime(delivery.pod.signedAt)} />
                <Stat label="DR no." value={delivery.pod.receiptNo} sub={delivery.pod.signatureCaptured ? "Signature captured" : "No signature"} />
                <Stat label="Photos" value={delivery.pod.photoCount} sub={delivery.pod.shortKg || delivery.pod.damagedKg ? `${kg(delivery.pod.shortKg ?? 0)} short · ${kg(delivery.pod.damagedKg ?? 0)} damaged` : "No short or damaged cargo"} />
              </>
            )}
          </Facts>
          {delivery.pod?.customerRemarks && <Note>Consignee remarks: {delivery.pod.customerRemarks}</Note>}
          {!delivery.pod && <Note>The driver marks arrival and captures POD from the phone view at the drop. Delivery then completes the job and creates its invoice.</Note>}
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/deliveries">Open Deliveries</OpenLink>}>
          <Note>A delivery is created when the job is put on a trip. At the drop the driver captures POD — receiver, DR number, signature and photos.</Note>
        </Detail>
      );

    case "backhaul":
      return trip && m ? (
        <Detail links={<OpenLink href="/backhaul">Open Backhaul</OpenLink>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <CapacityBar used={m.outboundKg} capacity={m.capacityKg} label="Outbound utilization" />
            <CapacityBar used={m.returnKg} capacity={m.capacityKg} label="Return utilization" />
          </div>
          <Facts>
            <Stat label="Paid return cargo" value={kg(m.paidReturnKg)} sub="Backhaul & third-party jobs" />
            <Stat label="Company-owned cargo" value={kg(m.companyReturnKg)} sub={m.companyCargoValue ? `${peso(m.companyCargoValue)} goods value` : "Own produce"} />
            <Stat label="Unused return capacity" value={kg(Math.max(0, m.capacityKg - m.returnKg))} />
          </Facts>
          <Note>
            {job.leg === "return"
              ? `This job is the backhaul: ${kg(job.weightKg)} earning ${peso(jobTotal(job))} on the ${truck?.code} return leg — kilometers that would otherwise run empty.`
              : `${truck?.code}'s return leg carries ${kg(m.returnKg)} (${pct(m.retUtil)} of payload), so the drive back to Lucena is not wasted.`}
          </Note>
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/backhaul">Open Backhaul</OpenLink>}>
          <Note>Once the job is on a trip, the backhaul board shows that trip&apos;s unused return capacity and matching return cargo.</Note>
        </Detail>
      );

    case "costs":
      return trip && m ? (
        <Detail links={<OpenLink href="/expenses">Open Trip Expenses</OpenLink>}>
          {m.expenses.length === 0 ? (
            <Note>No expenses recorded yet — tolls, allowances and fees are added as the trip runs.</Note>
          ) : (
            <ul className="divide-y rounded-lg border">
              {m.expenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {e.category}
                    <span className="text-xs text-muted-foreground"> · {e.paidTo}</span>
                  </span>
                  <MoneyDisplay amount={e.amount} className="font-medium" />
                </li>
              ))}
              {!m.dieselLogged && m.estimatedDiesel > 0 && (
                <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <span>Diesel (estimated until fill-up is logged)</span>
                  <MoneyDisplay amount={m.estimatedDiesel} />
                </li>
              )}
            </ul>
          )}
          <Facts>
            <Stat label="Trip costs" value={peso(m.expenseTotal + m.estimatedDiesel)} sub={m.dieselLogged ? "All logged" : "Incl. estimated diesel"} />
            <Stat label="Distance" value={`${m.distanceKm.toLocaleString()} km`} sub={m.distanceIsActual ? "Odometer" : "Planned"} />
            <Stat label="Cost per km" value={peso(m.costPerKm)} />
          </Facts>
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/expenses">Open Trip Expenses</OpenLink>}>
          <Note>Costs are recorded against the trip once it runs: diesel, tolls, allowances, meals and loading fees.</Note>
        </Detail>
      );

    case "invoice":
      return invoice ? (
        <Detail links={<OpenLink href={`/accounts-receivable/${invoice.id}`}>Open {invoice.id}</OpenLink>}>
          <Facts>
            <Stat label="Invoice" value={invoice.id} sub={`For ${job.id}`} />
            <Stat label="Issued" value={fmtDate(invoice.issueDate)} sub="Dated on POD" />
            <Stat label="Due" value={fmtDate(invoice.dueDate)} sub={job.paymentTerms} />
            <Stat label="Total" value={peso(invoice.total)} />
            <Stat label="Balance" value={peso(invoice.balance)} />
            <Stat label="Status" value={<ReceivableBadge daysOverdue={invoice.daysOverdue} balance={invoice.balance} />} />
          </Facts>
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/accounts-receivable">Open Receivables</OpenLink>}>
          <Note>The freight invoice ({job.id.replace("JOB-", "INV-")}) is created automatically when POD is captured, so no delivered job goes unbilled.</Note>
        </Detail>
      );

    case "collection":
      return (
        <Detail links={<OpenLink href={invoice ? `/accounts-receivable/${invoice.id}` : "/payments"}>{invoice ? "Record a payment" : "Open Payments"}</OpenLink>}>
          {payments.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {p.id} · {p.method}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fmtDateTime(p.date)} · {p.receiptNo} · {p.recordedBy}
                    </span>
                  </span>
                  <MoneyDisplay amount={p.amount} className="font-semibold" />
                </li>
              ))}
            </ul>
          ) : (
            <Note>
              {invoice
                ? `No payment yet. ${peso(invoice.balance)} is ${invoice.daysOverdue > 0 ? `${invoice.daysOverdue} days overdue` : `due ${fmtDate(invoice.dueDate)}`} — it shows up in receivables aging and on the owner's Command Center until collected.`
                : job.paymentTerms === "COD"
                  ? "COD: the driver collects at the drop, and the payment is recorded against the invoice right away."
                  : "Payments are recorded against the invoice once it is issued."}
            </Note>
          )}
          {invoice && (
            <Facts>
              <Stat label="Collected" value={peso(invoice.paid)} />
              <Stat label="Balance" value={peso(invoice.balance)} />
              <Stat label="Aging" value={<ReceivableBadge daysOverdue={invoice.daysOverdue} balance={invoice.balance} />} />
            </Facts>
          )}
        </Detail>
      );

    case "profit":
      return trip && m ? (
        <Detail links={<OpenLink href="/reports">Open Reports</OpenLink>}>
          <Facts>
            <Stat label="Trip revenue" value={peso(m.revenue)} sub={`${m.jobs.length} jobs on ${trip.id}`} />
            <Stat label="Trip costs" value={peso(m.expenseTotal + m.estimatedDiesel)} sub={m.dieselLogged ? "Logged" : "Incl. estimated diesel"} />
            <Stat label="Contribution" value={<span className={m.contribution < 0 ? "text-danger" : "text-success"}>{peso(m.contribution)}</span>} sub={`${pct(m.contribution / Math.max(1, m.revenue))} of revenue`} />
            <Stat label="This shipment" value={peso(jobTotal(job))} sub={`${pct(jobTotal(job) / Math.max(1, m.revenue))} of trip revenue`} />
            <Stat label="Loaded km" value={`${Math.round(m.loadedKm).toLocaleString()} km`} sub={`${Math.round(m.emptyKm).toLocaleString()} km empty`} />
            <Stat label="Cost per km" value={peso(m.costPerKm)} />
          </Facts>
          <Note>
            Contribution = freight revenue + additional charges − trip expenses. It is not net income: truck amortization, insurance, salaries and overhead sit outside the trip.
            {trip.status !== "Completed" && " This trip is still running, so figures will change as costs are logged."}
          </Note>
        </Detail>
      ) : (
        <Detail links={<OpenLink href="/reports">Open Reports</OpenLink>}>
          <Note>Once the job rides a trip, its freight counts toward that trip&apos;s revenue and contribution.</Note>
        </Detail>
      );
  }
}
