import type { Customer, Delivery, Expense, InventoryBatch, Invoice, Order, Payment, PurchaseOrder, Trip, TripStop } from "@/types";
import { TODAY } from "@/data/company";
import { PRODUCTS, productById } from "@/data/products";
import { areaById, routeById } from "@/data/areas";
import { supplierById } from "@/data/suppliers";
import { truckById } from "@/data/fleet";
import { LIFETIME_BASELINE } from "@/data/finance";
import {
  agingBucket,
  buildInvoices,
  itemLoadKg,
  itemNetKg,
  orderBilledAmount,
  orderCost,
  orderLoadKg,
  orderNetKg,
  orderTotal,
  poLoadKg,
  poTotal,
  type AgingBucket,
} from "./calc";
import { memoizeLast, sumBy } from "./utils";

export const OPEN_STATUSES = ["Pending Confirmation", "Confirmed", "Preparing", "Ready for Dispatch"] as const;
export const isOpen = (o: Order) => (OPEN_STATUSES as readonly string[]).includes(o.status);
export const isRevenue = (o: Order) => o.status === "Delivered" || o.status === "Partially Delivered";
export const isLive = (o: Order) => o.status !== "Cancelled" && o.status !== "Draft";

export const getInvoices = memoizeLast((orders: Order[], payments: Payment[]) => buildInvoices(orders, payments));
export const getInvoiceMap = memoizeLast((invoices: Invoice[]) => new Map(invoices.map((i) => [i.orderId, i])));

// ─── Customers ──────────────────────────────────────────────────────────────
export interface CustomerStats {
  orders: number;
  windowSales: number;
  lifetimeSales: number;
  avgOrder: number;
  lastOrder?: string;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number;
  ordersPerWeek: number;
  aging: Record<AgingBucket, number>;
}
const emptyAging = (): Record<AgingBucket, number> => ({ current: 0, d1_7: 0, d8_30: 0, d31_60: 0, d60p: 0 });

export const getCustomerStats = memoizeLast((customers: Customer[], orders: Order[], invoices: Invoice[]) => {
  const map = new Map<string, CustomerStats>();
  for (const c of customers)
    map.set(c.id, { orders: 0, windowSales: 0, lifetimeSales: LIFETIME_BASELINE[c.id] ?? 0, avgOrder: 0, outstanding: 0, overdue: 0, oldestOverdueDays: 0, ordersPerWeek: 0, aging: emptyAging() });
  for (const o of orders) {
    const s = map.get(o.customerId);
    if (!s || !isLive(o)) continue;
    s.orders += 1;
    if (!s.lastOrder || o.deliveryDate > s.lastOrder) s.lastOrder = o.deliveryDate;
    if (isRevenue(o) && !o.notes?.startsWith("Opening balance")) {
      const amt = orderBilledAmount(o);
      s.windowSales += amt;
      s.lifetimeSales += amt;
    }
  }
  for (const inv of invoices) {
    const s = map.get(inv.customerId);
    if (!s || inv.balance <= 0) continue;
    s.outstanding += inv.balance;
    s.aging[agingBucket(inv.daysOverdue)] += inv.balance;
    if (inv.daysOverdue > 0) {
      s.overdue += inv.balance;
      s.oldestOverdueDays = Math.max(s.oldestOverdueDays, inv.daysOverdue);
    }
  }
  for (const s of map.values()) {
    const delivered = orders.length ? s.orders : 0;
    s.avgOrder = delivered ? s.windowSales / Math.max(1, delivered) : 0;
    s.ordersPerWeek = s.orders / (30 / 7);
  }
  return map;
});

export function frequencyLabel(perWeek: number) {
  if (perWeek >= 4.5) return "Daily";
  if (perWeek >= 2.5) return `${Math.round(perWeek)}× a week`;
  if (perWeek >= 1.5) return "2× a week";
  if (perWeek >= 0.75) return "Weekly";
  if (perWeek > 0.2) return "Every 2–3 weeks";
  if (perWeek > 0) return "Monthly";
  return "No orders yet";
}

// ─── Trips ──────────────────────────────────────────────────────────────────
export interface CargoLine {
  productId: string;
  quantity: number;
  loadKg: number;
}
export interface TripMetrics {
  orders: Order[];
  pos: PurchaseOrder[];
  deliveries: Delivery[];
  expenses: Expense[];
  outboundLoadKg: number;
  outboundNetKg: number;
  returnLoadKg: number;
  outUtil: number;
  retUtil: number;
  revenue: number;
  cogs: number;
  tripCost: number;
  procurementValue: number;
  contribution: number;
  outboundCargo: CargoLine[];
  returnCargo: CargoLine[];
  delivered: number;
  capacityKg: number;
}

function cargo(lines: { productId: string; quantity: number }[]): CargoLine[] {
  const m = new Map<string, CargoLine>();
  for (const l of lines) {
    const c = m.get(l.productId) ?? { productId: l.productId, quantity: 0, loadKg: 0 };
    c.quantity += l.quantity;
    c.loadKg += itemLoadKg(l);
    m.set(l.productId, c);
  }
  return [...m.values()].sort((a, b) => b.loadKg - a.loadKg);
}

export const getTripMetricsMap = memoizeLast((trips: Trip[], orders: Order[], pos: PurchaseOrder[], deliveries: Delivery[], expenses: Expense[]) => {
  const ordersByTrip = new Map<string, Order[]>();
  for (const o of orders) if (o.tripId && o.status !== "Cancelled") (ordersByTrip.get(o.tripId) ?? ordersByTrip.set(o.tripId, []).get(o.tripId)!).push(o);
  const posByTrip = new Map<string, PurchaseOrder[]>();
  for (const p of pos) if (p.tripId && p.status !== "Cancelled") (posByTrip.get(p.tripId) ?? posByTrip.set(p.tripId, []).get(p.tripId)!).push(p);
  const dlByTrip = new Map<string, Delivery[]>();
  for (const d of deliveries) (dlByTrip.get(d.tripId) ?? dlByTrip.set(d.tripId, []).get(d.tripId)!).push(d);
  const expByTrip = new Map<string, Expense[]>();
  for (const e of expenses) if (e.tripId) (expByTrip.get(e.tripId) ?? expByTrip.set(e.tripId, []).get(e.tripId)!).push(e);

  const out = new Map<string, TripMetrics>();
  for (const t of trips) {
    const cap = truckById(t.truckId).capacityKg;
    const os = ordersByTrip.get(t.id) ?? [];
    const ps = posByTrip.get(t.id) ?? [];
    const ex = expByTrip.get(t.id) ?? [];
    const outboundLoadKg = sumBy(os, orderLoadKg);
    const returnLoadKg = sumBy(ps, poLoadKg);
    const revenue = sumBy(os, (o) => (isRevenue(o) ? orderBilledAmount(o) : orderTotal(o)));
    const cogs = sumBy(os, orderCost);
    const tripCost = sumBy(ex, (e) => e.amount);
    const dls = (dlByTrip.get(t.id) ?? []).sort((a, b) => a.stopSeq - b.stopSeq);
    out.set(t.id, {
      orders: os,
      pos: ps,
      deliveries: dls,
      expenses: ex,
      outboundLoadKg,
      outboundNetKg: sumBy(os, orderNetKg),
      returnLoadKg,
      outUtil: outboundLoadKg / cap,
      retUtil: returnLoadKg / cap,
      revenue,
      cogs,
      tripCost,
      procurementValue: sumBy(ps, poTotal),
      contribution: revenue - cogs - tripCost,
      outboundCargo: cargo(os.flatMap((o) => o.items)),
      returnCargo: cargo(ps.flatMap((p) => p.items)),
      delivered: dls.filter((d) => d.status === "Delivered").length,
      capacityKg: cap,
    });
  }
  return out;
});

/** Ordered stop list for a trip: depart → deliveries → backhaul pickups → arrive Lucena. */
export function buildTripStops(trip: Trip, m: TripMetrics, customers: Customer[]): TripStop[] {
  const route = routeById(trip.routeId);
  const stops: TripStop[] = [];
  const departed = !!trip.actualDeparture;
  stops.push({ seq: 0, type: "depart", areaId: "lucena", label: "Lucena Main Warehouse", eta: trip.departure, actual: trip.actualDeparture, status: departed ? "done" : trip.status === "Loading" ? "current" : "pending" });
  const orderMap = new Map(m.orders.map((o) => [o.id, o]));
  let currentAssigned = trip.status === "Loading" || !departed;
  for (const d of m.deliveries) {
    const o = orderMap.get(d.orderId);
    if (!o) continue;
    const c = customers.find((x) => x.id === o.customerId)!;
    const done = d.status === "Delivered" || d.status === "Returned" || d.status === "Failed";
    let status: TripStop["status"] = done ? "done" : "pending";
    if (!done && !currentAssigned && departed) {
      status = "current";
      currentAssigned = true;
    }
    stops.push({ seq: stops.length, type: "delivery", areaId: c.areaId, label: c.name, orderId: o.id, eta: d.eta, actual: d.completedAt ?? d.arrivedAt, status });
  }
  for (const p of [...m.pos].sort((a, b) => (a.pickupEta ?? "").localeCompare(b.pickupEta ?? ""))) {
    const done = !!p.pickedUpAt || p.status === "Received" || p.status === "Picked Up" || p.status === "Partially Received";
    let status: TripStop["status"] = done ? "done" : "pending";
    if (!done && !currentAssigned && departed) {
      status = "current";
      currentAssigned = true;
    }
    stops.push({ seq: stops.length, type: "pickup", areaId: p.pickupAreaId, label: supplierById(p.supplierId).name, poId: p.id, eta: p.pickupEta ?? trip.expectedReturn, actual: p.pickedUpAt, status });
  }
  stops.push({ seq: stops.length, type: "arrive", areaId: "lucena", label: "Lucena Main Warehouse", eta: trip.expectedReturn, actual: trip.actualReturn, status: trip.actualReturn ? "done" : "pending" });
  void route;
  return stops;
}

// ─── Inventory ──────────────────────────────────────────────────────────────
export interface ProductStock {
  productId: string;
  onHand: number;
  damaged: number;
  reserved: number;
  demand: number;
  available: number;
  incoming: number;
  inTransit: number;
  value: number;
  shortage: number;
}

export const getStockMap = memoizeLast((inventory: InventoryBatch[], orders: Order[], pos: PurchaseOrder[], trips: Trip[]) => {
  const tripStatus = new Map(trips.map((t) => [t.id, t.status]));
  const m = new Map<string, ProductStock>();
  for (const p of PRODUCTS) m.set(p.id, { productId: p.id, onHand: 0, damaged: 0, reserved: 0, demand: 0, available: 0, incoming: 0, inTransit: 0, value: 0, shortage: 0 });
  for (const b of inventory) {
    if (b.location !== "Lucena Main Warehouse") continue;
    const s = m.get(b.productId)!;
    s.onHand += b.onHand;
    s.damaged += b.damaged;
    s.value += (b.onHand - b.damaged) * b.unitCost;
  }
  for (const o of orders) {
    if (!(o.status === "Confirmed" || o.status === "Preparing" || o.status === "Ready for Dispatch" || o.status === "Pending Confirmation")) continue;
    if (o.deliveryDate < TODAY) continue;
    const ts = o.tripId ? tripStatus.get(o.tripId) : undefined;
    if (ts === "In Transit" || ts === "Returning") continue;
    for (const i of o.items) m.get(i.productId)!.demand += i.quantity;
  }
  for (const o of orders) {
    if (o.status !== "Out for Delivery" || !o.tripId) continue;
    for (const i of o.items) m.get(i.productId)!.inTransit += i.quantity;
  }
  for (const p of pos) {
    if (!["Sent", "Confirmed", "Ready for Pickup", "Picked Up"].includes(p.status)) continue;
    for (const i of p.items) m.get(i.productId)!.incoming += i.quantity;
  }
  for (const s of m.values()) {
    const usable = s.onHand - s.damaged;
    s.reserved = Math.min(usable, s.demand);
    s.available = usable - s.reserved;
    s.shortage = Math.max(0, s.demand - usable - s.incoming);
  }
  return m;
});

// ─── Dispatch ───────────────────────────────────────────────────────────────
export function unassignedTruckOrders(orders: Order[], date: string) {
  return orders.filter((o) => o.fulfillment === "truck" && !o.tripId && o.deliveryDate === date && (isOpen(o) || o.status === "Draft"));
}

// ─── Aggregates ─────────────────────────────────────────────────────────────
export const getDailyRevenue = memoizeLast((orders: Order[]) => {
  const m = new Map<string, { date: string; revenue: number; cost: number; orders: number }>();
  for (const o of orders) {
    if (!isRevenue(o) || o.notes?.startsWith("Opening balance")) continue;
    const d = o.deliveryDate;
    const row = m.get(d) ?? { date: d, revenue: 0, cost: 0, orders: 0 };
    row.revenue += orderBilledAmount(o);
    row.cost += orderCost(o);
    row.orders += 1;
    m.set(d, row);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
});

export const getProductSales = memoizeLast((orders: Order[]) => {
  const m = new Map<string, { productId: string; revenue: number; quantity: number; kg: number }>();
  for (const o of orders) {
    if (!isRevenue(o)) continue;
    for (const i of o.items) {
      const q = i.deliveredQty ?? i.quantity;
      const row = m.get(i.productId) ?? { productId: i.productId, revenue: 0, quantity: 0, kg: 0 };
      row.revenue += q * i.unitPrice;
      row.quantity += q;
      row.kg += itemNetKg({ productId: i.productId, quantity: q });
      m.set(i.productId, row);
    }
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
});

/** Product families used on dashboards ("Sugpo" rolls up all sizes). */
export function productFamily(productId: string) {
  const p = productById(productId);
  return p.localName === "Hipon" ? "Hipon" : p.localName === "Bawang" || p.localName === "Bawang Tagalog" ? "Garlic" : p.localName === "Sibuyas Pula" ? "Red Onion" : p.localName === "Sibuyas Puti" ? "White Onion" : p.localName === "Luya" ? "Ginger" : (p.localName ?? p.name);
}

export interface RoutePerf {
  key: string;
  label: string;
  direction: "outbound" | "return";
  trips: number;
  revenue: number;
  cost: number;
  utilization: number;
  margin: number;
}

export const getRoutePerformance = memoizeLast((trips: Trip[], metrics: Map<string, TripMetrics>) => {
  const out = new Map<string, RoutePerf>();
  const ret = new Map<string, RoutePerf>();
  for (const t of trips) {
    const m = metrics.get(t.id);
    if (!m || t.status === "Planned" || t.status === "Cancelled") continue;
    const route = routeById(t.routeId);
    const oKey = route.id;
    const o = out.get(oKey) ?? { key: oKey, label: route.name, direction: "outbound", trips: 0, revenue: 0, cost: 0, utilization: 0, margin: 0 };
    o.trips += 1;
    o.revenue += m.revenue;
    o.cost += m.cogs + m.tripCost;
    o.utilization += m.outUtil;
    out.set(oKey, o);
    const rKey = route.returnAreas.join("+");
    const label = [...route.returnAreas.map((a) => areaById(a).name.replace(" City", "")), "Lucena"].join(" → ");
    const r = ret.get(rKey) ?? { key: rKey, label, direction: "return", trips: 0, revenue: 0, cost: 0, utilization: 0, margin: 0 };
    r.trips += 1;
    // Return value = expected resale value of the backhaul goods at wholesale prices.
    r.revenue += sumBy(m.pos, (p) => sumBy(p.items, (i) => i.quantity * productById(i.productId).wholesalePrice));
    r.cost += m.procurementValue;
    r.utilization += m.retUtil;
    ret.set(rKey, r);
  }
  const finish = (r: RoutePerf) => ({ ...r, utilization: r.utilization / Math.max(1, r.trips), margin: r.revenue ? (r.revenue - r.cost) / r.revenue : 0 });
  return { outbound: [...out.values()].map(finish).sort((a, b) => b.revenue - a.revenue), inbound: [...ret.values()].map(finish).sort((a, b) => b.revenue - a.revenue) };
});
