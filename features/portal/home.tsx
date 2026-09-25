import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, FileQuestion, MessageCircle, Phone, Globe, ShieldCheck, Ship, Snowflake, Truck, Undo2, CheckCircle2 } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { COMPANY, PLATFORM } from "@/data/company";
import { INTER_ISLAND_PARTNER } from "@/data/areas";
import { DELIVERY_SCHEDULE } from "@/lib/portal";
import { peso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/shared/product-image";

const SEAFOOD_HIGHLIGHT = ["P-SUG-L", "P-TAH", "P-TAL", "P-HIP-S", "P-ALI-F", "P-BAN"];
const PRODUCE_HIGHLIGHT = ["P-ONR", "P-GAR", "P-GIN", "P-ONW", "P-NIY", "P-POT"];

export function PortalHome() {
  const seafood = SEAFOOD_HIGHLIGHT.map((id) => PRODUCTS.find((p) => p.id === id)!);
  const produce = PRODUCE_HIGHLIGHT.map((id) => PRODUCTS.find((p) => p.id === id)!);
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-[oklch(0.25_0.045_220)] text-white">
        <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="waves" width="80" height="24" patternUnits="userSpaceOnUse">
              <path d="M0 12 Q 20 2 40 12 T 80 12" fill="none" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#waves)" />
        </svg>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div className="grid content-center gap-5">
            <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">{COMPANY.name} · Lucena City, Quezon</span>
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl lg:text-[44px]">Fresh seafood and agricultural products delivered to businesses across Luzon and selected destinations nationwide.</h1>
            <p className="max-w-xl text-white/75">Wholesale sugpo, tahong, talaba and Quezon produce every morning to Metro Manila, Cavite, Laguna and Batangas — and onions, garlic and luya for Quezon buyers on the way back. {PLATFORM.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="xl" className="bg-white text-[oklch(0.3_0.06_210)] hover:bg-white/90" asChild>
                <Link href="/products">
                  Browse Products <ArrowRight />
                </Link>
              </Button>
              <Button size="xl" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/request-quote">
                  <FileQuestion /> Request Wholesale Quote
                </Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#9be3d9]" /> MOQ from 10–50 kg
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#9be3d9]" /> Credit terms for regular accounts
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#9be3d9]" /> 6 dispatch days a week
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            {[...seafood.slice(0, 2), ...produce.slice(0, 2)].map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="overflow-hidden rounded-xl bg-white/95 text-foreground shadow-lg transition-transform hover:-translate-y-0.5">
                <ProductImage product={p} size="lg" className="rounded-none" />
                <div className="p-3">
                  <div className="text-sm font-semibold">{p.name.split(" / ")[0]}</div>
                  <div className="text-xs text-muted-foreground">from {peso(p.wholesalePrice)}/{p.unit} · indicative</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3">
          {[
            { icon: Globe, t: "Order online", d: "Build your wholesale order here — our desk confirms stock and price." },
            { icon: MessageCircle, t: "Or message us", d: `Messenger ${COMPANY.messenger} — same order desk, same system.` },
            { icon: Phone, t: "Or call", d: `${COMPANY.mobile} · ${COMPANY.phone}, from 2:00 AM daily.` },
          ].map((c) => (
            <div key={c.t} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                <c.icon className="size-5" />
              </span>
              <div>
                <div className="font-semibold">{c.t}</div>
                <p className="text-sm text-muted-foreground">{c.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <ProductStrip title="Fresh Seafood" subtitle="Harvested in Pagbilao, Tayabas and Tayabas Bay — iced at our Lucena bodega before the 3:30 AM dispatch." items={seafood} href="/products?category=seafood" />
      <ProductStrip title="Agricultural Produce" subtitle="Onion, garlic and luya bought on our Manila return trips, plus Quezon niyog, saba and kamote." items={produce} href="/products?category=produce" />

      {/* Schedule + logistics */}
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-12 lg:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CalendarClock className="size-5 text-primary" /> Scheduled Deliveries
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Two closed vans leave Lucena six days a week. Order by 8:00 PM for next-morning delivery.</p>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card">
            {DELIVERY_SCHEDULE.map((d) => (
              <div key={d.day} className="grid grid-cols-[100px_1fr] gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
                <span className="font-medium">{d.day}</span>
                <span className="text-muted-foreground">{d.routes.join("  ·  ")}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid content-start gap-4">
          <h2 className="text-xl font-semibold">Wholesale Ordering, Reliable Logistics</h2>
          {[
            { icon: ClipboardCheck, t: "Wholesale ordering", d: "Negotiated prices, MOQs, standing weekly orders and credit terms for regular buyers. Every order is confirmed by our desk." },
            { icon: Snowflake, t: "Iced and closed vans", d: "Seafood is packed in iced styro boxes and banyera inside insulated 10-wheeler closed vans." },
            { icon: Truck, t: "Tracked deliveries", d: "Delivery receipts, proof of delivery photos and signed DRs for every drop." },
            { icon: Undo2, t: "We haul back too", d: "Quezon buyers get onions, garlic and luya from our Manila return loads — no separate trucking cost." },
          ].map((f) => (
            <div key={f.t} className="flex gap-3 rounded-xl border bg-card p-4">
              <f.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <div className="font-semibold">{f.t}</div>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Areas */}
      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-xl font-semibold">Serving Luzon, Visayas & Mindanao</h2>
            <p className="mt-2 text-sm text-muted-foreground">Direct truck deliveries across Southern Luzon. Larger orders for Visayas and Mindanao ship through our sea-freight partner.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Lucena", "Quezon Province", "Navotas", "Valenzuela", "Metro Manila", "Cavite", "Laguna", "Batangas"].map((a) => (
                <span key={a} className="rounded-full border bg-background px-3 py-1 text-sm">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-background p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Ship className="size-5 text-primary" /> Inter-island distribution
            </div>
            <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
              {["Lucena bodega", INTER_ISLAND_PARTNER.handover, `${INTER_ISLAND_PARTNER.name} (reefer)`, "Regional distributor"].map((s, i) => (
                <li key={s} className="flex items-start gap-2 sm:flex-col">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">Currently supplying distributors in Cebu City, Iloilo City, Bacolod, Davao City and Cagayan de Oro. 50% down payment; freight quoted per shipment.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-accent/60 p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Buying 100 kg or more every week?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ask for a negotiated wholesale price and a standing weekly order.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/request-quote">Request Wholesale Quote</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">
                <ShieldCheck /> Open a credit account
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function ProductStrip({ title, subtitle, items, href }: { title: string; subtitle: string; items: typeof PRODUCTS; href: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex">
          View all <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p) => (
          <Link key={p.id} href={`/products/${p.slug}`} className="overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
            <ProductImage product={p} size="lg" className="rounded-none" />
            <div className="p-3">
              <div className="text-sm font-semibold leading-tight">{p.name.split(" / ")[0]}</div>
              <div className="text-xs text-muted-foreground">{p.variant}</div>
              <div className="mt-1 text-sm font-medium tabular">
                {peso(p.wholesalePrice)}
                <span className="text-xs font-normal text-muted-foreground">/{p.unit}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Indicative demo prices — final price confirmed with your order.</p>
    </section>
  );
}
