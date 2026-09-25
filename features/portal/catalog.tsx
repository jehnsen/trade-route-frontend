"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Fish, Leaf, Search, SlidersHorizontal, X } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/primitives";
import { EmptyState, DemoPriceNote } from "@/components/shared/common";
import { ProductCard } from "@/components/portal/product-card";
import { Button } from "@/components/ui/button";

export function PortalCatalog({ initialCategory }: { initialCategory?: string }) {
  const [cat, setCat] = React.useState(initialCategory === "seafood" || initialCategory === "produce" ? initialCategory : "all");
  const [q, setQ] = React.useState("");
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter(
    (p) =>
      p.status !== "inactive" &&
      (cat === "all" || p.category === cat) &&
      terms.every((t) => `${p.name} ${p.localName} ${p.variant} ${p.origin}`.toLowerCase().includes(t)),
  );
  return (
    <div className="portal-container py-10 sm:py-14">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="portal-eyebrow">From our sources to your business</p>
          <h1 className="portal-heading mt-3">Your next fresh order starts here.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Seafood from Quezon’s coasts. Produce for your everyday trade. Explore our wholesale range and let our order desk take care of
            the rest.
          </p>
        </div>
        <Button asChild variant="outline" className="w-fit gap-3 text-xs">
          <Link href="/request-quote">
            Need a bulk price? <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </div>
      <div className="mt-9 flex flex-col justify-between gap-4 border-y py-4 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#eff2e8] p-1" role="group" aria-label="Product category">
          {[
            { value: "all", label: "All products", icon: SlidersHorizontal },
            { value: "seafood", label: "Seafood", icon: Fish },
            { value: "produce", label: "Produce", icon: Leaf },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={cat === value}
              onClick={() => setCat(value)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors",
                cat === value ? "bg-white text-[#31573e] shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search product, origin or variety…"
            className="h-10 rounded-lg bg-white pr-9 pl-10 text-xs"
            aria-label="Search products"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="my-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" role="status">
          {list.length} {list.length === 1 ? "product" : "products"}
          {cat !== "all" && ` in ${cat}`}
        </p>
        <DemoPriceNote className="text-[10px]" />
      </div>
      {list.length === 0 ? (
        <EmptyState
          title="No products match your search."
          description="Try another product name or browse all of our wholesale products."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setCat("all");
              }}
            >
              Clear filters
            </Button>
          }
          className="mt-6 bg-card"
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
