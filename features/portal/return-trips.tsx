"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, Banknote, CheckCircle2, PackageX, Phone, Search, ShieldCheck, Truck } from "lucide-react";
import type { BackhaulRequestStatus, PublicBackhaulBoard, ShipperListing, ShipperRequestInput, ShipperRequestView } from "@/types";
import { useAppStore, PUBLIC_ORG } from "@/lib/store";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { applyTenantProfile } from "@/data/tenant";
import { OUR_VAN_RESTRICTIONS } from "@/lib/backhaul-marketplace";
import { dispatchContact, placeLabel } from "@/lib/load-board";
import { fmtDay, fmtTimeWindow, kg, peso, relativeDay } from "@/lib/format";
import { groupBy } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, Input, Skeleton } from "@/components/ui/primitives";
import { Field } from "@/components/ui/form-controls";
import { DemoRateNote, EmptyState } from "@/components/shared/common";
import { StatusBadge } from "@/components/shared/status-badge";
import { ShipperListingCard } from "@/features/backhaul-marketplace/marketplace-parts";
import { RequestSpaceDialog } from "@/features/backhaul-marketplace/marketplace-dialogs";

const STEPS = [
  { title: "Pick a return trip", text: "See the route, the day and when the truck passes your town." },
  { title: "Get an instant quote", text: "Rate per kg and the minimum charge are shown before you send anything." },
  { title: "We call to confirm", text: "Our dispatch desk confirms by phone before pickup. No account needed." },
];

const STATUS_COPY: Record<BackhaulRequestStatus, string> = {
  Requested: "Received. Our dispatch desk will call you to confirm before the truck reaches your pickup point.",
  Confirmed: "Booked. Our dispatcher will text you the truck details and exact pickup time on the day.",
  Declined: "We can't take this one on that trip.",
  Cancelled: "This booking was cancelled. Call our dispatch desk if you still need the space.",
  Expired: "The truck left before we could confirm. Please request space on another return trip.",
};

const lookupSchema = z.object({
  requestId: z.string().trim().regex(/^BKR-\d{6}-\d{3}$/i, "Use the request number we gave you, e.g. BKR-260925-002"),
  phone: z.string().trim().min(7, "Enter the mobile number on the request"),
});
type LookupValues = z.infer<typeof lookupSchema>;

const base = `/public/ops/${encodeURIComponent(PUBLIC_ORG)}/return-trips`;
const callHref = () => `tel:${dispatchContact().phone.replace(/\s/g, "")}`;
const lookupRequest = (id: string, phone: string) => api<ShipperRequestView>(`${base}/requests/${encodeURIComponent(id.trim().toUpperCase())}?phone=${encodeURIComponent(phone)}`, { auth: false });

/** Open return legs from the public API (shipper view: no trip ids, plates, drivers or exact times). */
function usePublicBoard() {
  const [board, setBoard] = React.useState<PublicBackhaulBoard | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    try {
      const b = await api<PublicBackhaulBoard>(base, { auth: false });
      // Signed-in staff already have the full profile; anonymous visitors get the public one.
      if (!useAppStore.getState().viewer) applyTenantProfile(b.profile);
      setBoard(b);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  React.useEffect(() => void load(), [load]);
  return { board, error, reload: load };
}

export function PortalReturnTrips({ initialRequest }: { initialRequest?: string }) {
  const { board, error, reload } = usePublicBoard();
  const [requesting, setRequesting] = React.useState<ShipperListing | null>(null);
  const [sent, setSent] = React.useState<ShipperRequestView | null>(null);

  const byDate = Object.entries(groupBy(board?.listings ?? [], (v) => v.date)).sort(([a], [b]) => a.localeCompare(b));
  const submitRequest = async (input: ShipperRequestInput) => {
    const { id } = await api<{ id: string }>(`${base}/requests`, { method: "POST", body: input, auth: false });
    // Show the shipper exactly what a later status check will show.
    setSent(await lookupRequest(id, input.shipper.phone).catch(() => null));
    void reload();
    return id;
  };

  return (
    <>
      <section className="border-b border-[#e3e7de] bg-[#f1f3ec]">
        <div className="portal-container grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
          <div>
            <p className="portal-eyebrow">Ship with us · Return trips to Quezon</p>
            <h1 className="portal-heading mt-3">
              Space on our trucks
              <br />
              <span className="font-editorial font-normal text-[#587452] italic">heading home to Lucena.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#707a6e]">
              Our closed vans deliver seafood to Metro Manila, Cavite and Laguna, then drive back to Lucena. If you have cargo bound for Quezon, book the space on the way home.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <a href="#trips">
                  See open return trips <ArrowDown />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="#check">Check a request</a>
              </Button>
            </div>
          </div>
          <ol className="grid gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d8e0d0] bg-white/70 text-xs font-semibold text-[#587452] tabular">{i + 1}</span>
                <div>
                  <h2 className="text-sm font-semibold">{s.title}</h2>
                  <p className="mt-0.5 text-xs leading-6 text-[#707a6e]">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="trips" className="portal-container scroll-mt-24 py-10" aria-labelledby="trips-heading">
        <h2 id="trips-heading" className="text-xl font-semibold tracking-tight">
          Open return trips
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Pickup windows are approximate. We confirm the exact time when we call.</p>

        {sent && (
          <div className="mt-5">
            <RequestStatus view={sent} justSent onClose={() => setSent(null)} />
          </div>
        )}

        {error ? (
          <EmptyState
            icon={Truck}
            title="Return trips couldn't load right now."
            description={error}
            action={
              <Button variant="outline" onClick={() => void reload()}>
                Try again
              </Button>
            }
            className="mt-6 bg-card"
          />
        ) : !board ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : byDate.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No return trips open for booking right now."
            description="We list new return trips every evening. You can also call our dispatch desk to ask about tomorrow."
            action={
              <Button asChild variant="outline">
                <a href={callHref()}>
                  <Phone /> {dispatchContact().phone}
                </a>
              </Button>
            }
            className="mt-6 bg-card"
          />
        ) : (
          byDate.map(([date, list]) => (
            <section key={date} className="mt-6" aria-label={`Return trips ${fmtDay(date)}`}>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                {relativeDay(date)} <span className="font-normal text-muted-foreground">{fmtDay(date)}</span>
              </h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((v) => (
                  <ShipperListingCard key={v.listingId} v={v} onRequest={() => setRequesting(v)} />
                ))}
              </div>
            </section>
          ))
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoTile icon={PackageX} title="What we carry">
            {OUR_VAN_RESTRICTIONS} Gross weight in kg, packaging included.
          </InfoTile>
          <InfoTile icon={Banknote} title="Payment">
            New shippers pay cash on delivery. Regular shippers can ask our dispatch desk about credit terms.
          </InfoTile>
          <InfoTile icon={ShieldCheck} title="Your cargo's safety">
            For everyone&apos;s security we don&apos;t publish plate numbers, driver names or exact times. You get them by text once your booking is confirmed.
          </InfoTile>
        </div>
        <DemoRateNote className="mt-3" />
      </section>

      <section id="check" className="scroll-mt-24 border-t border-[#e3e7de] bg-[#f8f9f4]" aria-labelledby="check-heading">
        <div className="portal-container grid gap-8 py-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <h2 id="check-heading" className="text-xl font-semibold tracking-tight">
              Check a request
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Enter your request number and the mobile number you used. You&apos;ll see whether dispatch has confirmed it.</p>
            <a href={callHref()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline">
              <Phone className="size-4" /> Dispatch desk · {dispatchContact().phone}
            </a>
          </div>
          <RequestLookup initialRequest={initialRequest} />
        </div>
      </section>

      {requesting && (
        <RequestSpaceDialog
          listing={requesting}
          onSubmit={submitRequest}
          onClose={() => setRequesting(null)}
          onSubmitted={() => {
            setRequesting(null);
            document.getElementById("trips")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      )}
    </>
  );
}

function InfoTile({ icon: Icon, title, children }: { icon: typeof Truck; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-[#e1e6dc] bg-white/60 p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-[#587452]" strokeWidth={1.6} />
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-6 text-[#707a6e]">{children}</p>
      </div>
    </div>
  );
}

function RequestLookup({ initialRequest }: { initialRequest?: string }) {
  const [result, setResult] = React.useState<ShipperRequestView | "none" | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const form = useForm<LookupValues>({ resolver: zodResolver(lookupSchema), defaultValues: { requestId: initialRequest ?? "", phone: "" } });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (x) => {
    setFailure(null);
    try {
      setResult(await lookupRequest(x.requestId, x.phone));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setResult("none");
      else (setResult(null), setFailure(errorMessage(e)));
    }
  });

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
          <Field label="Request number" htmlFor="ck-id" error={errors.requestId?.message} required>
            <Input id="ck-id" placeholder="BKR-260925-002" autoCapitalize="characters" aria-invalid={!!errors.requestId} {...form.register("requestId")} />
          </Field>
          <Field label="Mobile number" htmlFor="ck-phone" error={errors.phone?.message} required>
            <Input id="ck-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xx xxx xxxx" aria-invalid={!!errors.phone} {...form.register("phone")} />
          </Field>
          <Button type="submit" className="sm:mt-[22px]" disabled={form.formState.isSubmitting}>
            <Search /> Check
          </Button>
        </form>
      </Card>
      {result === "none" && (
        <p role="status" className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No request matches that number and mobile number. Check both, or call our dispatch desk.
        </p>
      )}
      {failure && (
        <p role="alert" className="rounded-lg border border-dashed px-4 py-3 text-sm text-destructive">
          {failure}
        </p>
      )}
      {result && result !== "none" && <RequestStatus view={result} />}
    </div>
  );
}

/** A shipper's own request: status, route, pickup window and quote. Nothing about the truck or other cargo. */
function RequestStatus({ view: r, justSent, onClose }: { view: ShipperRequestView; justSent?: boolean; onClose?: () => void }) {
  const status = r.status;

  return (
    <Card role="status" className="gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {justSent && <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" />}
          <div>
            <div className="text-xs text-muted-foreground">{justSent ? "Request sent · keep this number" : "Request"}</div>
            <div className="font-mono text-base font-semibold">{r.id}</div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="text-sm">
        {STATUS_COPY[status]}
        {status === "Declined" && r.declineReason && <span className="text-muted-foreground"> {r.declineReason}</span>}
      </p>
      <dl className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
        {r.tripDate && r.pickupWindowAt && (
          <div>
            <dt className="text-xs text-muted-foreground">Return trip</dt>
            <dd className="mt-0.5 font-medium">
              {fmtDay(r.tripDate)} · pickup {fmtTimeWindow(r.pickupWindowAt)}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Cargo</dt>
          <dd className="mt-0.5 font-medium">
            {r.cargoDescription} · {r.quantity} {r.unit} · {kg(r.weightKg)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Pickup</dt>
          <dd className="mt-0.5">{placeLabel(r.pickup)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Drop-off</dt>
          <dd className="mt-0.5">{placeLabel(r.dropoff)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Instant quote</dt>
          <dd className="mt-0.5 font-semibold tabular">{peso(r.quotedFreight)}</dd>
        </div>
        {r.bookingRef && (
          <div>
            <dt className="text-xs text-muted-foreground">Booking reference</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono">{r.bookingRef}</span>
              {r.bookingStatus && <StatusBadge status={r.bookingStatus} className="text-[11px]" />}
            </dd>
          </div>
        )}
      </dl>
      {onClose && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      )}
    </Card>
  );
}
