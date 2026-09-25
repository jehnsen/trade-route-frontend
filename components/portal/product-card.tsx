"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, CalendarClock, FileQuestion, MapPin, Minus, Plus, ShoppingCart } from "lucide-react";
import type { Product } from "@/types";
import { useAppStore } from "@/lib/store";
import { useStock } from "@/hooks/use-data";
import { nextDispatch, portalAvailability } from "@/lib/portal";
import { peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/primitives";
import { ProductImage } from "@/components/shared/product-image";

export function QtyStepper({
  value,
  onChange,
  step,
  min,
  unit,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  unit: string;
  id?: string;
}) {
  return (
    <div className="flex items-center rounded-md border bg-card">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="Decrease quantity"
      >
        <Minus />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="h-8 w-16 border-0 px-1 text-center shadow-none focus-visible:ring-0"
        aria-label={`Quantity in ${unit}`}
      />
      <span className="pr-1 text-xs text-muted-foreground">{unit === "pc" ? "pcs" : unit}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value + step)} aria-label="Increase quantity">
        <Plus />
      </Button>
    </div>
  );
}

export function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const router = useRouter();
  const add = useAppStore((s) => s.addToCart);
  const stock = useStock();
  const available = portalAvailability(product, stock.get(product.id));
  const step = product.unit === "pc" ? 50 : product.moq >= 50 ? 50 : 10;
  const [q, setQ] = React.useState(product.moq);
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-[#b9c8ab] hover:shadow-[0_12px_30px_-15px_#243c2b33]">
      <Link href={`/products/${product.slug}`} className="relative block overflow-hidden">
        <ProductImage product={product} size="lg" className="rounded-none transition-transform duration-500 group-hover:scale-[1.04]" />
        <Badge
          variant="outline"
          className="absolute top-3 left-3 border-white/60 bg-white/95 text-[10px] font-medium text-[#3e5940] shadow-sm"
        >
          {product.category === "seafood" ? "Seafood" : "Produce"}
        </Badge>
        {product.status === "seasonal" && (
          <Badge variant="warning" className="absolute top-2 right-2">
            Seasonal
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <Link href={`/products/${product.slug}`} className="text-[14px] font-semibold leading-tight tracking-tight hover:underline">
            {product.name}
          </Link>
          <div className="mt-1.5 text-[11px] text-muted-foreground">{product.variant}</div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground">Indicative wholesale price</div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight tabular">
              {peso(product.wholesalePrice)}
              <span className="text-sm font-normal text-muted-foreground">/{product.unit === "pc" ? "pc" : "kg"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Available</div>
            <div className={available ? "text-sm font-medium tabular" : "text-sm font-medium text-[oklch(0.55_0.13_65)]"}>
              {available ? qty(available, product.unit) : "On request"}
            </div>
          </div>
        </div>
        {compact ? (
          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-[10px] text-muted-foreground">
              Min. order <b className="font-medium text-foreground">{qty(product.moq, product.unit)}</b>
            </span>
            <Button variant="ghost" size="icon-sm" className="rounded-full bg-[#eff3e9] text-[#43613e] hover:bg-[#e2ebd8]" asChild>
              <Link href={`/products/${product.slug}`} aria-label={`View ${product.name}, ${product.variant}`}>
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-1.5 text-xs leading-5 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {product.origin}
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" /> {nextDispatch(product)}
              </div>
              <div>
                Minimum order <b className="text-foreground">{qty(product.moq, product.unit)}</b> · sold per{" "}
                {product.unit === "pc" ? "piece" : "kg"}
              </div>
            </div>
            <div className="mt-auto grid gap-2 pt-2">
              <QtyStepper value={q} onChange={setQ} step={step} min={product.moq} unit={product.unit} />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (q < product.moq) return toast.error(`Minimum order is ${qty(product.moq, product.unit)}`);
                    add(product.id, q);
                    toast.success(`Added ${qty(q, product.unit)} ${product.localName ?? product.name}`, {
                      action: { label: "View order", onClick: () => router.push("/order") },
                    });
                  }}
                >
                  <ShoppingCart /> Add to Order
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/request-quote?product=${product.id}`}>
                    <FileQuestion /> Quote
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
