"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Fish, Leaf, SlidersHorizontal } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/portal/product-card";

const FEATURED_IDS = ["P-SUG-L", "P-TAH", "P-ONR", "P-GAR"];
const featured = FEATURED_IDS.map((id) => PRODUCTS.find((product) => product.id === id)!);
const categories = [
  { value: "all", label: "All products", icon: SlidersHorizontal },
  { value: "seafood", label: "Seafood", icon: Fish },
  { value: "produce", label: "Produce", icon: Leaf },
] as const;

export function FeaturedProducts() {
  const [category, setCategory] = useState("all");
  const products = featured.filter((product) => category === "all" || product.category === category);
  return (
    <section className="portal-container py-16 sm:py-20" aria-labelledby="featured-heading">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="portal-eyebrow">The wholesale edit</p>
          <h2 id="featured-heading" className="portal-heading mt-3">
            Fresh picks. Business essentials.
          </h2>
          <p className="mt-3 text-sm text-[#677360]">From coastal harvests to everyday staples, find your next good order.</p>
        </div>
        <Link href="/products" className="inline-flex items-center gap-3 pb-1 text-xs font-semibold text-[#416341] hover:underline">
          Explore the full catalog <ArrowRight className="size-4" />
        </Link>
      </div>
      <div className="mt-7 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg border border-[#e1e6da] bg-[#f2f4ed] p-1"
          role="group"
          aria-label="Filter featured products"
        >
          {categories.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors",
                category === value ? "bg-white text-[#294c36] shadow-sm" : "text-[#63715e] hover:text-[#294c36]",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#6b7565]">Wholesale prices · Confirmed with your order</p>
      </div>
      <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-4" aria-live="polite">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} compact />
        ))}
      </div>
      <p className="mt-4 text-[10px] leading-5 text-[#6b7565]">
        Illustrative product imagery. Demo prices are indicative; availability and final pricing are confirmed by our order desk.
      </p>
    </section>
  );
}
