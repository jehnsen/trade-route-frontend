import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Fish,
  Leaf,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Repeat2,
  ShieldCheck,
  Ship,
  Snowflake,
  Truck,
} from "lucide-react";
import { COMPANY } from "@/data/company";
import { DELIVERY_SCHEDULE } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { FeaturedProducts } from "@/features/portal/featured-products";

export function PortalHome() {
  return (
    <>
      <section className="storefront-hero relative overflow-hidden bg-[#102e32] text-white">
        <div className="portal-container relative grid items-center gap-10 py-12 lg:grid-cols-[1.03fr_1fr] lg:gap-14 lg:py-16">
          <div className="hero-copy relative z-10 py-2 lg:py-5">
            <p className="mb-7 inline-flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] text-[#c5e4d9] uppercase">
              <span className="size-1.5 rounded-full bg-[#c0e6a0]" /> Rooted in Quezon. Ready for your business.
            </p>
            <h1 className="max-w-xl text-[clamp(2.8rem,5.5vw,4.65rem)] leading-[1.06] font-semibold tracking-[-0.055em]">
              Fresh supply.
              <br />
              Stronger <span className="font-editorial font-normal italic text-[#c8e6b1]">business.</span>
            </h1>
            <p className="mt-6 max-w-[440px] text-[15px] leading-[1.85] text-[#c5d2d1]">
              Quality seafood. Farm-fresh produce. Dependable delivery. Your wholesale partner from the shores of Quezon to the heart of
              your business.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="xl"
                className="h-12 gap-5 rounded-lg bg-[#c8e6b1] px-6 text-sm text-[#173831] shadow-none hover:bg-[#dbefca]"
                asChild
              >
                <Link href="/products">
                  Explore our products <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="h-12 rounded-lg border-white/25 bg-transparent px-6 text-sm text-white shadow-none hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/request-quote">Get a wholesale quote</Link>
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-5 gap-y-3 text-[11px] text-[#c5d2d1]">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-[#c8e6b1]" /> Wholesale quantities
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-[#c8e6b1]" /> Flexible credit terms
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-[#c8e6b1]" /> Personal service
              </span>
            </div>
          </div>
          <div className="hero-visual relative mb-5 lg:my-2">
            <div className="relative aspect-[1.1] overflow-hidden rounded-2xl bg-[#234448] sm:aspect-[1.35] lg:aspect-[1.06]">
              <Image
                src="/images/seafood-hero.webp"
                alt="Fresh tiger prawns, mussels and fish arranged on crushed ice"
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 600px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102e32]/65 via-transparent to-transparent" />
              <div className="absolute top-5 right-5 flex size-[86px] rotate-12 flex-col items-center justify-center rounded-full border border-white/40 bg-[#f7f8ed]/95 text-center text-[#284638] shadow-lg">
                <Leaf className="mb-1 size-5" />
                <span className="text-[9px] leading-relaxed font-bold tracking-[0.13em] uppercase">
                  Sourced
                  <br />
                  with care
                </span>
              </div>
              <div className="absolute right-5 bottom-6 flex items-center gap-2 text-[11px] font-medium text-white/90">
                <MapPin className="size-3.5" /> Lucena City, Quezon
              </div>
            </div>
            <div className="absolute -bottom-5 left-4 flex items-center gap-4 rounded-xl border border-[#e5e9df] bg-[#fafbf6] p-4 text-[#16372f] shadow-xl sm:-left-6 sm:px-5">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#e8efdf]">
                <Truck className="size-5" strokeWidth={1.6} />
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.12em] text-[#6b766a] uppercase">Freshness on the move</p>
                <p className="mt-1 text-[13px] font-semibold">Early dispatch. Six days a week.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="portal-container flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-5 text-xs text-[#c5d2d1]">
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-[#c8e6b1] uppercase">
              <MapPin className="size-3.5" /> Our delivery network
            </span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-7">
              <span>Quezon</span>
              <span className="text-white/25">/</span>
              <span>Metro Manila</span>
              <span className="text-white/25">/</span>
              <span>Cavite</span>
              <span className="text-white/25">/</span>
              <span>Laguna</span>
              <span className="text-white/25">/</span>
              <span>Batangas</span>
            </div>
            <a href="#delivery" className="inline-flex items-center gap-2 text-white hover:text-[#c8e6b1]">
              And beyond <ArrowDown className="size-3.5" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e2e7df] bg-[#f8f9f4]" aria-label="The TradeLoop difference">
        <div className="portal-container grid grid-cols-2 gap-x-6 gap-y-7 py-8 lg:grid-cols-4 lg:gap-8">
          {[
            { icon: Fish, title: "Closer to the source", text: "Seafood from Quezon's coastal farms" },
            { icon: Snowflake, title: "Handled with care", text: "Iced, packed and ready for the road" },
            { icon: Truck, title: "Delivery you can plan for", text: "Scheduled routes, Monday–Saturday" },
            { icon: ShieldCheck, title: "Built for wholesale", text: "Bulk pricing. A dedicated order desk." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3.5">
              <Icon className="mt-0.5 size-6 shrink-0 text-[#52715a]" strokeWidth={1.4} />
              <div>
                <h2 className="text-[13px] font-semibold text-[#253b30]">{title}</h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#65715e]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FeaturedProducts />

      <section className="portal-container grid gap-5 pb-20 md:grid-cols-2" aria-label="Shop by category">
        <Link
          href="/products?category=seafood"
          className="category-feature group relative isolate flex min-h-[285px] items-end overflow-hidden rounded-xl bg-[#163a3b] p-7 sm:p-8"
        >
          <Image
            src="/images/seafood-hero.webp"
            alt="A selection of fresh seafood on ice"
            fill
            sizes="(max-width: 767px) 100vw, 600px"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 -z-0 bg-gradient-to-r from-[#102e32]/95 via-[#102e32]/70 to-[#102e32]/10" />
          <div className="relative text-white">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-[#c8e6b1] uppercase">From our coasts</span>
            <h2 className="mt-3 text-3xl font-medium tracking-tight">The freshest catch.</h2>
            <p className="mt-2 max-w-[270px] text-sm leading-relaxed text-white/75">
              Sugpo, tahong, talaba and more.
              <br />
              Sourced locally. Ready for your kitchen.
            </p>
            <span className="mt-6 inline-flex items-center gap-3 text-xs font-semibold">
              Shop seafood <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
        <Link
          href="/products?category=produce"
          className="category-feature group relative isolate flex min-h-[285px] items-end overflow-hidden rounded-xl bg-[#eef0e2] p-7 sm:p-8"
        >
          <Image
            src="/images/onions.webp"
            alt="Fresh red onions with rich purple skins"
            fill
            sizes="(max-width: 767px) 100vw, 600px"
            className="object-cover object-right transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#e9eddd] via-[#e9eddd]/95 to-[#e9eddd]/15" />
          <div className="relative text-[#253d2a]">
            <span className="text-[10px] font-semibold tracking-[0.18em] text-[#576d48] uppercase">From farm to business</span>
            <h2 className="mt-3 text-3xl font-medium tracking-tight">Everyday essentials.</h2>
            <p className="mt-2 max-w-[270px] text-sm leading-relaxed text-[#586450]">
              Onions, garlic, ginger and Quezon produce.
              <br />
              The ingredients your business runs on.
            </p>
            <span className="mt-6 inline-flex items-center gap-3 text-xs font-semibold">
              Shop agricultural produce <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </section>

      <section id="delivery" className="scroll-mt-24 border-y border-[#e3e7de] bg-[#f1f3ec] py-16 sm:py-20">
        <div className="portal-container grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <p className="portal-eyebrow">Good products. A better route.</p>
            <h2 className="portal-heading mt-4">
              Fresh going out.
              <br />
              <span className="font-editorial font-normal italic text-[#587452]">Value coming back.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#707a6e]">
              Our trucks take Quezon seafood to businesses across Southern Luzon, then bring quality produce home. Connected deliveries mean
              fuller trucks and more value for the businesses we serve.
            </p>
            <div className="mt-7 grid gap-5">
              {[
                {
                  icon: PackageCheck,
                  title: "One order desk, every step",
                  text: "Order online, on Messenger or by phone. We confirm stock, pricing and delivery with you.",
                },
                {
                  icon: Repeat2,
                  title: "A smarter return journey",
                  text: "Manila-sourced onions, garlic and ginger come back on our return loads for Quezon buyers.",
                },
                {
                  icon: Ship,
                  title: "Connections beyond Luzon",
                  text: "Selected Visayas and Mindanao orders travel through our sea-freight partner.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d8e0d0] bg-white/60">
                    <Icon className="size-4 text-[#587452]" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-6 text-[#707a6e]">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#dce3d7] bg-[#fcfdf9] shadow-[0_8px_32px_-20px_#183b2c33]">
            <div className="flex items-center justify-between border-b border-[#e5e9df] px-6 py-5">
              <h3 className="text-sm font-semibold">A connected supply journey</h3>
              <span className="rounded-full bg-[#edf2e6] px-2.5 py-1 text-[10px] font-medium text-[#537044]">Our regular routes</span>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#6b7565] uppercase">Our home base</span>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">Lucena</p>
                  <p className="mt-1 text-xs text-[#6b7565]">Quezon Province</p>
                </div>
                <div className="rounded-full border border-[#dce5d5] bg-[#f1f5eb] p-3">
                  <Truck className="size-6 text-[#547347]" strokeWidth={1.5} />
                </div>
              </div>
              <div className="my-6 grid grid-cols-[24px_1fr] gap-4">
                <div className="relative flex flex-col items-center justify-between py-2">
                  <span className="absolute inset-y-3 border-l border-dashed border-[#9eaf8e]" />
                  <span className="relative size-2.5 rounded-full border-[3px] border-[#537548] bg-white" />
                  <ArrowDown className="relative size-5 bg-[#fcfdf9] text-[#537548]" />
                  <span className="relative size-2.5 rounded-full border-[3px] border-[#537548] bg-white" />
                </div>
                <div className="grid gap-5">
                  <div className="rounded-lg border border-[#e1e8db] bg-[#f3f6ee] p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-[#4f6d43]">
                      <Fish className="size-3.5" /> OUTBOUND · FRESH SEAFOOD
                    </p>
                    <p className="mt-2 text-xs text-[#65715e]">Metro Manila · Cavite · Laguna · Batangas</p>
                  </div>
                  <div className="rounded-lg border border-[#e7e3d4] bg-[#f8f6ed] p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-[#857147]">
                      <Leaf className="size-3.5" /> RETURN · AGRICULTURAL PRODUCE
                    </p>
                    <p className="mt-2 text-xs text-[#776f5c]">From Manila suppliers back to Quezon buyers</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-[#e5e9df] pt-4 text-xs leading-5 text-[#6d7766]">
                <ClipboardCheck className="mt-0.5 size-4 shrink-0" />
                <p>
                  Order by <strong className="text-[#374b31]">8:00 PM</strong> for next-morning delivery on scheduled routes, subject to
                  confirmation.
                </p>
              </div>
            </div>
            <details className="group border-t border-[#e5e9df]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-xs font-semibold hover:bg-[#f3f6ee] [&::-webkit-details-marker]:hidden">
                View the weekly delivery schedule <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-[#e5e9df] px-6 py-2">
                {DELIVERY_SCHEDULE.map((day) => (
                  <div key={day.day} className="grid grid-cols-[85px_1fr] gap-3 border-b border-[#e5e9df] py-3 text-xs last:border-0">
                    <span className="font-medium">{day.day}</span>
                    <span className="leading-5 text-[#6d7766]">{day.routes.join(" · ")}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </section>

      <section className="portal-container py-16 sm:py-20">
        <div className="mb-10 text-center">
          <p className="portal-eyebrow">Your business. Your way.</p>
          <h2 className="portal-heading mt-3">Let’s get your next order moving.</h2>
          <p className="mt-4 text-sm text-[#677360]">A few clicks or a quick conversation. It all starts with our order desk.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: ClipboardCheck,
              number: "01",
              title: "Build your wholesale order",
              text: "Explore our range, choose your quantities and send your order for confirmation.",
              action: "Browse products",
              href: "/products",
            },
            {
              icon: MessageCircle,
              number: "02",
              title: "Talk quantities. Talk price.",
              text: "Buying 100 kg or more each week? Let’s arrange pricing and a standing order.",
              action: "Request a quote",
              href: "/request-quote",
            },
            {
              icon: Phone,
              number: "03",
              title: "Prefer a familiar voice?",
              text: "Our team is ready to help with stock, routes and your next order from 2:00 AM.",
              action: COMPANY.mobile,
              href: `tel:${COMPANY.mobile.replace(/\s/g, "")}`,
            },
          ].map(({ icon: Icon, number, title, text, action, href }) => (
            <div key={title} className="rounded-xl border border-[#e3e7de] bg-white p-6 sm:p-7">
              <div className="mb-6 flex items-center justify-between">
                <Icon className="size-6 text-[#5b7953]" strokeWidth={1.5} />
                <span className="font-editorial text-3xl italic text-[#c6cebe]">{number}</span>
              </div>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#677360]">{text}</p>
              <Link href={href} className="mt-6 inline-flex items-center gap-3 text-xs font-semibold text-[#456a42] hover:underline">
                {action} <ArrowUpRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="portal-container pb-16">
        <div className="relative overflow-hidden rounded-2xl bg-[#183d35] px-7 py-10 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="relative">
            <p className="text-[10px] font-semibold tracking-[0.17em] text-[#c8e6b1] uppercase">Grow with a partner who delivers</p>
            <h2 className="mt-3 text-3xl leading-tight font-medium tracking-tight sm:text-4xl">
              Fresh possibilities.
              <br className="sm:hidden" /> Every delivery.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#bdcec4]">
              From your first wholesale order to your weekly supply, we’re here to keep your business moving.
            </p>
          </div>
          <Button
            size="xl"
            asChild
            className="relative mt-7 h-12 gap-6 bg-[#c8e6b1] text-sm text-[#183d35] shadow-none hover:bg-[#dbefca] lg:mt-0"
          >
            <Link href="/request-quote">
              Let’s talk wholesale <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
