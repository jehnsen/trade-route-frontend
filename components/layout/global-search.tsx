"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, MapPin, PackageSearch, Route, ShoppingCart, Store, Truck, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { useAppStore } from "@/lib/store";
import { useInvoices } from "@/hooks/use-data";
import { PRODUCTS, productLabel } from "@/data/products";
import { SUPPLIERS } from "@/data/suppliers";
import { areaName, routeById, AREAS } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { orderTotal } from "@/lib/calc";
import { peso, fmtDateShort } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const trips = useAppStore((s) => s.trips);
  const invoices = useInvoices();

  const results = React.useMemo(() => {
    const query = norm(q.trim());
    if (query.length < 2) return null;
    const terms = query.split(/\s+/);
    const match = (hay: string) => {
      const h = norm(hay);
      return terms.every((t) => h.includes(t));
    };
    const custMap = new Map(customers.map((c) => [c.id, c]));
    const area = AREAS.find((a) => norm(a.name).includes(query) || a.id.includes(query));
    const cs = customers.filter((c) => match(`${c.name} ${c.type} ${areaName(c.areaId)} ${c.contacts.map((x) => x.name).join(" ")} ${c.id}`)).slice(0, 6);
    const os = orders
      .filter((o) => {
        const c = custMap.get(o.customerId);
        return match(`${o.id} ${c?.name ?? ""} ${c ? areaName(c.areaId) : ""} ${o.tripId ?? ""} ${o.status}`);
      })
      .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
      .slice(0, 6);
    const ts = trips
      .filter((t) => match(`${t.id} ${routeById(t.routeId).name} ${truckById(t.truckId).code} ${t.status}`))
      .sort((a, b) => Math.abs(new Date(a.date).getTime() - new Date(TODAY).getTime()) - Math.abs(new Date(b.date).getTime() - new Date(TODAY).getTime()))
      .slice(0, 4);
    const ss = SUPPLIERS.filter((s) => match(`${s.name} ${s.pickupLocation} ${s.address.city} ${s.contactPerson}`)).slice(0, 4);
    const ps = PRODUCTS.filter((p) => match(`${p.name} ${p.localName ?? ""} ${p.variant ?? ""} ${p.sku}`)).slice(0, 4);
    const is = invoices.filter((i) => match(`${i.id} ${custMap.get(i.customerId)?.name ?? ""}`)).slice(0, 4);
    let insight: { label: string; href: string } | null = null;
    if (area) {
      const todays = orders.filter((o) => o.deliveryDate === TODAY && o.status !== "Cancelled" && custMap.get(o.customerId)?.areaId === area.id);
      if (todays.length) insight = { label: `${todays.length} ${area.name.replace(" City", "")} deliveries today`, href: `/deliveries?area=${area.id}` };
    }
    return { cs, os, ts, ss, ps, is, insight, custMap };
  }, [q, orders, customers, trips, invoices]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0" showClose={false}>
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder='Try "Navotas", "FR-260925-001", "sugpo" or "TRIP-260925-01"' autoFocus />
          <CommandList>
            {!results ? (
              <div className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 text-xs font-medium tracking-wide uppercase">Quick searches</div>
                <div className="flex flex-wrap gap-2">
                  {["Navotas", "RJM", "TRIP-260925-01", "Sugpo", "Valenzuela Produce", "INV-260925"].map((s) => (
                    <button key={s} type="button" onClick={() => setQ(s)} className="rounded-full border px-2.5 py-1 text-xs hover:bg-accent cursor-pointer">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <CommandEmpty>No results for “{q}”.</CommandEmpty>
                {results.insight && (
                  <CommandGroup heading="Today">
                    <CommandItem value="insight" onSelect={() => go(results.insight!.href)}>
                      <MapPin />
                      <span className="font-medium">{results.insight.label}</span>
                    </CommandItem>
                  </CommandGroup>
                )}
                {results.cs.length > 0 && (
                  <CommandGroup heading="Customers">
                    {results.cs.map((c) => (
                      <CommandItem key={c.id} value={c.id} onSelect={() => go(`/customers/${c.id}`)}>
                        <Users />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.type} · {areaName(c.areaId)}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.ts.length > 0 && (
                  <CommandGroup heading="Trips">
                    {results.ts.map((t) => (
                      <CommandItem key={t.id} value={t.id} onSelect={() => go(`/trips/${t.id}`)}>
                        <Route />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{t.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {truckById(t.truckId).code} · {routeById(t.routeId).name} · {fmtDateShort(t.date)}
                          </div>
                        </div>
                        <StatusBadge status={t.status} icon={false} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.os.length > 0 && (
                  <CommandGroup heading="Orders">
                    {results.os.map((o) => (
                      <CommandItem key={o.id} value={o.id} onSelect={() => go(`/orders/${o.id}`)}>
                        <ShoppingCart />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{o.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {results.custMap.get(o.customerId)?.name} · {fmtDateShort(o.deliveryDate)} · {peso(orderTotal(o))}
                          </div>
                        </div>
                        <StatusBadge status={o.status} icon={false} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.is.length > 0 && (
                  <CommandGroup heading="Invoices">
                    {results.is.map((i) => (
                      <CommandItem key={i.id} value={i.id} onSelect={() => go(`/accounts-receivable/${i.id}`)}>
                        <FileText />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{i.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {results.custMap.get(i.customerId)?.name} · balance {peso(i.balance)}
                          </div>
                        </div>
                        <StatusBadge status={i.status} icon={false} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.ss.length > 0 && (
                  <CommandGroup heading="Suppliers">
                    {results.ss.map((s) => (
                      <CommandItem key={s.id} value={s.id} onSelect={() => go(`/suppliers/${s.id}`)}>
                        <Store />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{s.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {s.type} · {s.pickupLocation}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.ps.length > 0 && (
                  <CommandGroup heading="Products">
                    {results.ps.map((p) => (
                      <CommandItem key={p.id} value={p.id} onSelect={() => go(`/catalog?q=${encodeURIComponent(p.sku)}`)}>
                        <PackageSearch />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{productLabel(p)}</div>
                          <div className="text-xs text-muted-foreground">{p.sku}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <Truck className="size-3.5" /> Searches orders, customers, suppliers, products, trips and invoices
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
