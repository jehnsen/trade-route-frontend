// Exercises store mutations and verifies that related records stay consistent.
import { useAppStore } from "../lib/store";
import { getInvoices, getTripMetricsMap, getCustomerStats, unassignedTruckOrders } from "../lib/selectors";
import { invoiceIdForOrder } from "../lib/calc";

const s = () => useAppStore.getState();
const assert = (cond: unknown, msg: string) => { if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok:", msg); };

// 1. Create an order and put it on tomorrow's Truck 02 trip
const id = s().createOrder({ customerId: "CUS-022", source: "Facebook Messenger", items: [{ productId: "P-SUG-L", quantity: 150, unitPrice: 460 }, { productId: "P-TAH", quantity: 250, unitPrice: 115 }], discount: 0, deliveryFee: 2000, deliveryDate: "2026-09-26", paymentTerms: "COD", addressId: "CUS-022-A1", status: "Confirmed", createdBy: "test" });
assert(id === "FR-260926-023", `new order numbered in tomorrow's series (${id})`);
assert(unassignedTruckOrders(s().orders, "2026-09-26").some((o) => o.id === id), "new order appears as unassigned on the dispatch board");
const before = getTripMetricsMap(s().trips, s().orders, s().purchaseOrders, s().deliveries, s().expenses).get("TRIP-260926-02")!.outboundLoadKg;
s().assignOrderToTrip(id, "TRIP-260926-02");
const m = getTripMetricsMap(s().trips, s().orders, s().purchaseOrders, s().deliveries, s().expenses).get("TRIP-260926-02")!;
assert(m.orders.some((o) => o.id === id) && m.outboundLoadKg > before, "trip shows the order and its load increased");
assert(s().deliveries.some((d) => d.orderId === id && d.tripId === "TRIP-260926-02"), "delivery record created on the trip");

// 2. Deliver a live Truck 01 COD drop with cash collection -> invoice + payment
const dl = s().deliveries.find((d) => d.orderId === "FR-260925-002")!;
s().markDelivered(dl.id, { receivedBy: "Maribel Santiago", photoCount: 2 }, 49500);
const inv = getInvoices(s().orders, s().payments).find((i) => i.id === invoiceIdForOrder("FR-260925-002"))!;
assert(inv && inv.balance === 0 && inv.paid === 49500, "COD delivery creates invoice INV-260925-002 fully paid");
assert(s().deliveries.find((d) => d.orderId === "FR-260925-019")!.status !== "Delivered", "later stops remain pending");

// 3. Partial payment reduces customer outstanding
const statsBefore = getCustomerStats(s().customers, s().orders, getInvoices(s().orders, s().payments)).get("CUS-002")!.outstanding;
const rjmInv = getInvoices(s().orders, s().payments).find((i) => i.customerId === "CUS-002" && i.balance > 0)!;
s().recordPayment({ invoiceId: rjmInv.id, orderId: rjmInv.orderId, customerId: "CUS-002", amount: 20000, method: "GCash", reference: "GCash Ref •••• 1234" });
const statsAfter = getCustomerStats(s().customers, s().orders, getInvoices(s().orders, s().payments)).get("CUS-002")!.outstanding;
assert(statsBefore - statsAfter === 20000, `RJM outstanding reduced by ₱20,000 (${statsBefore} → ${statsAfter})`);
assert(/^PAY-\d{6}-\d{3}$/.test(s().payments[s().payments.length - 1].id), "payment id follows PAY-YYMMDD-NNN");

// 4. Convert a lead
const cid = s().convertLead("LD-001");
assert(s().customers.some((c) => c.id === cid) && s().leads.find((l) => l.id === "LD-001")!.stage === "Won", `lead converted to ${cid} and marked Won`);

// 5. Assign the unassigned backhaul PO to Truck 01
s().assignPOToTrip("PO-260925-016", "TRIP-260925-01");
const t1 = getTripMetricsMap(s().trips, s().orders, s().purchaseOrders, s().deliveries, s().expenses).get("TRIP-260925-01")!;
assert(t1.returnLoadKg === 4200 && t1.returnLoadKg <= t1.capacityKg, `Truck 01 return load now ${t1.returnLoadKg} kg`);
