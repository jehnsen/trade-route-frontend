"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { Award, Box, CalendarDays, ChevronRight, FileQuestion, MapPin, ShoppingCart, Thermometer } from "lucide-react";
import type { Product } from "@/types";
import { useAppStore } from "@/lib/store";
import { useStock } from "@/hooks/use-data";
import { TODAY } from "@/data/company";
import { PRODUCTS } from "@/data/products";
import { nextDispatch, portalAvailability } from "@/lib/portal";
import { peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoPriceNote } from "@/components/shared/common";
import { ProductImage } from "@/components/shared/product-image";
import { ProductCard, QtyStepper } from "@/components/portal/product-card";

export function PortalProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const add = useAppStore((s) => s.addToCart);
  const stock = useStock();
  const available = portalAvailability(product, stock.get(product.id));
  const step = product.unit === "pc" ? 50 : product.moq >= 50 ? 50 : 10;
  const [q, setQ] = React.useState(Math.max(product.moq, product.unit === "pc" ? 500 : 50));
  const bulk = q >= product.bulkThreshold;
  const dates = Array.from({ length: 8 }, (_, i) => format(addDays(parseISO(TODAY), i + 1), "yyyy-MM-dd")).filter((d) => parseISO(d).getDay() !== 0).slice(0, 5);
  const related = PRODUCTS.filter((p) => p.id !== product.id && p.subcategory === product.subcategory).slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/products" className="hover:underline">
          Products
        </Link>
        <ChevronRight className="size-3" />
        <span>{product.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <ProductImage product={product} size="xl" />
        <div className="grid content-start gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={product.category === "seafood" ? "info" : "success"}>{product.category === "seafood" ? "Seafood" : "Agricultural produce"}</Badge>
              <Badge variant="outline">{product.subcategory}</Badge>
              <Badge variant="outline">SKU {product.sku}</Badge>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
            <div className="text-muted-foreground">
              {product.localName} · {product.variant}
            </div>
          </div>
          <p className="text-sm leading-relaxed">{product.description}</p>
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Indicative wholesale price</div>
              <div className="text-2xl font-semibold tabular">
                {peso(product.wholesalePrice)}
                <span className="text-sm font-normal text-muted-foreground">/{product.unit}</span>
              </div>
              <div className="text-xs text-muted-foreground">Small lots {peso(product.sellingPrice)}/{product.unit}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Current availability</div>
              <div className="text-2xl font-semibold tabular">{available ? qty(available, product.unit) : "On request"}</div>
              <div className="text-xs text-muted-foreground">{nextDispatch(product)}</div>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              Minimum order <b className="text-foreground">{qty(product.moq, product.unit)}</b> · bulk pricing from {qty(product.bulkThreshold, product.unit)}
            </div>
          </div>
          <div className="grid gap-2 rounded-xl border bg-card p-4">
            <label htmlFor="pd-qty" className="text-sm font-medium">
              Quantity
            </label>
            <QtyStepper id="pd-qty" value={q} onChange={setQ} step={step} min={product.moq} unit={product.unit} />
            <div className="text-sm">
              Estimated amount <b className="tabular">{peso(q * product.wholesalePrice)}</b> <span className="text-muted-foreground">(indicative)</span>
            </div>
            {bulk && (
              <div className="rounded-md bg-accent/70 p-3 text-sm">
                <b>{qty(product.bulkThreshold, product.unit)}+</b> qualifies for negotiated wholesale pricing.
                <Button variant="link" className="h-auto px-1" asChild>
                  <Link href={`/request-quote?product=${product.id}&qty=${q}`}>Request Negotiated Wholesale Price</Link>
                </Button>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => {
                  if (q < product.moq) return toast.error(`Minimum order is ${qty(product.moq, product.unit)}`);
                  add(product.id, q);
                  toast.success(`Added ${qty(q, product.unit)} to your order`, { action: { label: "Review order", onClick: () => router.push("/order") } });
                }}
              >
                <ShoppingCart /> Add to Order
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/request-quote?product=${product.id}&qty=${q}`}>
                  <FileQuestion /> Request Wholesale Quote
                </Link>
              </Button>
            </div>
            <DemoPriceNote />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Info icon={MapPin} label="Origin" value={product.origin} />
            <Info icon={Award} label="Quality grade" value={product.grade} />
            <Info icon={Box} label="Packaging options" value={product.packaging.join(" · ")} />
            <Info icon={Thermometer} label="Storage" value={`${product.storage} Best within ${product.shelfLifeDays} day${product.shelfLifeDays > 1 ? "s" : ""}.`} />
            <Info icon={CalendarDays} label="Available delivery dates" value={dates.map((d) => format(parseISO(d), "EEE MMM d")).join(" · ")} className="sm:col-span-2" />
          </dl>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">Related products</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value, className }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; className?: string }) {
  return (
    <div className={`flex gap-2 rounded-lg border bg-card p-3 ${className ?? ""}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </div>
    </div>
  );
}
