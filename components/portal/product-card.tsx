"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, FileQuestion, MapPin, Minus, Plus, ShoppingCart } from "lucide-react";
import type { Product } from "@/types";
import { useAppStore } from "@/lib/store";
import { useStock } from "@/hooks/use-data";
import { nextDispatch, portalAvailability } from "@/lib/portal";
import { peso, qty } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/primitives";
import { ProductImage } from "@/components/shared/product-image";

export function QtyStepper({ value, onChange, step, min, unit, id }: { value: number; onChange: (v: number) => void; step: number; min: number; unit: string; id?: string }) {
  return (
    <div className="flex items-center rounded-md border bg-card">
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(Math.max(min, value - step))} aria-label="Decrease quantity">
        <Minus />
      </Button>
      <Input id={id} type="number" inputMode="numeric" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-16 border-0 px-1 text-center shadow-none focus-visible:ring-0" aria-label={`Quantity in ${unit}`} />
      <span className="pr-1 text-xs text-muted-foreground">{unit === "pc" ? "pcs" : unit}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value + step)} aria-label="Increase quantity">
        <Plus />
      </Button>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const add = useAppStore((s) => s.addToCart);
  const stock = useStock();
  const available = portalAvailability(product, stock.get(product.id));
  const step = product.unit === "pc" ? 50 : product.moq >= 50 ? 50 : 10;
  const [q, setQ] = React.useState(product.moq);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <Link href={`/products/${product.slug}`} className="relative block">
        <ProductImage product={product} size="lg" className="rounded-none" />
        <Badge variant={product.category === "seafood" ? "info" : "success"} className="absolute top-2 left-2">
          {product.category === "seafood" ? "Seafood" : "Produce"}
        </Badge>
        {product.status === "seasonal" && (
          <Badge variant="warning" className="absolute top-2 right-2">
            Seasonal
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <Link href={`/products/${product.slug}`} className="font-semibold leading-tight hover:underline">
            {product.name}
          </Link>
          <div className="text-xs text-muted-foreground">{product.variant}</div>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground">Indicative wholesale price</div>
            <div className="text-lg font-semibold tabular">
              {peso(product.wholesalePrice)}
              <span className="text-sm font-normal text-muted-foreground">/{product.unit === "pc" ? "pc" : "kg"}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">Available</div>
            <div className={available ? "text-sm font-medium tabular" : "text-sm font-medium text-[oklch(0.55_0.13_65)]"}>{available ? qty(available, product.unit) : "On request"}</div>
          </div>
        </div>
        <dl className="grid gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {product.origin}
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5" /> {nextDispatch(product)}
          </div>
          <div>
            Minimum order <b className="text-foreground">{qty(product.moq, product.unit)}</b> · sold per {product.unit === "pc" ? "piece" : "kg"}
          </div>
        </dl>
        <div className="mt-auto grid gap-2 pt-2">
          <QtyStepper value={q} onChange={setQ} step={step} min={product.moq} unit={product.unit} />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (q < product.moq) return toast.error(`Minimum order is ${qty(product.moq, product.unit)}`);
                add(product.id, q);
                toast.success(`Added ${qty(q, product.unit)} ${product.localName ?? product.name}`, { action: { label: "View order", onClick: () => router.push("/order") } });
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
      </div>
    </article>
  );
}
