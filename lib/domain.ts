import type { AreaId, Load, LogisticsJob, Order, PurchaseOrder, Trip } from "@/types";
import { productById } from "@/data/products";
import { areaName, routeById } from "@/data/areas";
import { kg, qty } from "./format";

// ─── Logistics ──────────────────────────────────────────────────────────────
const shortArea = (id: AreaId) => (id === "quezon-city" ? "QC" : areaName(id).replace(" City", ""));

/** Route line from the trip's stops, e.g. "Lucena → Navotas → Valenzuela → Lucena". */
export function tripRouteLine(t: Trip) {
  if (!t.stops.length) return routeById(t.routeId).name + " → Lucena";
  const out: string[] = [];
  for (const s of t.stops) {
    const n = shortArea(s.location.areaId);
    if (out[out.length - 1] !== n) out.push(n);
  }
  return out.join(" → ");
}

/** "Sugpo 2,500 kg + Tahong 450 kg" or "… +2 more". */
export function loadsSummary(loads: Pick<Load, "cargoDescription" | "weightKg">[], max = 2) {
  const parts = loads.slice(0, max).map((l) => `${l.cargoDescription.split(/[,(]/)[0].trim()} ${kg(l.weightKg)}`);
  const extra = loads.length - max;
  return parts.join(" + ") + (extra > 0 ? ` +${extra} more` : "");
}

export const jobLane = (j: Pick<LogisticsJob, "pickup" | "dropoff">) => `${shortArea(j.pickup.areaId)} → ${shortArea(j.dropoff.areaId)}`;

// ─── Trading ────────────────────────────────────────────────────────────────
/** "Sugpo 180 kg" or "Sugpo 120 kg + Talaba 80 kg" or "Tahong 700 kg +2 more" */
export function itemsSummary(items: { productId: string; quantity: number }[], max = 2) {
  const names = items.map((i) => productById(i.productId).localName);
  const parts = items.slice(0, max).map((i) => {
    const p = productById(i.productId);
    const dupe = names.filter((n) => n === p.localName).length > 1;
    const size = dupe && p.variant ? ` ${p.variant.split(/[ ,(]/)[0]}` : "";
    return `${p.localName ?? p.name}${size} ${qty(i.quantity, p.unit)}`;
  });
  const extra = items.length - max;
  return parts.join(" + ") + (extra > 0 ? ` +${extra} more` : "");
}

export const orderSummary = (o: Order, max = 2) => itemsSummary(o.items, max);
export const poSummary = (p: PurchaseOrder, max = 2) => itemsSummary(p.items, max);

export function initials(name: string) {
  return name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
