"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addMinutes, format, parseISO } from "date-fns";
import type {
  AppNotification,
  CartLine,
  Customer,
  Delivery,
  Fulfillment,
  InventoryBatch,
  Lead,
  LeadStage,
  Order,
  OrderItem,
  OrderSource,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentTerms,
  POItem,
  POStatus,
  PurchaseOrder,
  QuoteRequest,
  Role,
  StandingOrder,
  Trip,
  TripStatus,
  Expense,
} from "@/types";
import { NOW, TODAY, staffById } from "@/data/company";
import { ORDERS, QUOTE_REQUESTS } from "@/data/orders";
import { DELIVERIES, TRIPS } from "@/data/trips";
import { INVENTORY_BATCHES, PURCHASE_ORDERS } from "@/data/procurement";
import { EXPENSES, PAYMENTS } from "@/data/finance";
import { NOTIFICATIONS } from "@/data/notifications";
import { CUSTOMERS, STANDING_ORDERS } from "@/data/customers";
import { LEADS } from "@/data/leads";
import { areaById, routeById } from "@/data/areas";
import { supplierById } from "@/data/suppliers";
import { driverById } from "@/data/fleet";
import { invoiceIdForOrder, orderBilledAmount } from "@/lib/calc";

export const PORTAL_CUSTOMER_ID = "CUS-022";

const yymmdd = (iso: string) => iso.slice(2, 10).replace(/-/g, "");

export interface NewOrderInput {
  customerId: string;
  source: OrderSource;
  items: OrderItem[];
  discount: number;
  deliveryFee: number;
  deliveryDate: string;
  paymentTerms: PaymentTerms;
  addressId: string;
  notes?: string;
  status: "Draft" | "Pending Confirmation" | "Confirmed";
  fulfillment?: Fulfillment;
  createdBy: string;
  deliveryWindow?: string;
}

export interface NewPaymentInput {
  invoiceId: string;
  orderId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes?: string;
}

export interface NewPOInput {
  supplierId: string;
  items: POItem[];
  pickupDate: string;
  tripId?: string;
  status: "Draft" | "Sent";
  notes?: string;
}

interface DataState {
  role: Role;
  tick: number;
  orders: Order[];
  trips: Trip[];
  deliveries: Delivery[];
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  expenses: Expense[];
  inventory: InventoryBatch[];
  customers: Customer[];
  leads: Lead[];
  standingOrders: StandingOrder[];
  quoteRequests: QuoteRequest[];
  notifications: AppNotification[];
  cart: CartLine[];
}

interface Actions {
  setRole: (role: Role) => void;
  now: () => string;
  createOrder: (input: NewOrderInput) => string;
  updateOrder: (id: string, patch: Partial<Order>, event?: { label: string; note?: string }) => void;
  setOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  cancelOrder: (id: string, reason: string) => void;
  assignOrderToTrip: (orderId: string, tripId: string | null) => void;
  setTripStatus: (tripId: string, status: TripStatus) => void;
  markArrived: (deliveryId: string) => void;
  markDelivered: (deliveryId: string, pod: { receivedBy: string; photoCount: number; remarks?: string }, cashCollected?: number) => void;
  recordPayment: (input: NewPaymentInput) => string;
  createPO: (input: NewPOInput) => string;
  setPOStatus: (id: string, status: POStatus) => void;
  assignPOToTrip: (poId: string, tripId: string | null) => void;
  moveLead: (id: string, stage: LeadStage, note?: string) => void;
  addLead: (lead: Omit<Lead, "id" | "activities" | "createdAt" | "lastContactAt">) => string;
  convertLead: (id: string) => string;
  addCustomer: (c: Omit<Customer, "id" | "customerSince" | "status" | "paymentBehavior" | "frequency">) => string;
  addExpense: (e: Omit<Expense, "id" | "recordedBy">) => void;
  setStandingOrderStatus: (id: string, status: StandingOrder["status"]) => void;
  saveStandingOrder: (so: Omit<StandingOrder, "id"> & { id?: string }) => void;
  addQuoteRequest: (q: Omit<QuoteRequest, "id" | "status" | "createdAt">) => string;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addToCart: (productId: string, quantity: number) => void;
  setCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  resetDemo: () => void;
}

const initialData = (): DataState => ({
  role: "owner",
  tick: 0,
  orders: ORDERS,
  trips: TRIPS,
  deliveries: DELIVERIES,
  purchaseOrders: PURCHASE_ORDERS,
  payments: PAYMENTS,
  expenses: EXPENSES,
  inventory: INVENTORY_BATCHES,
  customers: CUSTOMERS,
  leads: LEADS,
  standingOrders: STANDING_ORDERS,
  quoteRequests: QUOTE_REQUESTS,
  notifications: NOTIFICATIONS,
  cart: [
    { productId: "P-SUG-L", quantity: 100 },
    { productId: "P-TAH", quantity: 150 },
    { productId: "P-TAL", quantity: 70 },
  ],
});

const ROLE_ACTOR: Record<Role, string> = {
  owner: "Rodel Samonte",
  sales: "Kristine Ramos",
  dispatcher: "Noel Pascual",
  procurement: "Edwin Manalo",
  warehouse: "Bong Esguerra",
  accounting: "Grace Lontoc",
  driver: "Joel Mendoza",
  customer: "Marco Villareal (portal)",
};
export const actorFor = (role: Role) => ROLE_ACTOR[role];

export const useAppStore = create<DataState & Actions>()(
  persist(
    (set, get) => {
      /** Advance the demo clock a couple of minutes per action so new events sort after seeded ones. */
      const stamp = () => {
        const tick = get().tick + 2;
        set({ tick });
        return format(addMinutes(parseISO(NOW), tick), "yyyy-MM-dd'T'HH:mm");
      };
      const actor = () => ROLE_ACTOR[get().role];
      const pushEvent = (o: Order, label: string, note?: string, at?: string): Order => ({
        ...o,
        history: [...o.history, { at: at ?? stamp(), label, by: actor(), note }],
      });
      const notify = (n: Omit<AppNotification, "id" | "at" | "read">) =>
        set((s) => ({ notifications: [{ ...n, id: `N-${Date.now().toString(36)}`, at: stamp(), read: false }, ...s.notifications] }));

      return {
        ...initialData(),
        setRole: (role) => set({ role }),
        now: () => format(addMinutes(parseISO(NOW), get().tick), "yyyy-MM-dd'T'HH:mm"),

        createOrder: (input) => {
          const prefix = `FR-${yymmdd(input.deliveryDate)}-`;
          const seq = get().orders.filter((o) => o.id.startsWith(prefix)).reduce((m, o) => Math.max(m, Number(o.id.slice(-3))), 0) + 1;
          const id = `${prefix}${String(seq).padStart(3, "0")}`;
          const customer = get().customers.find((c) => c.id === input.customerId)!;
          const at = stamp();
          const order: Order = {
            id,
            customerId: input.customerId,
            source: input.source,
            items: input.items,
            discount: input.discount,
            deliveryFee: input.deliveryFee,
            status: input.status,
            paymentTerms: input.paymentTerms,
            addressId: input.addressId,
            createdAt: at,
            deliveryDate: input.deliveryDate,
            deliveryWindow: input.deliveryWindow ?? customer.addresses.find((a) => a.id === input.addressId)?.receivingHours,
            fulfillment: input.fulfillment ?? customer.fulfillment,
            salespersonId: customer.salespersonId,
            notes: input.notes,
            history: [
              { at, label: input.source === "Customer Portal" ? "Order submitted via Customer Portal" : `Order recorded (${input.source})`, by: input.createdBy },
              ...(input.status === "Confirmed" ? [{ at, label: "Order confirmed", by: input.createdBy }] : []),
            ],
          };
          set((s) => ({ orders: [order, ...s.orders] }));
          if (input.status === "Pending Confirmation") {
            notify({ kind: "order", title: "Order needs confirmation", body: `Order ${id} (${customer.name}) needs confirmation.`, href: `/orders/${id}`, severity: "warning", roles: ["owner", "sales"] });
          }
          return id;
        },

        updateOrder: (id, patch, event) =>
          set((s) => ({
            orders: s.orders.map((o) => {
              if (o.id !== id) return o;
              const next = { ...o, ...patch };
              return event ? pushEvent(next, event.label, event.note) : next;
            }),
          })),

        setOrderStatus: (id, status, note) => {
          const at = stamp();
          set((s) => ({
            orders: s.orders.map((o) => {
              if (o.id !== id) return o;
              const label = status === "Confirmed" ? "Order confirmed" : status === "Delivered" ? (o.fulfillment === "pickup" ? "Picked up at bodega" : "Delivered") : `Status changed to ${status}`;
              return pushEvent({ ...o, status, deliveredAt: status === "Delivered" ? at : o.deliveredAt }, label, note, at);
            }),
          }));
        },

        cancelOrder: (id, reason) => {
          set((s) => ({
            orders: s.orders.map((o) => (o.id === id ? pushEvent({ ...o, status: "Cancelled", cancelReason: reason, tripId: undefined }, "Order cancelled", reason) : o)),
            deliveries: s.deliveries.filter((d) => !(d.orderId === id && d.status !== "Delivered")),
          }));
        },

        assignOrderToTrip: (orderId, tripId) => {
          const s = get();
          const order = s.orders.find((o) => o.id === orderId);
          if (!order) return;
          const prevTrip = order.tripId;
          let deliveries = s.deliveries.filter((d) => !(d.orderId === orderId && d.tripId === prevTrip));
          if (tripId) {
            const trip = s.trips.find((t) => t.id === tripId)!;
            const route = routeById(trip.routeId);
            const onTrip = deliveries.filter((d) => d.tripId === tripId);
            const seq = onTrip.length + 1;
            const customer = s.customers.find((c) => c.id === order.customerId)!;
            const lastEta = onTrip.map((d) => d.eta).sort().pop();
            const eta = lastEta
              ? format(addMinutes(parseISO(lastEta), 30), "yyyy-MM-dd'T'HH:mm")
              : format(addMinutes(parseISO(trip.departure), areaById(customer.areaId).driveMinutes || areaById(route.outboundAreas[0]).driveMinutes), "yyyy-MM-dd'T'HH:mm");
            deliveries = [
              ...deliveries,
              { id: orderId.replace("FR-", "DLV-"), orderId, tripId, stopSeq: seq, status: trip.status === "Loading" ? "Loading" : "Scheduled", eta },
            ];
          }
          set({
            deliveries,
            orders: s.orders.map((o) =>
              o.id === orderId
                ? pushEvent({ ...o, tripId: tripId ?? undefined }, tripId ? `Assigned to ${tripId}` : `Removed from ${prevTrip}`)
                : o,
            ),
          });
        },

        setTripStatus: (tripId, status) => {
          const at = stamp();
          set((s) => ({
            trips: s.trips.map((t) =>
              t.id === tripId
                ? { ...t, status, actualDeparture: status === "In Transit" && !t.actualDeparture ? at : t.actualDeparture, actualReturn: status === "Completed" ? at : t.actualReturn }
                : t,
            ),
            deliveries:
              status === "In Transit"
                ? s.deliveries.map((d, _i, all) => {
                    if (d.tripId !== tripId || d.status === "Delivered") return d;
                    const first = all.filter((x) => x.tripId === tripId && x.status !== "Delivered").sort((a, b) => a.stopSeq - b.stopSeq)[0];
                    return { ...d, status: first?.id === d.id ? "In Transit" : "Scheduled" };
                  })
                : s.deliveries,
            orders:
              status === "In Transit"
                ? s.orders.map((o) => (o.tripId === tripId && ["Confirmed", "Preparing", "Ready for Dispatch"].includes(o.status) ? pushEvent({ ...o, status: "Out for Delivery" }, "Out for delivery", undefined, at) : o))
                : s.orders,
          }));
        },

        markArrived: (deliveryId) => {
          const at = stamp();
          set((s) => ({ deliveries: s.deliveries.map((d) => (d.id === deliveryId ? { ...d, status: "Arrived", arrivedAt: at } : d)) }));
        },

        markDelivered: (deliveryId, pod, cashCollected) => {
          const at = stamp();
          const s = get();
          const dl = s.deliveries.find((d) => d.id === deliveryId);
          if (!dl) return;
          const trip = s.trips.find((t) => t.id === dl.tripId);
          const driver = trip ? driverById(trip.driverId).name : actor();
          const remaining = s.deliveries.filter((d) => d.tripId === dl.tripId && d.id !== deliveryId && !["Delivered", "Failed", "Returned"].includes(d.status)).sort((a, b) => a.stopSeq - b.stopSeq);
          set({
            deliveries: s.deliveries.map((d) => {
              if (d.id === deliveryId) return { ...d, status: "Delivered", arrivedAt: d.arrivedAt ?? at, completedAt: at, pod: { ...pod, signedAt: at } };
              if (remaining[0] && d.id === remaining[0].id && d.status === "Scheduled") return { ...d, status: "In Transit" };
              return d;
            }),
            orders: s.orders.map((o) =>
              o.id === dl.orderId ? { ...o, status: "Delivered", deliveredAt: at, history: [...o.history, { at, label: "Delivered", by: driver, note: `Received by ${pod.receivedBy}${pod.photoCount ? ` · ${pod.photoCount} POD photo(s)` : ""}` }] } : o,
            ),
          });
          if (cashCollected && cashCollected > 0) {
            const o = get().orders.find((x) => x.id === dl.orderId)!;
            get().recordPayment({ invoiceId: invoiceIdForOrder(o.id), orderId: o.id, customerId: o.customerId, amount: Math.min(cashCollected, orderBilledAmount(o)), method: "COD", reference: "Cash collected by driver", notes: `Collected by ${driver}` });
          }
        },

        recordPayment: (input) => {
          const s = get();
          const lastReceipt = s.payments.reduce((m, p) => Math.max(m, Number(p.receiptNo.replace("OR-", ""))), 0);
          const date = stamp();
          const prefix = `PAY-${yymmdd(date)}-`;
          const n = s.payments.filter((p) => p.id.startsWith(prefix)).length + 1;
          const id = `${prefix}${String(n).padStart(3, "0")}`;
          const payment: Payment = { ...input, id, receiptNo: `OR-${String(lastReceipt + 1).padStart(6, "0")}`, date, recordedBy: actor() === "Joel Mendoza" ? "Grace Lontoc" : actor() };
          set((st) => ({
            payments: [...st.payments, payment],
            orders: st.orders.map((o) => (o.id === input.orderId ? { ...o, history: [...o.history, { at: payment.date, label: `Payment received — ₱${input.amount.toLocaleString("en-PH")}`, by: payment.recordedBy, note: `${input.method} · ${payment.receiptNo}` }] } : o)),
          }));
          return payment.receiptNo;
        },

        createPO: (input) => {
          const s = get();
          const prefix = `PO-${yymmdd(TODAY)}-`;
          const seq = s.purchaseOrders.filter((p) => p.id.startsWith(prefix)).reduce((m, p) => Math.max(m, Number(p.id.slice(-3))), 0) + 1;
          const id = `${prefix}${String(seq).padStart(3, "0")}`;
          const sup = supplierById(input.supplierId);
          const po: PurchaseOrder = {
            id,
            supplierId: input.supplierId,
            items: input.items,
            status: input.status,
            createdAt: stamp(),
            pickupDate: input.pickupDate,
            pickupLocation: sup.pickupLocation,
            pickupAreaId: sup.pickupAreaId,
            tripId: input.tripId,
            createdBy: actor(),
            notes: input.notes,
          };
          set({ purchaseOrders: [po, ...s.purchaseOrders] });
          return id;
        },

        setPOStatus: (id, status) => {
          const at = stamp();
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((p) =>
              p.id === id
                ? {
                    ...p,
                    status,
                    pickedUpAt: status === "Picked Up" ? at : p.pickedUpAt,
                    receivedAt: status === "Received" ? at : p.receivedAt,
                    items: status === "Received" ? p.items.map((i) => ({ ...i, receivedQty: i.receivedQty ?? i.quantity })) : p.items,
                  }
                : p,
            ),
          }));
        },

        assignPOToTrip: (poId, tripId) => {
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((p) => {
              if (p.id !== poId) return p;
              const trip = tripId ? s.trips.find((t) => t.id === tripId) : undefined;
              return {
                ...p,
                tripId: tripId ?? undefined,
                pickupDate: trip?.date ?? p.pickupDate,
                pickupEta: trip ? format(addMinutes(parseISO(trip.expectedReturn), -6 * 60), "yyyy-MM-dd'T'HH:mm") : p.pickupEta,
                status: p.status === "Draft" ? "Sent" : p.status,
              };
            }),
          }));
        },

        moveLead: (id, stage, note) => {
          const at = stamp();
          set((s) => ({
            leads: s.leads.map((l) =>
              l.id === id ? { ...l, stage, lastContactAt: at.slice(0, 10), activities: [...l.activities, { at, note: note ?? `Moved to ${stage}`, by: actor() }] } : l,
            ),
          }));
        },

        addLead: (lead) => {
          const s = get();
          const id = `LD-${String(s.leads.length + 1).padStart(3, "0")}`;
          const at = stamp();
          set({ leads: [{ ...lead, id, createdAt: at.slice(0, 10), lastContactAt: at.slice(0, 10), activities: [{ at, note: "Lead created", by: actor() }] }, ...s.leads] });
          return id;
        },

        convertLead: (id) => {
          const s = get();
          const lead = s.leads.find((l) => l.id === id)!;
          if (lead.convertedCustomerId) return lead.convertedCustomerId;
          const num = s.customers.reduce((m, c) => Math.max(m, Number(c.id.slice(4))), 0) + 1;
          const cid = `CUS-${String(num).padStart(3, "0")}`;
          const areaId = lead.areaId ?? "lucena";
          const area = areaById(areaId);
          const salesperson = staffById(lead.ownerId) ? lead.ownerId : "ST-02";
          const customer: Customer = {
            id: cid,
            name: lead.businessName,
            type: lead.businessType,
            areaId,
            contacts: [{ name: lead.contactName, position: "Owner", phone: lead.phone, primary: true }],
            addresses: [{ id: `${cid}-A1`, label: "Main receiving", line1: "To be confirmed on first delivery", barangay: "—", city: area.name, province: area.province, areaId, receivingHours: "6:00 AM – 12:00 NN", default: true }],
            paymentTerms: "COD",
            creditLimit: 0,
            salespersonId: salesperson,
            leadSource: lead.source,
            customerSince: TODAY,
            preferredProductIds: lead.interestedProductIds,
            fulfillment: area.interIsland ? "partner" : ["lucena", "sariaya", "tayabas", "pagbilao", "candelaria"].includes(areaId) ? "pickup" : "truck",
            status: "new",
            notes: `Converted from lead ${lead.id} (${lead.source}). Potential: ${lead.potentialVolume}. First 3 orders COD before credit review.`,
            deliveryFee: 0,
            paymentBehavior: "average",
            frequency: 3,
          };
          const at = stamp();
          set({
            customers: [...s.customers, customer],
            leads: s.leads.map((l) => (l.id === id ? { ...l, stage: "Won", convertedCustomerId: cid, activities: [...l.activities, { at, note: `Converted to customer ${cid}`, by: actor() }] } : l)),
          });
          return cid;
        },

        addCustomer: (input) => {
          const s = get();
          const num = s.customers.reduce((m, c) => Math.max(m, Number(c.id.slice(4))), 0) + 1;
          const id = `CUS-${String(num).padStart(3, "0")}`;
          const customer: Customer = {
            ...input,
            id,
            customerSince: TODAY,
            status: "new",
            paymentBehavior: "average",
            frequency: 3,
            addresses: input.addresses.map((a, i) => ({ ...a, id: `${id}-A${i + 1}` })),
          };
          set({ customers: [...s.customers, customer] });
          return id;
        },

        addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: `EXP-${String(s.expenses.length + 1).padStart(5, "0")}`, recordedBy: actor() }, ...s.expenses] })),

        setStandingOrderStatus: (id, status) => set((s) => ({ standingOrders: s.standingOrders.map((so) => (so.id === id ? { ...so, status } : so)) })),
        saveStandingOrder: (so) =>
          set((s) => {
            if (so.id && s.standingOrders.some((x) => x.id === so.id)) return { standingOrders: s.standingOrders.map((x) => (x.id === so.id ? ({ ...x, ...so } as StandingOrder) : x)) };
            const id = `SO-${String(s.standingOrders.length + 1).padStart(3, "0")}`;
            return { standingOrders: [...s.standingOrders, { ...so, id } as StandingOrder] };
          }),

        addQuoteRequest: (q) => {
          const s = get();
          const id = `RFQ-${String(417 + s.quoteRequests.length + 1).padStart(4, "0")}`;
          set({ quoteRequests: [{ ...q, id, status: "Submitted", createdAt: stamp() }, ...s.quoteRequests] });
          notify({ kind: "lead", title: "New quote request", body: `${q.businessName} requested a wholesale quote (${id}).`, href: "/leads", severity: "info", roles: ["owner", "sales"] });
          return id;
        },

        markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

        addToCart: (productId, quantity) =>
          set((s) => {
            const existing = s.cart.find((l) => l.productId === productId);
            return { cart: existing ? s.cart.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l)) : [...s.cart, { productId, quantity }] };
          }),
        setCartQty: (productId, quantity) => set((s) => ({ cart: s.cart.map((l) => (l.productId === productId ? { ...l, quantity } : l)) })),
        removeFromCart: (productId) => set((s) => ({ cart: s.cart.filter((l) => l.productId !== productId) })),
        clearCart: () => set({ cart: [] }),

        resetDemo: () => set({ ...initialData(), role: get().role }),
      };
    },
    {
      name: "freshroute-demo-v3",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        role: s.role,
        tick: s.tick,
        orders: s.orders,
        trips: s.trips,
        deliveries: s.deliveries,
        purchaseOrders: s.purchaseOrders,
        payments: s.payments,
        expenses: s.expenses,
        customers: s.customers,
        leads: s.leads,
        standingOrders: s.standingOrders,
        quoteRequests: s.quoteRequests,
        notifications: s.notifications,
        cart: s.cart,
      }),
    },
  ),
);

/** Hydration flag lives outside the persisted store. */
export const useHydrated = create<{ hydrated: boolean; set: (v: boolean) => void }>((set) => ({ hydrated: false, set: (v) => set({ hydrated: v }) }));
