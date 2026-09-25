import type { AreaId, Product } from "@/types";
import { areaById } from "@/data/areas";
import type { ProductStock } from "./selectors";

/** Quantity we can promise to new portal orders: bodega stock + incoming − already committed. */
export function portalAvailability(p: Product, s: ProductStock | undefined) {
  if (!s) return 0;
  const raw = Math.max(0, s.onHand - s.damaged - s.demand + s.incoming);
  const step = p.unit === "pc" ? 50 : 10;
  return Math.floor(raw / step) * step;
}

/** Human "next dispatch" line for the catalog. */
export function nextDispatch(p: Product) {
  if (p.flow === "outbound") return p.category === "seafood" ? "Tomorrow, 3:30 AM from Lucena" : "Tomorrow's Metro Manila run";
  return "Bodega pickup daily · delivered on outbound runs";
}

export interface FeeEstimate {
  fee: number;
  label: string;
  note?: string;
}

/** Indicative delivery charge by destination (demo policy). */
export function estimateDeliveryFee(areaId: AreaId | undefined, subtotal: number): FeeEstimate {
  if (!areaId) return { fee: 0, label: "Choose a delivery city" };
  const a = areaById(areaId);
  if (a.interIsland) return { fee: 0, label: "Freight quoted separately", note: "Shipped via our sea-freight partner from Batangas Port." };
  if (a.region === "Quezon Province") return { fee: 0, label: "Free — bodega pickup or local drop" };
  const threshold = a.region === "Metro Manila" ? 50000 : 60000;
  if (subtotal >= threshold) return { fee: 0, label: `Free (orders ₱${threshold.toLocaleString("en-PH")}+ on regular routes)` };
  return { fee: a.region === "Metro Manila" ? 1500 : 2000, label: a.region === "Metro Manila" ? "₱1,500 route delivery" : "₱2,000 provincial route delivery" };
}

export const DELIVERY_SCHEDULE: { day: string; routes: string[] }[] = [
  { day: "Monday", routes: ["Navotas · Valenzuela", "Bacoor · Imus"] },
  { day: "Tuesday", routes: ["Pasay · Manila · Caloocan", "Calamba · Santa Rosa · Dasmariñas · Gen. Trias"] },
  { day: "Wednesday", routes: ["Navotas · Valenzuela", "Batangas City · Santa Rosa · Calamba"] },
  { day: "Thursday", routes: ["Navotas · Caloocan · Quezon City", "Parañaque · Las Piñas · Bacoor"] },
  { day: "Friday", routes: ["Navotas · Valenzuela", "Bacoor · Imus"] },
  { day: "Saturday", routes: ["Navotas · Valenzuela", "Parañaque · Las Piñas · Bacoor"] },
];
