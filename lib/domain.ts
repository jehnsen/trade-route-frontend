import type { Order, PurchaseOrder, Trip } from "@/types";
import { productById } from "@/data/products";
import { routeById, returnLegName } from "@/data/areas";
import { truckById, driverById } from "@/data/fleet";
import { qty } from "./format";

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

export function tripLabel(t: Trip) {
  const truck = truckById(t.truckId);
  return `${truck.code} · ${routeById(t.routeId).name}`;
}
export const tripRoute = (t: Trip) => routeById(t.routeId);
export const tripReturnLeg = (t: Trip) => returnLegName(routeById(t.routeId));
export const tripDriver = (t: Trip) => driverById(t.driverId);
export const tripTruck = (t: Trip) => truckById(t.truckId);

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
