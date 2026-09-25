"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { PRODUCTS } from "@/data/products";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/primitives";
import { EmptyState, DemoPriceNote } from "@/components/shared/common";
import { ProductCard } from "@/components/portal/product-card";

export function PortalCatalog({ initialCategory }: { initialCategory?: string }) {
  const [cat, setCat] = React.useState(initialCategory === "seafood" || initialCategory === "produce" ? initialCategory : "all");
  const [q, setQ] = React.useState("");
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = PRODUCTS.filter((p) => p.status !== "inactive" && (cat === "all" || p.category === cat) && terms.every((t) => `${p.name} ${p.localName} ${p.variant} ${p.origin}`.toLowerCase().includes(t)));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wholesale Products</h1>
          <p className="text-sm text-muted-foreground">Availability updates as our desk confirms orders. Prices are indicative wholesale prices.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sugpo, tahong, sibuyas…" className="pl-8" aria-label="Search products" />
        </div>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Category">
        {[
          ["all", "All products"],
          ["seafood", "Seafood"],
          ["produce", "Agricultural produce"],
        ].map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={cat === v} onClick={() => setCat(v)} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm cursor-pointer", cat === v ? "border-primary bg-primary text-white" : "bg-card hover:bg-accent")}>
            {l}
          </button>
        ))}
      </div>
      <DemoPriceNote className="mt-3" />
      {list.length === 0 ? (
        <EmptyState title="No products match your search." className="mt-6 bg-card" />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
