import { Banana, Carrot, Citrus, Fish, LeafyGreen, Shell, Shrimp } from "lucide-react";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };
const svg = (paths: React.ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {paths}
      </svg>
    );
  };

const Onion = svg(
  <>
    <path d="M12 3c0 2-1 3-1 3M12 3c0 2 1 3 1 3" />
    <path d="M12 6c-4 1.5-7 5-7 9a7 5.5 0 0 0 14 0c0-4-3-7.5-7-9z" />
    <path d="M12 6c-1.8 2.5-2.5 5.5-2.5 9M12 6c1.8 2.5 2.5 5.5 2.5 9" />
    <path d="M10 20.3 9 22M14 20.3l1 1.7M12 20.5V22" />
  </>,
);
const Garlic = svg(
  <>
    <path d="M12 2v4" />
    <path d="M12 6c-3 2-7 4-7 8.5A5.5 5.5 0 0 0 10.5 20h3a5.5 5.5 0 0 0 5.5-5.5C19 10 15 8 12 6z" />
    <path d="M12 6c-1.5 3-2 6-1.5 14M12 6c1.5 3 2 6 1.5 14" />
  </>,
);
const Ginger = svg(
  <>
    <path d="M4 14c0-2 1.5-3 3-3 .5-2 2-3 3.5-2.5C11 6 13 5.5 14.5 7c1.5-1 3.5 0 3.5 2 1.5.5 2 2 1.5 3.5.8 1.2.2 3-1.5 3.3-.5 1.7-2.5 2.2-3.8 1.2-1.2 1.3-3.5 1.3-4.5-.2-1.5.8-3.5.2-4-1.3C4.8 15.3 4 14.8 4 14z" />
    <path d="M9 12.5c1 .3 2 .2 3-.5M14 11c.8.4 1.8.4 2.5 0" />
  </>,
);
const Tomato = svg(
  <>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 6V3.5M8.5 5.5l3.5 1.2 3.5-1.2M9.5 7.5 12 6.7l2.5.8" />
  </>,
);
const Potato = svg(
  <>
    <path d="M6.5 7.5C9 4.5 15 4 18 7s3 8 0 10.5-9.5 3-12.5.5S4 10.5 6.5 7.5z" />
    <circle cx="10" cy="10" r=".7" fill="currentColor" />
    <circle cx="14.5" cy="12.5" r=".7" fill="currentColor" />
    <circle cx="11" cy="15" r=".7" fill="currentColor" />
  </>,
);
const Crab = svg(
  <>
    <ellipse cx="12" cy="14" rx="6" ry="4" />
    <path d="M6.5 12.5 4 10M17.5 12.5 20 10" />
    <path d="M4 10c-1.5-1-1.5-3 0-4 .5 1.3 1.5 1.6 2.5 1.3M20 10c1.5-1 1.5-3 0-4-.5 1.3-1.5 1.6-2.5 1.3" />
    <path d="M7 16.5 4.5 19M17 16.5l2.5 2.5M9 17.5 8 20.5M15 17.5l1 3" />
    <path d="M10.5 10.5v-1M13.5 10.5v-1" />
  </>,
);
const Squid = svg(
  <>
    <path d="M12 2c-3 2.5-4 5.5-4 8.5V14h8v-3.5C16 7.5 15 4.5 12 2z" />
    <path d="M8 14c-1 3-2.5 5-3.5 6.5M10 14c-.3 3-.9 5.5-1.8 7.5M12 14v8M14 14c.3 3 .9 5.5 1.8 7.5M16 14c1 3 2.5 5 3.5 6.5" />
    <circle cx="10.5" cy="10" r=".7" fill="currentColor" />
    <circle cx="13.5" cy="10" r=".7" fill="currentColor" />
  </>,
);
const Coconut = svg(
  <>
    <circle cx="12" cy="12.5" r="8" />
    <path d="M12 4.5c-2 2-3 4.8-3 8s1 6 3 8M12 4.5c2 2 3 4.8 3 8s-1 6-3 8" />
    <circle cx="10" cy="9" r=".8" fill="currentColor" />
    <circle cx="14" cy="9" r=".8" fill="currentColor" />
    <circle cx="12" cy="11" r=".8" fill="currentColor" />
  </>,
);
const Chili = svg(
  <>
    <path d="M16 5c-.5-1.5-2-2-3-1.5" />
    <path d="M16 5c2 .5 3 2.5 2.5 4.5C17 15 11 20 4.5 20.5c-.8 0-1-1-.3-1.3C9.5 17 13 12.5 13.5 8 13.7 6 14.5 5 16 5z" />
  </>,
);
const SweetPotato = svg(
  <>
    <path d="M3.5 13c1-4 6-7.5 11-7.5s6.5 2.5 6 5.5-4.5 6.5-10 7S2.8 16 3.5 13z" />
    <path d="M8 11.5c2-1.5 5-2.2 8-2" />
  </>,
);

const ICONS: Record<Product["icon"], React.ComponentType<IconProps>> = {
  shrimp: Shrimp,
  shell: Shell,
  fish: Fish,
  crab: Crab,
  squid: Squid,
  onion: Onion,
  garlic: Garlic,
  ginger: Ginger,
  tomato: Tomato,
  potato: Potato,
  carrot: Carrot,
  cabbage: LeafyGreen,
  citrus: Citrus,
  coconut: Coconut,
  banana: Banana,
  chili: Chili,
  "sweet-potato": SweetPotato,
};

const TONES: Record<string, string> = {
  shrimp: "from-orange-100 to-rose-50 text-orange-600",
  shell: "from-emerald-100 to-slate-50 text-emerald-700",
  fish: "from-sky-100 to-blue-50 text-sky-700",
  crab: "from-amber-100 to-orange-50 text-amber-700",
  squid: "from-violet-100 to-pink-50 text-violet-700",
  onion: "from-rose-100 to-fuchsia-50 text-rose-700",
  "onion-white": "from-stone-100 to-amber-50 text-stone-600",
  garlic: "from-stone-100 to-amber-50 text-stone-600",
  ginger: "from-amber-100 to-yellow-50 text-amber-700",
  tomato: "from-red-100 to-orange-50 text-red-600",
  potato: "from-yellow-100 to-amber-50 text-amber-800",
  carrot: "from-orange-100 to-amber-50 text-orange-600",
  cabbage: "from-lime-100 to-green-50 text-green-700",
  citrus: "from-lime-100 to-emerald-50 text-lime-700",
  coconut: "from-amber-100 to-stone-100 text-amber-900",
  banana: "from-yellow-100 to-lime-50 text-yellow-700",
  chili: "from-red-100 to-rose-50 text-red-700",
  "sweet-potato": "from-orange-100 to-rose-50 text-orange-700",
};

export function ProductImage({ product, size = "md", className }: { product: Product; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const Icon = ICONS[product.icon];
  const tone = TONES[product.id === "P-ONW" ? "onion-white" : product.icon];
  const box = {
    xs: "size-7 rounded-md",
    sm: "size-9 rounded-md",
    md: "size-12 rounded-lg",
    lg: "aspect-[4/3] w-full rounded-lg",
    xl: "aspect-[4/3] w-full rounded-xl",
  }[size];
  const icon = { xs: "size-4", sm: "size-5", md: "size-6", lg: "size-16", xl: "size-24" }[size];
  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br", tone, box, className)} role="img" aria-label={`${product.name} ${product.variant ?? ""}`}>
      {(size === "lg" || size === "xl") && (
        <svg className="absolute inset-0 size-full opacity-[0.12]" aria-hidden>
          <defs>
            <pattern id={`dots-${product.id}`} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dots-${product.id})`} />
        </svg>
      )}
      <Icon className={cn(icon, "relative")} />
    </div>
  );
}
