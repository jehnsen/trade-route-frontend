import type { Area, AreaId, RouteTemplate } from "@/types";

export const AREAS: Area[] = [
  { id: "lucena", name: "Lucena City", province: "Quezon", region: "Quezon Province", distanceKm: 0, driveMinutes: 0 },
  { id: "sariaya", name: "Sariaya", province: "Quezon", region: "Quezon Province", distanceKm: 18, driveMinutes: 30 },
  { id: "tayabas", name: "Tayabas City", province: "Quezon", region: "Quezon Province", distanceKm: 12, driveMinutes: 25 },
  { id: "pagbilao", name: "Pagbilao", province: "Quezon", region: "Quezon Province", distanceKm: 14, driveMinutes: 25 },
  { id: "candelaria", name: "Candelaria", province: "Quezon", region: "Quezon Province", distanceKm: 32, driveMinutes: 45 },
  { id: "navotas", name: "Navotas City", province: "Metro Manila", region: "Metro Manila", distanceKm: 162, driveMinutes: 215 },
  { id: "valenzuela", name: "Valenzuela City", province: "Metro Manila", region: "Metro Manila", distanceKm: 168, driveMinutes: 225 },
  { id: "caloocan", name: "Caloocan City", province: "Metro Manila", region: "Metro Manila", distanceKm: 164, driveMinutes: 220 },
  { id: "quezon-city", name: "Quezon City", province: "Metro Manila", region: "Metro Manila", distanceKm: 158, driveMinutes: 210 },
  { id: "manila", name: "Manila", province: "Metro Manila", region: "Metro Manila", distanceKm: 150, driveMinutes: 200 },
  { id: "pasay", name: "Pasay City", province: "Metro Manila", region: "Metro Manila", distanceKm: 140, driveMinutes: 185 },
  { id: "paranaque", name: "Parañaque City", province: "Metro Manila", region: "Metro Manila", distanceKm: 134, driveMinutes: 175 },
  { id: "las-pinas", name: "Las Piñas City", province: "Metro Manila", region: "Metro Manila", distanceKm: 132, driveMinutes: 175 },
  { id: "bacoor", name: "Bacoor", province: "Cavite", region: "Cavite", distanceKm: 136, driveMinutes: 180 },
  { id: "imus", name: "Imus", province: "Cavite", region: "Cavite", distanceKm: 130, driveMinutes: 170 },
  { id: "dasmarinas", name: "Dasmariñas", province: "Cavite", region: "Cavite", distanceKm: 118, driveMinutes: 160 },
  { id: "general-trias", name: "General Trias", province: "Cavite", region: "Cavite", distanceKm: 126, driveMinutes: 170 },
  { id: "calamba", name: "Calamba", province: "Laguna", region: "Laguna", distanceKm: 88, driveMinutes: 110 },
  { id: "santa-rosa", name: "Santa Rosa", province: "Laguna", region: "Laguna", distanceKm: 104, driveMinutes: 130 },
  { id: "batangas-city", name: "Batangas City", province: "Batangas", region: "Batangas", distanceKm: 118, driveMinutes: 150 },
  { id: "cebu", name: "Cebu City", province: "Cebu", region: "Visayas", distanceKm: 0, driveMinutes: 0, interIsland: true },
  { id: "iloilo", name: "Iloilo City", province: "Iloilo", region: "Visayas", distanceKm: 0, driveMinutes: 0, interIsland: true },
  { id: "bacolod", name: "Bacolod City", province: "Negros Occidental", region: "Visayas", distanceKm: 0, driveMinutes: 0, interIsland: true },
  { id: "davao", name: "Davao City", province: "Davao del Sur", region: "Mindanao", distanceKm: 0, driveMinutes: 0, interIsland: true },
  { id: "cagayan-de-oro", name: "Cagayan de Oro", province: "Misamis Oriental", region: "Mindanao", distanceKm: 0, driveMinutes: 0, interIsland: true },
  { id: "general-santos", name: "General Santos", province: "South Cotabato", region: "Mindanao", distanceKm: 0, driveMinutes: 0, interIsland: true },
];

const areaMap = new Map(AREAS.map((a) => [a.id, a]));
export const areaById = (id: AreaId) => areaMap.get(id)!;
export const areaName = (id: AreaId) => areaMap.get(id)?.name ?? id;

/** Inter-island orders do not travel by our trucks — they are handed to a sea-freight partner at Batangas Port. */
export const INTER_ISLAND_PARTNER = {
  name: "Isla Reefer Cargo Forwarders",
  handover: "Batangas International Port",
  note: "Lucena → Batangas Port (partner reefer van) → Regional distributor",
};

export const ROUTES: RouteTemplate[] = [
  {
    id: "RT-NV",
    name: "Lucena → Navotas → Valenzuela",
    outboundAreas: ["navotas", "valenzuela"],
    returnAreas: ["valenzuela", "caloocan"],
    roundTripKm: 348,
    tollFee: 3860,
    departure: "03:30",
    expectedReturn: "20:30",
  },
  {
    id: "RT-NCQ",
    name: "Lucena → Navotas → Caloocan → Quezon City",
    outboundAreas: ["navotas", "caloocan", "quezon-city"],
    returnAreas: ["quezon-city"],
    roundTripKm: 356,
    tollFee: 3980,
    departure: "03:00",
    expectedReturn: "20:00",
  },
  {
    id: "RT-MNL",
    name: "Lucena → Pasay → Manila → Caloocan → Navotas",
    outboundAreas: ["pasay", "manila", "caloocan", "navotas"],
    returnAreas: ["manila"],
    roundTripKm: 338,
    tollFee: 3720,
    departure: "03:00",
    expectedReturn: "19:30",
  },
  {
    id: "RT-CAV",
    name: "Lucena → Bacoor → Imus",
    outboundAreas: ["bacoor", "imus"],
    returnAreas: ["santa-rosa", "calamba"],
    roundTripKm: 296,
    tollFee: 2640,
    departure: "09:00",
    expectedReturn: "20:00",
  },
  {
    id: "RT-SOU",
    name: "Lucena → Parañaque → Las Piñas → Bacoor",
    outboundAreas: ["pasay", "paranaque", "las-pinas", "bacoor"],
    returnAreas: ["dasmarinas"],
    roundTripKm: 312,
    tollFee: 3180,
    departure: "04:00",
    expectedReturn: "19:00",
  },
  {
    id: "RT-LAG",
    name: "Lucena → Calamba → Santa Rosa → Dasmariñas → General Trias",
    outboundAreas: ["calamba", "santa-rosa", "dasmarinas", "general-trias"],
    returnAreas: ["calamba"],
    roundTripKm: 268,
    tollFee: 1940,
    departure: "05:00",
    expectedReturn: "18:00",
  },
  {
    id: "RT-BAT",
    name: "Lucena → Batangas City → Santa Rosa → Calamba",
    outboundAreas: ["batangas-city", "santa-rosa", "calamba"],
    returnAreas: ["calamba"],
    roundTripKm: 286,
    tollFee: 2210,
    departure: "05:00",
    expectedReturn: "16:30",
  },
];

const routeMap = new Map(ROUTES.map((r) => [r.id, r]));
export const routeById = (id: string) => routeMap.get(id)!;

/** Short return-leg label, e.g. "Valenzuela → Lucena". */
export function returnLegName(route: RouteTemplate) {
  return [...route.returnAreas.map(areaName), "Lucena City"].map((n) => n.replace(" City", "")).join(" → ");
}
