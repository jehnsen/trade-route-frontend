import { SEED } from "../data/seed";
import { buildInvoices, orderBilledAmount, orderLoadKg, poLoadKg, agingBucket, orderTotal } from "../lib/calc";
const { orders, trips, deliveries, purchaseOrders, payments, expenses, inventory } = SEED;
console.log({ orders: orders.length, trips: trips.length, deliveries: deliveries.length, pos: purchaseOrders.length, payments: payments.length, expenses: expenses.length, inventory: inventory.length });
const inv = buildInvoices(orders, payments);
const buckets: Record<string, number> = {};
for (const i of inv) if (i.balance > 0) { const b = agingBucket(i.daysOverdue); buckets[b] = (buckets[b] ?? 0) + i.balance; }
console.log("AR", inv.reduce((s, i) => s + i.balance, 0), buckets);
const byCust = new Map<string, number>();
for (const i of inv) if (i.daysOverdue > 0) byCust.set(i.customerId, (byCust.get(i.customerId) ?? 0) + i.balance);
console.log("overdue by customer", [...byCust].sort((a, b) => b[1] - a[1]).slice(0, 8));
const utils = trips.map((t) => {
  const o = orders.filter((x) => x.tripId === t.id && x.status !== "Cancelled");
  const load = o.reduce((s, x) => s + orderLoadKg(x), 0);
  const ret = purchaseOrders.filter((p) => p.tripId === t.id && p.status !== "Cancelled").reduce((s, p) => s + poLoadKg(p), 0);
  const rev = o.reduce((s, x) => s + orderTotal(x), 0);
  return { id: t.id, route: t.routeId, n: o.length, out: Math.round(load / 85) , ret: Math.round(ret / 85), rev };
});
console.table(utils.slice(-12));
const avgOut = utils.reduce((s, u) => s + u.out, 0) / utils.length, avgRet = utils.reduce((s, u) => s + u.ret, 0) / utils.length;
console.log("avg out util", avgOut.toFixed(1), "avg ret", avgRet.toFixed(1));
const days = new Map<string, number>();
for (const o of orders) if (o.status === "Delivered" || o.status === "Partially Delivered") days.set(o.deliveryDate, (days.get(o.deliveryDate) ?? 0) + orderBilledAmount(o));
console.log("daily revenue sample", [...days].sort().slice(-6));
console.log("today POs", purchaseOrders.filter((p) => p.id.startsWith("PO-260925")).map((p) => p.id + " " + p.supplierId + " " + p.status));
console.log(SEED.notifications.map((n) => n.body).slice(2, 5));
console.log("statuses", orders.reduce((m: any, o) => (m[o.status] = (m[o.status] ?? 0) + 1, m), {}));
console.log("sources", orders.reduce((m: any, o) => (m[o.source] = (m[o.source] ?? 0) + 1, m), {}));
