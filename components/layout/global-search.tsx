"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, FileText, MapPin, PackageCheck, Route, ShoppingCart, Truck, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/form-controls";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/overlays";
import { useAppStore } from "@/lib/store";
import { useInvoices } from "@/hooks/use-data";
import { areaName, AREAS } from "@/data/areas";
import { truckById } from "@/data/fleet";
import { TODAY } from "@/data/company";
import { jobTotal } from "@/lib/logistics";
import { jobLane, tripRouteLine } from "@/lib/domain";
import { orderTotal } from "@/lib/calc";
import { peso, fmtDateShort, kg } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const jobs = useAppStore((s) => s.jobs);
  const orders = useAppStore((s) => s.orders);
  const customers = useAppStore((s) => s.customers);
  const trips = useAppStore((s) => s.trips);
  const deliveries = useAppStore((s) => s.deliveries);
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
    const cs = customers.filter((c) => match(`${c.name} ${c.type} ${areaName(c.areaId)} ${c.contacts.map((x) => x.name).join(" ")} ${c.id}`)).slice(0, 5);
    const js = jobs
      .filter((j) => match(`${j.id} ${custMap.get(j.customerId)?.name ?? ""} ${j.cargoDescription} ${j.pickup.name} ${j.dropoff.name} ${areaName(j.dropoff.areaId)} ${j.tripId ?? ""} ${j.status}`))
      .sort((a, b) => b.pickupAt.localeCompare(a.pickupAt))
      .slice(0, 6);
    const ts = trips
      .filter((t) => match(`${t.id} ${tripRouteLine(t)} ${truckById(t.truckId).code} ${t.status}`))
      .sort((a, b) => Math.abs(new Date(a.date).getTime() - new Date(TODAY).getTime()) - Math.abs(new Date(b.date).getTime() - new Date(TODAY).getTime()))
      .slice(0, 4);
    const ds = deliveries.filter((d) => match(`${d.id} ${d.jobId} ${custMap.get(d.customerId)?.name ?? ""} ${d.pod?.receiptNo ?? ""}`)).slice(0, 4);
    const is = invoices.filter((i) => match(`${i.id} ${i.jobId} ${custMap.get(i.customerId)?.name ?? ""}`)).slice(0, 4);
    const os = orders.filter((o) => match(`${o.id} ${custMap.get(o.customerId)?.name ?? ""}`)).slice(0, 3);
    let insight: { label: string; href: string } | null = null;
    if (area) {
      const todays = deliveries.filter((d) => trips.some((t) => t.id === d.tripId && t.date === TODAY) && jobs.find((j) => j.id === d.jobId)?.dropoff.areaId === area.id);
      if (todays.length) insight = { label: `${todays.length} ${area.name.replace(" City", "")} deliveries today`, href: `/deliveries?area=${area.id}` };
    }
    return { cs, js, ts, ds, is, os, insight, custMap };
  }, [q, jobs, orders, customers, trips, deliveries, invoices]);

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
          <CommandInput value={q} onValueChange={setQ} placeholder='Try "Navotas", "JOB-260925-001", "sugpo" or "TRIP-260925-01"' autoFocus />
          <CommandList>
            {!results ? (
              <div className="p-4 text-sm text-muted-foreground">
                <div className="mb-2 text-xs font-medium tracking-wide uppercase">Quick searches</div>
                <div className="flex flex-wrap gap-2">
                  {["Navotas", "RJM", "TRIP-260925-01", "JOB-260925-001", "Sugpo", "INV-2609"].map((s) => (
                    <button key={s} type="button" onClick={() => setQ(s)} className="cursor-pointer rounded-full border px-2.5 py-1 text-xs hover:bg-accent">
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
                {results.js.length > 0 && (
                  <CommandGroup heading="Logistics jobs">
                    {results.js.map((j) => (
                      <CommandItem key={j.id} value={j.id} onSelect={() => go(`/jobs/${j.id}`)}>
                        <ClipboardList />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{j.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {results.custMap.get(j.customerId)?.name} · {jobLane(j)} · {kg(j.weightKg)} · {peso(jobTotal(j))}
                          </div>
                        </div>
                        <StatusBadge status={j.status} icon={false} />
                      </CommandItem>
                    ))}
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
                            {truckById(t.truckId).code} · {tripRouteLine(t)} · {fmtDateShort(t.date)}
                          </div>
                        </div>
                        <StatusBadge status={t.status} icon={false} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.ds.length > 0 && (
                  <CommandGroup heading="Deliveries">
                    {results.ds.map((d) => (
                      <CommandItem key={d.id} value={d.id} onSelect={() => go(`/deliveries/${d.id}`)}>
                        <PackageCheck />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{d.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {results.custMap.get(d.customerId)?.name} · {d.tripId}
                          </div>
                        </div>
                        <StatusBadge status={d.status} icon={false} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.is.length > 0 && (
                  <CommandGroup heading="Freight invoices">
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
                {results.os.length > 0 && (
                  <CommandGroup heading="Trading — sales orders">
                    {results.os.map((o) => (
                      <CommandItem key={o.id} value={o.id} onSelect={() => go(`/orders/${o.id}`)}>
                        <ShoppingCart />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{o.id}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {results.custMap.get(o.customerId)?.name} · {peso(orderTotal(o))}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <Truck className="size-3.5" /> Searches jobs, customers, trips, deliveries and invoices
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
