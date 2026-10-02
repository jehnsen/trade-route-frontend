"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { addMinutes, format, parseISO } from "date-fns";
import type {
  AppNotification,
  AvailableCapacity,
  AvailableLoad,
  AvailableLoadStatus,
  BackhaulBookingRequest,
  BackhaulListing,
  CapacityStatus,
  CargoCategory,
  CartLine,
  Charge,
  Customer,
  Delivery,
  DeliveryIssueType,
  Expense,
  Fulfillment,
  FreightQuote,
  FuelLog,
  InventoryBatch,
  JobSource,
  JobStatus,
  Lead,
  LeadSource,
  LeadStage,
  Leg,
  Load,
  LoadType,
  LogisticsJob,
  MaintenanceRecord,
  MaintenanceStatus,
  Order,
  OrderItem,
  OrderSource,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentTerms,
  Place,
  POItem,
  POStatus,
  ProofOfDelivery,
  PurchaseOrder,
  QuoteRequest,
  QuoteStatus,
  Role,
  SalesPayment,
  SalesPaymentMethod,
  StandingOrder,
  Trip,
  TripStatus,
  TruckRequirement,
  TruckingPartner,
  VehicleDocument,
} from "@/types";
import { NOW, TODAY, staffById } from "@/data/company";
import { LOGISTICS_SEED } from "@/data/logistics-seed";
import { ORDERS, QUOTE_REQUESTS, SALES_PAYMENTS } from "@/data/orders";
import { INVENTORY_BATCHES, PURCHASE_ORDERS } from "@/data/procurement";
import { CUSTOMERS, STANDING_ORDERS } from "@/data/customers";
import { LEADS } from "@/data/leads";
import { VEHICLE_DOCUMENTS, driverById, truckById } from "@/data/fleet";
import { areaById, LUCENA_WAREHOUSE, routeById } from "@/data/areas";
import { supplierById } from "@/data/suppliers";
import { BOARD_CAPACITY, BOARD_LOADS, TRUCKING_PARTNERS } from "@/data/load-board";
import { BACKHAUL_LISTINGS, BACKHAUL_REQUESTS } from "@/data/backhaul-marketplace";
import { bookingLeg, customerTypeFor, leadSourceFor, legOpen, requiredByFor, shortArea, truckRequirementFor } from "@/lib/load-board";
import { listingStatus, marketplaceQuote } from "@/lib/backhaul-marketplace";

import {
  DELIVERY_DONE,
  canAddReturnCargo,
  currentOdometer,
  getTripMetricsMap,
  invoiceIdForJob,
  isTripEditable,
  jobTotal,
  nextSeqId,
  rebuildTrip,
} from "@/lib/logistics";

export const PORTAL_CUSTOMER_ID = "CUS-022";

const yymmdd = (iso: string) => iso.slice(2, 10).replace(/-/g, "");
const maxNum = (ids: string[], re: RegExp) => ids.reduce((m, id) => Math.max(m, Number(id.match(re)?.[1] ?? 0)), 0);

// ─── Inputs ─────────────────────────────────────────────────────────────────
export interface CargoLineInput {
  cargoDescription: string;
  cargoCategory: CargoCategory;
  quantity: number;
  unit: string;
  weightKg: number;
  handlingNotes?: string;
}

export interface NewJobInput {
  customerId: string;
  source: JobSource;
  leg: Leg;
  pickup: Place;
  dropoff: Place;
  consignee: { name: string; phone: string };
  cargo: CargoLineInput[];
  truckRequirement: TruckRequirement;
  pickupAt: string;
  requiredBy: string;
  freightCharge: number;
  additionalCharges: Charge[];
  paymentTerms: PaymentTerms;
  instructions?: string;
  notes?: string;
  status: "Inquiry" | "Confirmed" | "Awaiting Dispatch";
  quoteId?: string;
  loadType?: LoadType;
}

export interface NewQuoteInput {
  customerId?: string;
  leadId?: string;
  pickup: Place;
  dropoff: Place;
  cargoDescription: string;
  cargoCategory: CargoCategory;
  weightKg: number;
  volumeCbm?: number;
  truckRequirement: TruckRequirement;
  pickupDate: string;
  requiredDate: string;
  freightCharge: number;
  additionalCharges: Charge[];
  notes?: string;
  validUntil: string;
  status: "Draft" | "Sent";
}

export interface NewCompanyLoadInput {
  cargoDescription: string;
  cargoCategory: CargoCategory;
  quantity: number;
  unit: string;
  weightKg: number;
  leg: Leg;
  pickup: Place;
  destination: Place;
  estimatedValue?: number;
  handlingNotes?: string;
  tripId?: string;
}

export interface NewTripInput {
  date: string;
  truckId: string;
  driverId: string;
  helperIds: string[];
  routeId: string;
  departure: string;
  notes?: string;
}

export interface NewPaymentInput {
  invoiceId: string;
  jobId: string;
  customerId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  notes?: string;
}

export interface NewFuelLogInput {
  truckId: string;
  tripId?: string;
  driverId: string;
  date: string;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  station: string;
  areaId: FuelLog["areaId"];
  fullTank: boolean;
  receiptRef?: string;
}

export type PodInput = Omit<ProofOfDelivery, "signedAt" | "receiptNo"> & { receiptNo?: string };

// Load board inputs
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type BoardManaged = "id" | "createdAt" | "postedBy" | "status" | "closedReason";
export type NewBoardLoadInput = Omit<AvailableLoad, BoardManaged | "jobId" | "capacityId" | "bookedAt">;
export type NewCapacityInput = DistributiveOmit<AvailableCapacity, BoardManaged>;
export type NewPartnerInput = Omit<TruckingPartner, "id" | "since">;

export interface BookBoardLoadInput {
  loadId: string;
  /** Capacity post the load was matched with (our trip or a partner truck). */
  capacityId?: string;
  /** Bill-to customer; when empty a new customer is created from the poster. */
  customerId?: string;
  newCustomerName?: string;
  freightCharge: number;
  paymentTerms: PaymentTerms;
  consignee: { name: string; phone: string };
}

// Backhaul marketplace inputs
export type PublishListingInput = Pick<BackhaulListing, "tripId" | "ratePerKg" | "minimumCharge" | "acceptedCargo" | "restrictions">;
export type NewBackhaulRequestInput = Omit<BackhaulBookingRequest, "id" | "quotedFreight" | "status" | "createdAt" | "respondedAt" | "respondedBy" | "declineReason" | "jobId">;
export interface ConfirmBackhaulRequestInput {
  requestId: string;
  /** Bill-to customer; when empty a new customer is created from the shipper. */
  customerId?: string;
  freightCharge: number;
  paymentTerms: PaymentTerms;
}

// Trading inputs
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
export interface NewSalesPaymentInput {
  invoiceId: string;
  orderId: string;
  customerId: string;
  amount: number;
  method: SalesPaymentMethod;
  reference: string;
  notes?: string;
}
export interface NewPOInput {
  supplierId: string;
  items: POItem[];
  pickupDate: string;
  status: "Draft" | "Sent";
  notes?: string;
}

interface DataState {
  role: Role;
  tick: number;
  // Logistics (Phase 1)
  customers: Customer[];
  leads: Lead[];
  quotes: FreightQuote[];
  jobs: LogisticsJob[];
  loads: Load[];
  trips: Trip[];
  deliveries: Delivery[];
  payments: Payment[];
  expenses: Expense[];
  fuelLogs: FuelLog[];
  maintenance: MaintenanceRecord[];
  documents: VehicleDocument[];
  notifications: AppNotification[];
  // Load board
  truckingPartners: TruckingPartner[];
  boardLoads: AvailableLoad[];
  boardCapacity: AvailableCapacity[];
  // Backhaul marketplace (preview)
  backhaulListings: BackhaulListing[];
  backhaulRequests: BackhaulBookingRequest[];
  // Trading (Phase 2 preview)
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
  salesPayments: SalesPayment[];
  inventory: InventoryBatch[];
  standingOrders: StandingOrder[];
  quoteRequests: QuoteRequest[];
  cart: CartLine[];
}

interface Actions {
  setRole: (role: Role) => void;
  now: () => string;
  // Sales & CRM
  createQuote: (input: NewQuoteInput) => string;
  setQuoteStatus: (id: string, status: QuoteStatus, reason?: string) => void;
  convertQuoteToJob: (quoteId: string) => string;
  moveLead: (id: string, stage: LeadStage, note?: string) => void;
  addLead: (lead: Omit<Lead, "id" | "activities" | "createdAt" | "lastContactAt">) => string;
  convertLead: (id: string) => string;
  addCustomer: (c: Omit<Customer, "id" | "customerSince" | "status" | "paymentBehavior" | "frequency">) => string;
  // Jobs & cargo
  createJob: (input: NewJobInput) => string;
  setJobStatus: (id: string, status: JobStatus, note?: string) => void;
  cancelJob: (id: string, reason: string) => void;
  assignJobToTrip: (jobId: string, tripId: string | null) => void;
  createCompanyLoad: (input: NewCompanyLoadInput) => string;
  assignLoadToTrip: (loadId: string, tripId: string | null) => void;
  // Trips
  createTrip: (input: NewTripInput) => string;
  setTripStatus: (tripId: string, status: TripStatus) => void;
  completeTrip: (tripId: string, close: { odometerEnd: number; fuel?: { liters: number; pricePerLiter: number; station: string } }) => void;
  markStopArrived: (tripId: string, stopId: string) => void;
  completeStop: (tripId: string, stopId: string) => void;
  // Deliveries & POD
  markArrived: (deliveryId: string) => void;
  markDelivered: (deliveryId: string, pod: PodInput, cashCollected?: number) => void;
  updatePod: (deliveryId: string, patch: Partial<ProofOfDelivery>) => void;
  reportDeliveryIssue: (deliveryId: string, issue: { type: DeliveryIssueType; note: string }, failed?: boolean) => void;
  // Finance
  recordPayment: (input: NewPaymentInput) => string;
  addExpense: (e: Omit<Expense, "id" | "recordedBy">) => void;
  // Fleet
  addFuelLog: (input: NewFuelLogInput) => string;
  addMaintenance: (m: Omit<MaintenanceRecord, "id">) => string;
  setMaintenanceStatus: (id: string, status: MaintenanceStatus, patch?: Partial<Pick<MaintenanceRecord, "cost" | "odometerKm" | "date" | "notes">>) => void;
  renewDocument: (id: string, patch: Pick<VehicleDocument, "reference" | "issueDate" | "expiryDate"> & { attachment?: string }) => void;
  // Load board
  postBoardLoad: (input: NewBoardLoadInput) => string;
  postCapacity: (input: NewCapacityInput) => string;
  addTruckingPartner: (input: NewPartnerInput) => string;
  setBoardLoadStatus: (id: string, status: AvailableLoadStatus, reason?: string) => void;
  setCapacityStatus: (id: string, status: CapacityStatus, reason?: string) => void;
  updateCapacityUsed: (id: string, usedKg: number) => void;
  reserveOnPartnerTruck: (loadId: string, capacityId: string) => void;
  bookBoardLoad: (input: BookBoardLoadInput) => { jobId: string; created: boolean } | undefined;
  // Backhaul marketplace (preview)
  publishBackhaulListing: (input: PublishListingInput) => string | undefined;
  setBackhaulListingStatus: (id: string, status: BackhaulListing["status"]) => void;
  requestBackhaulSpace: (input: NewBackhaulRequestInput) => string | undefined;
  confirmBackhaulRequest: (input: ConfirmBackhaulRequestInput) => { jobId: string; created: boolean } | undefined;
  declineBackhaulRequest: (id: string, reason: string) => void;
  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  // Trading
  createOrder: (input: NewOrderInput) => string;
  updateOrder: (id: string, patch: Partial<Order>, event?: { label: string; note?: string }) => void;
  setOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  cancelOrder: (id: string, reason: string) => void;
  recordSalesPayment: (input: NewSalesPaymentInput) => string;
  createPO: (input: NewPOInput) => string;
  setPOStatus: (id: string, status: POStatus) => void;
  setStandingOrderStatus: (id: string, status: StandingOrder["status"]) => void;
  saveStandingOrder: (so: Omit<StandingOrder, "id"> & { id?: string }) => void;
  addQuoteRequest: (q: Omit<QuoteRequest, "id" | "status" | "createdAt">) => string;
  addToCart: (productId: string, quantity: number) => void;
  setCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  resetDemo: () => void;
}

const initialData = (): DataState => ({
  role: "owner",
  tick: 0,
  customers: CUSTOMERS,
  leads: LEADS,
  quotes: LOGISTICS_SEED.quotes,
  jobs: LOGISTICS_SEED.jobs,
  loads: LOGISTICS_SEED.loads,
  trips: LOGISTICS_SEED.trips,
  deliveries: LOGISTICS_SEED.deliveries,
  payments: LOGISTICS_SEED.payments,
  expenses: LOGISTICS_SEED.expenses,
  fuelLogs: LOGISTICS_SEED.fuelLogs,
  maintenance: LOGISTICS_SEED.maintenance,
  documents: VEHICLE_DOCUMENTS,
  notifications: LOGISTICS_SEED.notifications,
  truckingPartners: TRUCKING_PARTNERS,
  boardLoads: BOARD_LOADS,
  boardCapacity: BOARD_CAPACITY,
  backhaulListings: BACKHAUL_LISTINGS,
  backhaulRequests: BACKHAUL_REQUESTS,
  orders: ORDERS,
  purchaseOrders: PURCHASE_ORDERS,
  salesPayments: SALES_PAYMENTS,
  inventory: INVENTORY_BATCHES,
  standingOrders: STANDING_ORDERS,
  quoteRequests: QUOTE_REQUESTS,
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
      const notify = (n: Omit<AppNotification, "id" | "at" | "read">) =>
        set((s) => ({ notifications: [{ ...n, id: `N-${Date.now().toString(36)}-${s.notifications.length}`, at: stamp(), read: false }, ...s.notifications].slice(0, 200) }));
      const jobEvent = (j: LogisticsJob, label: string, at: string, note?: string, by?: string): LogisticsJob => ({ ...j, history: [...j.history, { at, label, by: by ?? actor(), note }] });
      const tripEvent = (t: Trip, label: string, at: string, note?: string, by?: string): Trip => ({ ...t, history: [...t.history, { at, label, by: by ?? actor(), note }] });

      /** Re-plan the given trips after loads/jobs changed, keeping deliveries consistent. */
      const replan = (tripIds: (string | undefined | null)[], loads: Load[], jobs: LogisticsJob[]) => {
        const s = get();
        let trips = s.trips;
        let deliveries = s.deliveries;
        for (const id of new Set(tripIds.filter((x): x is string => !!x))) {
          const trip = trips.find((t) => t.id === id);
          if (!trip) continue;
          const r = rebuildTrip(trip, loads, jobs, s.customers, deliveries);
          trips = trips.map((t) => (t.id === id ? r.trip : t));
          deliveries = r.deliveries;
        }
        return { trips, deliveries };
      };

      const newLoadIds = (date: string, n: number, existing: Load[]) => {
        const head = `LOAD-${yymmdd(date)}-`;
        const start = existing.filter((l) => l.id.startsWith(head)).reduce((m, l) => Math.max(m, Number(l.id.slice(head.length)) || 0), 0);
        return Array.from({ length: n }, (_, i) => `${head}${String(start + i + 1).padStart(3, "0")}`);
      };

      const buildJob = (input: NewJobInput, at: string): { job: LogisticsJob; loads: Load[] } => {
        const s = get();
        const customer = s.customers.find((c) => c.id === input.customerId)!;
        const date = input.pickupAt.slice(0, 10);
        const id = nextSeqId("JOB", yymmdd(date), s.jobs);
        const weightKg = input.cargo.reduce((a, l) => a + l.weightKg, 0);
        const heaviest = [...input.cargo].sort((a, b) => b.weightKg - a.weightKg)[0];
        const job: LogisticsJob = {
          id,
          customerId: customer.id,
          source: input.source,
          quoteId: input.quoteId,
          leg: input.leg,
          pickup: input.pickup,
          dropoff: input.dropoff,
          consignee: input.consignee,
          cargoDescription: input.cargo.map((l) => l.cargoDescription).join(" + "),
          cargoCategory: heaviest?.cargoCategory ?? "General Cargo",
          weightKg,
          truckRequirement: input.truckRequirement,
          pickupAt: input.pickupAt,
          requiredBy: input.requiredBy,
          freightCharge: input.freightCharge,
          additionalCharges: input.additionalCharges,
          paymentTerms: input.paymentTerms,
          status: input.status,
          salespersonId: customer.salespersonId,
          instructions: input.instructions,
          notes: input.notes,
          createdAt: at,
          history: [
            { at, label: input.source === "Customer Portal" ? "Booking submitted via Customer Portal" : `Booking recorded (${input.source})`, by: actor() },
            ...(input.status !== "Inquiry" ? [{ at, label: "Booking confirmed", by: actor() }] : []),
          ],
        };
        const type: LoadType = input.loadType ?? (input.leg === "outbound" ? "Outbound" : "Backhaul");
        const ids = newLoadIds(date, input.cargo.length, s.loads);
        const loads: Load[] = input.cargo.map((l, i) => ({
          id: ids[i],
          jobId: id,
          customerId: customer.id,
          type,
          leg: input.leg,
          cargoDescription: l.cargoDescription,
          cargoCategory: l.cargoCategory,
          quantity: l.quantity,
          unit: l.unit,
          weightKg: l.weightKg,
          pickup: input.pickup,
          destination: input.dropoff,
          status: "Pending",
          handlingNotes: l.handlingNotes,
          createdAt: at,
        }));
        return { job, loads };
      };

      /** Save an outside shipper as a new customer — COD until credit review. */
      const addShipperCustomer = (o: { name: string; contact: { name: string; phone: string }; place: Place; addressLabel: string; category: CargoCategory; paymentTerms: PaymentTerms; leadSource: LeadSource; notes: string }) => {
        const s = get();
        const id = `CUS-${String(maxNum(s.customers.map((c) => c.id), /CUS-(\d+)/) + 1).padStart(3, "0")}`;
        const area = areaById(o.place.areaId);
        const customer: Customer = {
          id,
          name: o.name,
          type: customerTypeFor(o.category),
          areaId: area.id,
          contacts: [{ name: o.contact.name, position: "Shipper", phone: o.contact.phone, primary: true }],
          addresses: [{ id: `${id}-A1`, label: o.addressLabel, line1: o.place.address ?? o.place.name, barangay: "—", city: area.name, province: area.province, areaId: area.id, receivingHours: "To be confirmed", default: true }],
          paymentTerms: o.paymentTerms,
          creditLimit: 0,
          salespersonId: "ST-02",
          leadSource: o.leadSource,
          customerSince: TODAY,
          preferredProductIds: [],
          fulfillment: "truck",
          status: "new",
          notes: o.notes,
          deliveryFee: 0,
          paymentBehavior: "average",
          frequency: 2,
        };
        set({ customers: [...s.customers, customer] });
        return id;
      };

      /** Return-leg space left on our trip: configured payload − return kg. */
      const returnSpace = (tripId: string) => {
        const s = get();
        const m = getTripMetricsMap(s.trips, s.jobs, s.loads, s.deliveries, s.expenses).get(tripId);
        return m ? m.capacityKg - m.returnKg : 0;
      };

      return {
        ...initialData(),
        setRole: (role) => set({ role }),
        now: () => format(addMinutes(parseISO(NOW), get().tick), "yyyy-MM-dd'T'HH:mm"),

        // ─── Sales & CRM ──────────────────────────────────────────────────
        createQuote: (input) => {
          const at = stamp();
          const id = nextSeqId("QT", yymmdd(at), get().quotes);
          const q: FreightQuote = { ...input, id, createdAt: at, createdBy: actor(), sentAt: input.status === "Sent" ? at : undefined };
          set((s) => ({ quotes: [q, ...s.quotes] }));
          return id;
        },

        setQuoteStatus: (id, status, reason) => {
          const at = stamp();
          set((s) => ({
            quotes: s.quotes.map((q) =>
              q.id === id ? { ...q, status, sentAt: status === "Sent" ? at : q.sentAt, respondedAt: status === "Accepted" || status === "Rejected" ? at : q.respondedAt, rejectReason: status === "Rejected" ? reason : q.rejectReason } : q,
            ),
          }));
        },

        convertQuoteToJob: (quoteId) => {
          const q = get().quotes.find((x) => x.id === quoteId)!;
          if (q.jobId) return q.jobId;
          let customerId = q.customerId;
          if (!customerId && q.leadId) customerId = get().convertLead(q.leadId);
          const customer = get().customers.find((c) => c.id === customerId)!;
          const at = stamp();
          const leg: Leg = areaById(q.pickup.areaId).region === "Quezon Province" ? "outbound" : "return";
          const { job, loads } = buildJob(
            {
              customerId: customer.id,
              source: "Sales Staff",
              leg,
              pickup: q.pickup,
              dropoff: q.dropoff,
              consignee: { name: customer.contacts[0].name, phone: customer.contacts[0].phone },
              cargo: [{ cargoDescription: q.cargoDescription, cargoCategory: q.cargoCategory, quantity: Math.max(1, Math.round(q.weightKg / 25)), unit: "package", weightKg: q.weightKg }],
              truckRequirement: q.truckRequirement,
              pickupAt: `${q.pickupDate < TODAY ? TODAY : q.pickupDate}T04:00`,
              requiredBy: `${q.requiredDate < TODAY ? TODAY : q.requiredDate}T14:00`,
              freightCharge: q.freightCharge,
              additionalCharges: q.additionalCharges,
              paymentTerms: customer.paymentTerms,
              notes: q.notes,
              status: "Confirmed",
              quoteId,
            },
            at,
          );
          job.history.push({ at, label: `Created from accepted quote ${quoteId}`, by: actor() });
          set((s) => ({
            jobs: [job, ...s.jobs],
            loads: [...loads, ...s.loads],
            quotes: s.quotes.map((x) => (x.id === quoteId ? { ...x, jobId: job.id, status: "Accepted", customerId: customer.id, respondedAt: x.respondedAt ?? at } : x)),
          }));
          return job.id;
        },

        moveLead: (id, stage, note) => {
          const at = stamp();
          set((s) => ({
            leads: s.leads.map((l) => (l.id === id ? { ...l, stage, lastContactAt: at.slice(0, 10), activities: [...l.activities, { at, note: note ?? `Moved to ${stage}`, by: actor() }] } : l)),
          }));
        },

        addLead: (lead) => {
          const s = get();
          const id = `LD-${String(maxNum(s.leads.map((l) => l.id), /LD-(\d+)/) + 1).padStart(3, "0")}`;
          const at = stamp();
          set({ leads: [{ ...lead, id, createdAt: at.slice(0, 10), lastContactAt: at.slice(0, 10), activities: [{ at, note: "Lead created", by: actor() }] }, ...s.leads] });
          return id;
        },

        convertLead: (id) => {
          const s = get();
          const lead = s.leads.find((l) => l.id === id)!;
          if (lead.convertedCustomerId) return lead.convertedCustomerId;
          const cid = `CUS-${String(maxNum(s.customers.map((c) => c.id), /CUS-(\d+)/) + 1).padStart(3, "0")}`;
          const areaId = lead.areaId ?? "lucena";
          const area = areaById(areaId);
          const customer: Customer = {
            id: cid,
            name: lead.businessName,
            type: lead.businessType,
            areaId,
            contacts: [{ name: lead.contactName, position: "Owner", phone: lead.phone, primary: true }],
            addresses: [{ id: `${cid}-A1`, label: "Main address", line1: "To be confirmed on first booking", barangay: "—", city: area.name, province: area.province, areaId, receivingHours: "6:00 AM – 12:00 NN", default: true }],
            paymentTerms: "COD",
            creditLimit: 0,
            salespersonId: staffById(lead.ownerId) ? lead.ownerId : "ST-02",
            leadSource: lead.source,
            customerSince: TODAY,
            preferredProductIds: [],
            fulfillment: area.interIsland ? "partner" : "truck",
            status: "new",
            notes: `Converted from lead ${lead.id} (${lead.source}). Lane: ${lead.lane}. Cargo: ${lead.cargoInterest}. Potential: ${lead.potentialVolume}. First 3 bookings COD before credit review.`,
            deliveryFee: 0,
            paymentBehavior: "average",
            frequency: 3,
          };
          const at = stamp();
          set({
            customers: [...s.customers, customer],
            leads: s.leads.map((l) => (l.id === id ? { ...l, stage: "Won", convertedCustomerId: cid, activities: [...l.activities, { at, note: `Converted to customer ${cid}`, by: actor() }] } : l)),
            quotes: s.quotes.map((q) => (q.leadId === id && !q.customerId ? { ...q, customerId: cid } : q)),
          });
          return cid;
        },

        addCustomer: (input) => {
          const s = get();
          const id = `CUS-${String(maxNum(s.customers.map((c) => c.id), /CUS-(\d+)/) + 1).padStart(3, "0")}`;
          const customer: Customer = { ...input, id, customerSince: TODAY, status: "new", paymentBehavior: "average", frequency: 3, addresses: input.addresses.map((a, i) => ({ ...a, id: `${id}-A${i + 1}` })) };
          set({ customers: [...s.customers, customer] });
          return id;
        },

        // ─── Jobs & cargo ─────────────────────────────────────────────────
        createJob: (input) => {
          const at = stamp();
          const { job, loads } = buildJob(input, at);
          set((s) => ({ jobs: [job, ...s.jobs], loads: [...loads, ...s.loads] }));
          if (input.quoteId) set((s) => ({ quotes: s.quotes.map((q) => (q.id === input.quoteId ? { ...q, jobId: job.id } : q)) }));
          if (input.status !== "Inquiry") {
            const c = get().customers.find((x) => x.id === input.customerId)!;
            notify({ kind: "job", title: "New job awaiting dispatch", body: `${job.id} — ${c.name}, ${job.weightKg.toLocaleString("en-PH")} kg ${job.cargoDescription}.`, href: `/jobs/${job.id}`, severity: "info", roles: ["owner", "dispatcher"] });
          }
          return job.id;
        },

        setJobStatus: (id, status, note) => {
          const at = stamp();
          set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? jobEvent({ ...j, status }, status === "Confirmed" ? "Booking confirmed" : `Status changed to ${status}`, at, note) : j)) }));
        },

        cancelJob: (id, reason) => {
          const at = stamp();
          const s = get();
          const job = s.jobs.find((j) => j.id === id);
          if (!job) return;
          const loads = s.loads.map((l) => (l.jobId === id && l.status !== "Delivered" ? { ...l, status: "Cancelled" as const, tripId: undefined } : l));
          const jobs = s.jobs.map((j) => (j.id === id ? jobEvent({ ...j, status: "Cancelled", cancelReason: reason, tripId: undefined }, "Booking cancelled", at, reason) : j));
          const prevTrips = s.loads.filter((l) => l.jobId === id && l.tripId).map((l) => l.tripId);
          set({ loads, jobs });
          set(replan(prevTrips, loads, jobs));
        },

        assignJobToTrip: (jobId, tripId) => {
          const at = stamp();
          const s = get();
          const job = s.jobs.find((j) => j.id === jobId);
          if (!job) return;
          const trip = tripId ? s.trips.find((t) => t.id === tripId) : undefined;
          if (trip && !(job.leg === "return" ? canAddReturnCargo(trip) : isTripEditable(trip))) return;
          const prevTrips = s.loads.filter((l) => l.jobId === jobId && l.tripId).map((l) => l.tripId);
          const loads = s.loads.map((l) => (l.jobId === jobId && l.status !== "Cancelled" && l.status !== "Delivered" ? { ...l, tripId: tripId ?? undefined, status: tripId ? ("Assigned" as const) : ("Pending" as const) } : l));
          const jobs = s.jobs.map((j) =>
            j.id === jobId
              ? jobEvent({ ...j, tripId: tripId ?? undefined, status: tripId ? "Assigned" : "Awaiting Dispatch" }, tripId ? `Assigned to ${tripId}` : `Removed from ${job.tripId}`, at, trip ? `${truckById(trip.truckId).code} · ${driverById(trip.driverId).name}` : undefined)
              : j,
          );
          set({ loads, jobs });
          set(replan([...prevTrips, tripId], loads, jobs));
        },

        createCompanyLoad: (input) => {
          const at = stamp();
          const s = get();
          const [id] = newLoadIds(TODAY, 1, s.loads);
          const load: Load = { id, type: "Company-Owned", leg: input.leg, cargoDescription: input.cargoDescription, cargoCategory: input.cargoCategory, quantity: input.quantity, unit: input.unit, weightKg: input.weightKg, pickup: input.pickup, destination: input.destination, tripId: input.tripId, status: input.tripId ? "Assigned" : "Pending", handlingNotes: input.handlingNotes, estimatedValue: input.estimatedValue, createdAt: at };
          const loads = [load, ...s.loads];
          set({ loads });
          if (input.tripId) set(replan([input.tripId], loads, get().jobs));
          return id;
        },

        assignLoadToTrip: (loadId, tripId) => {
          const s = get();
          const load = s.loads.find((l) => l.id === loadId);
          if (!load) return;
          if (load.jobId) return get().assignJobToTrip(load.jobId, tripId);
          const trip = tripId ? s.trips.find((t) => t.id === tripId) : undefined;
          if (trip && !(load.leg === "return" ? canAddReturnCargo(trip) : isTripEditable(trip))) return;
          stamp();
          const loads = s.loads.map((l) => (l.id === loadId ? { ...l, tripId: tripId ?? undefined, status: tripId ? ("Assigned" as const) : ("Pending" as const) } : l));
          set({ loads });
          set(replan([load.tripId, tripId], loads, s.jobs));
        },

        // ─── Trips ────────────────────────────────────────────────────────
        createTrip: (input) => {
          const at = stamp();
          const s = get();
          const id = nextSeqId("TRIP", yymmdd(input.date), s.trips, 2);
          const route = routeById(input.routeId);
          const trip: Trip = {
            id,
            date: input.date,
            truckId: input.truckId,
            driverId: input.driverId,
            helperIds: input.helperIds,
            routeId: input.routeId,
            status: "Planned",
            departure: input.departure,
            expectedReturn: `${input.date}T${route.expectedReturn}`,
            stops: [],
            notes: input.notes,
            history: [{ at, label: "Trip planned", by: actor() }],
          };
          const r = rebuildTrip(trip, s.loads, s.jobs, s.customers, s.deliveries);
          set({ trips: [...s.trips, r.trip].sort((a, b) => a.departure.localeCompare(b.departure) || a.truckId.localeCompare(b.truckId)), deliveries: r.deliveries });
          return id;
        },

        setTripStatus: (tripId, status) => {
          const at = stamp();
          const s = get();
          const trip = s.trips.find((t) => t.id === tripId);
          if (!trip) return;
          if (status === "Cancelled") {
            const loads = s.loads.map((l) => (l.tripId === tripId ? { ...l, tripId: undefined, status: "Pending" as const } : l));
            const jobs = s.jobs.map((j) => (j.tripId === tripId ? jobEvent({ ...j, tripId: undefined, status: "Awaiting Dispatch" }, `Removed from ${tripId} (trip cancelled)`, at) : j));
            set({
              loads,
              jobs,
              trips: s.trips.map((t) => (t.id === tripId ? tripEvent({ ...t, status: "Cancelled", stops: [] }, "Trip cancelled", at) : t)),
              deliveries: s.deliveries.filter((d) => d.tripId !== tripId || DELIVERY_DONE.includes(d.status)),
            });
            return;
          }
          const departing = status === "Dispatched" && !trip.actualDeparture;
          const truck = truckById(trip.truckId);
          const outbound = new Set(s.loads.filter((l) => l.tripId === tripId && l.leg === "outbound").map((l) => l.id));
          const stops = trip.stops.map((st, i) =>
            departing && i === 0 ? { ...st, status: "Completed" as const, actualArrival: st.actualArrival ?? st.plannedArrival, actualDeparture: at } : status === "Loading" && i === 0 && st.status === "Pending" ? { ...st, status: "Arrived" as const, actualArrival: at } : st,
          );
          const label = status === "Dispatched" ? "Dispatched from Lucena" : status === "Loading" ? "Loading started" : status === "Ready" ? "Loading complete — ready to depart" : status === "Returning" ? "All drops done — returning to Lucena" : `Status changed to ${status}`;
          const firstDrop = departing
            ? s.deliveries.filter((d) => d.tripId === tripId && !DELIVERY_DONE.includes(d.status) && d.loadIds.some((id) => outbound.has(id))).sort((a, b) => a.eta.localeCompare(b.eta))[0]
            : undefined;
          set({
            trips: s.trips.map((t) =>
              t.id === tripId
                ? tripEvent({ ...t, status, stops, actualDeparture: departing ? at : t.actualDeparture, odometerStart: departing ? currentOdometer(truck, s.trips, s.fuelLogs) : t.odometerStart }, label, at)
                : t,
            ),
            loads: s.loads.map((l) => {
              if (l.tripId !== tripId || l.status === "Delivered" || l.status === "Cancelled") return l;
              if (status === "Ready" && l.leg === "outbound") return { ...l, status: "Loaded" };
              if (departing && l.leg === "outbound") return { ...l, status: "In Transit" };
              return l;
            }),
            jobs: departing ? s.jobs.map((j) => (j.tripId === tripId && j.leg === "outbound" && j.status === "Assigned" ? jobEvent({ ...j, status: "In Transit" }, `Dispatched on ${tripId}`, at) : j)) : s.jobs,
            deliveries: s.deliveries.map((d) => {
              if (d.tripId !== tripId || DELIVERY_DONE.includes(d.status)) return d;
              if (status === "Loading") return { ...d, status: "Loading" };
              if (status === "Ready") return { ...d, status: "Ready" };
              if (departing) return { ...d, status: firstDrop?.id === d.id ? "In Transit" : "Scheduled" };
              return d;
            }),
          });
        },

        completeTrip: (tripId, close) => {
          const at = stamp();
          const s = get();
          const trip = s.trips.find((t) => t.id === tripId);
          if (!trip) return;
          const failedJobs = new Set(s.deliveries.filter((d) => d.tripId === tripId && (d.status === "Failed" || d.status === "Returned")).map((d) => d.jobId));
          set({
            trips: s.trips.map((t) =>
              t.id === tripId
                ? tripEvent(
                    {
                      ...t,
                      status: "Completed",
                      actualReturn: at,
                      odometerEnd: close.odometerEnd,
                      stops: t.stops.map((st) => (st.status === "Completed" || st.status === "Skipped" ? st : { ...st, status: "Completed", actualArrival: st.actualArrival ?? at, actualDeparture: st.actualDeparture ?? at })),
                    },
                    "Returned to Lucena — trip closed",
                    at,
                    `Odometer ${close.odometerEnd.toLocaleString("en-PH")} km`,
                  )
                : t,
            ),
            loads: s.loads.map((l) => {
              if (l.tripId !== tripId || l.status === "Cancelled" || l.status === "Delivered") return l;
              if (l.jobId && failedJobs.has(l.jobId)) return { ...l, tripId: undefined, status: "Pending", pickup: LUCENA_WAREHOUSE };
              return { ...l, status: "Delivered" };
            }),
            jobs: s.jobs.map((j) => {
              if (j.tripId !== tripId) return j;
              if (failedJobs.has(j.id)) return jobEvent({ ...j, tripId: undefined, status: "Awaiting Dispatch", pickup: LUCENA_WAREHOUSE }, "Cargo back at Lucena bodega — to be rescheduled", at);
              if (j.status === "Delivered") return jobEvent({ ...j, status: "Completed" }, `${tripId} closed`, at);
              return j;
            }),
          });
          if (close.fuel) get().addFuelLog({ truckId: trip.truckId, tripId, driverId: trip.driverId, date: at, odometerKm: close.odometerEnd, liters: close.fuel.liters, pricePerLiter: close.fuel.pricePerLiter, station: close.fuel.station, areaId: "lucena", fullTank: true });
        },

        markStopArrived: (tripId, stopId) => {
          const at = stamp();
          set((s) => ({
            trips: s.trips.map((t) =>
              t.id === tripId ? { ...t, status: t.status === "Dispatched" ? "In Transit" : t.status, stops: t.stops.map((st) => (st.id === stopId ? { ...st, status: "Arrived", actualArrival: at } : st)) } : t,
            ),
          }));
        },

        completeStop: (tripId, stopId) => {
          const at = stamp();
          const s = get();
          const trip = s.trips.find((t) => t.id === tripId);
          const stop = trip?.stops.find((st) => st.id === stopId);
          if (!trip || !stop) return;
          const loaded = new Set(stop.loaded);
          const unloadedAtWarehouse = stop.type === "Warehouse" ? new Set(stop.unloaded) : new Set<string>();
          const pickedJobs = new Set(s.loads.filter((l) => loaded.has(l.id) && l.leg === "return" && l.jobId).map((l) => l.jobId!));
          set({
            trips: s.trips.map((t) =>
              t.id === tripId
                ? tripEvent(
                    { ...t, status: t.status === "Dispatched" ? "In Transit" : t.status, stops: t.stops.map((st) => (st.id === stopId ? { ...st, status: "Completed", actualArrival: st.actualArrival ?? at, actualDeparture: at } : st)) },
                    `${stop.type === "Backhaul Pickup" ? "Backhaul loaded" : stop.type === "Warehouse" ? "Unloaded" : "Stop completed"} — ${stop.location.name}`,
                    at,
                  )
                : t,
            ),
            loads: s.loads.map((l) => (loaded.has(l.id) && l.leg === "return" ? { ...l, status: "In Transit" } : unloadedAtWarehouse.has(l.id) ? { ...l, status: "Delivered" } : l)),
            jobs: s.jobs.map((j) => (pickedJobs.has(j.id) && j.status === "Assigned" ? jobEvent({ ...j, status: "In Transit" }, `Picked up at ${stop.location.name}`, at) : j)),
          });
        },

        // ─── Deliveries & POD ─────────────────────────────────────────────
        markArrived: (deliveryId) => {
          const at = stamp();
          const s = get();
          const d = s.deliveries.find((x) => x.id === deliveryId);
          if (!d) return;
          set({
            deliveries: s.deliveries.map((x) => (x.id === deliveryId ? { ...x, status: "Arrived", arrivedAt: at } : x)),
            trips: s.trips.map((t) =>
              t.id === d.tripId ? { ...t, status: t.status === "Dispatched" ? "In Transit" : t.status, stops: t.stops.map((st) => (st.unloaded.some((id) => d.loadIds.includes(id)) && st.status === "Pending" ? { ...st, status: "Arrived", actualArrival: at } : st)) } : t,
            ),
          });
        },

        markDelivered: (deliveryId, podInput, cashCollected) => {
          const at = stamp();
          const s = get();
          const dl = s.deliveries.find((d) => d.id === deliveryId);
          if (!dl) return;
          const trip = s.trips.find((t) => t.id === dl.tripId)!;
          const driver = driverById(trip.driverId).name;
          const drNo = podInput.receiptNo || `DR-${String(maxNum(s.deliveries.map((d) => d.pod?.receiptNo ?? ""), /DR-(\d+)/) + 1).padStart(6, "0")}`;
          const pod: ProofOfDelivery = { ...podInput, receiptNo: drNo, signedAt: at };
          const loadIds = new Set(dl.loadIds);
          const deliveries = s.deliveries.map((d) => (d.id === deliveryId ? { ...d, status: "Delivered" as const, arrivedAt: d.arrivedAt ?? at, completedAt: at, pod } : d));
          const open = deliveries.filter((d) => d.tripId === trip.id && !DELIVERY_DONE.includes(d.status)).sort((a, b) => a.eta.localeCompare(b.eta));
          const nextDl = open[0];
          const stops = trip.stops.map((st) => {
            if (!st.unloaded.some((id) => loadIds.has(id))) return st;
            const stillOpen = deliveries.some((d) => d.tripId === trip.id && !DELIVERY_DONE.includes(d.status) && d.loadIds.some((id) => st.unloaded.includes(id)));
            return stillOpen ? { ...st, status: "Arrived" as const, actualArrival: st.actualArrival ?? at } : { ...st, status: "Completed" as const, actualArrival: st.actualArrival ?? at, actualDeparture: at };
          });
          const outboundLeft = open.some((d) => s.loads.some((l) => d.loadIds.includes(l.id) && l.leg === "outbound"));
          const nextStatus: TripStatus = !outboundLeft && ["Dispatched", "In Transit"].includes(trip.status) ? "Returning" : trip.status === "Dispatched" ? "In Transit" : trip.status;
          set({
            deliveries: deliveries.map((d) => (nextDl && d.id === nextDl.id && d.status === "Scheduled" ? { ...d, status: "In Transit" } : d)),
            trips: s.trips.map((t) => (t.id === trip.id ? (nextStatus !== trip.status && nextStatus === "Returning" ? tripEvent({ ...t, stops, status: nextStatus }, "All outbound drops done — returning to Lucena", at, undefined, driver) : { ...t, stops, status: nextStatus }) : t)),
            loads: s.loads.map((l) => (loadIds.has(l.id) ? { ...l, status: "Delivered" } : l)),
            jobs: s.jobs.map((j) =>
              j.id === dl.jobId ? jobEvent({ ...j, status: "Delivered", deliveredAt: at }, "Delivered — POD captured", at, `Received by ${pod.receivedBy} · ${drNo}${pod.photoCount ? ` · ${pod.photoCount} photo(s)` : ""}`, driver) : j,
            ),
          });
          if (cashCollected && cashCollected > 0) {
            const job = get().jobs.find((j) => j.id === dl.jobId)!;
            get().recordPayment({ invoiceId: invoiceIdForJob(job.id), jobId: job.id, customerId: job.customerId, amount: Math.min(cashCollected, jobTotal(job)), method: "COD", reference: "Cash collected by driver", notes: `Collected by ${driver}` });
          }
        },

        updatePod: (deliveryId, patch) => {
          stamp();
          set((s) => ({ deliveries: s.deliveries.map((d) => (d.id === deliveryId && d.pod ? { ...d, pod: { ...d.pod, ...patch } } : d)) }));
        },

        reportDeliveryIssue: (deliveryId, issue, failed) => {
          const at = stamp();
          const s = get();
          const dl = s.deliveries.find((d) => d.id === deliveryId);
          if (!dl) return;
          const c = s.customers.find((x) => x.id === dl.customerId);
          set({
            deliveries: s.deliveries.map((d) => (d.id === deliveryId ? { ...d, issues: [...d.issues, { ...issue, reportedAt: at, reportedBy: actor() }], status: failed ? "Failed" : d.status, failureReason: failed ? issue.note : d.failureReason } : d)),
            jobs: s.jobs.map((j) => (j.id === dl.jobId ? jobEvent(j, failed ? "Delivery failed — cargo returning to Lucena" : `Issue reported: ${issue.type}`, at, issue.note) : j)),
          });
          notify({ kind: "delivery", title: failed ? "Delivery failed" : `Delivery issue: ${issue.type}`, body: `${dl.jobId} · ${c?.name ?? ""} — ${issue.note}`, href: `/deliveries/${deliveryId}`, severity: failed ? "critical" : "warning", roles: ["owner", "dispatcher", "sales"] });
        },

        // ─── Finance ──────────────────────────────────────────────────────
        recordPayment: (input) => {
          const s = get();
          const date = stamp();
          const id = nextSeqId("PAY", yymmdd(date), s.payments);
          const receiptNo = `OR-${String(maxNum(s.payments.map((p) => p.receiptNo), /OR-(\d+)/) + 1).padStart(6, "0")}`;
          const payment: Payment = { ...input, id, receiptNo, date, recordedBy: actor() === "Joel Mendoza" ? "Grace Lontoc" : actor() };
          set((st) => ({
            payments: [...st.payments, payment],
            jobs: st.jobs.map((j) => (j.id === input.jobId ? jobEvent(j, `Payment received — ₱${input.amount.toLocaleString("en-PH")}`, date, `${input.method} · ${receiptNo}`, payment.recordedBy) : j)),
          }));
          return receiptNo;
        },

        addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: `EXP-${String(maxNum(s.expenses.map((x) => x.id), /EXP-(\d+)/) + 1).padStart(5, "0")}`, recordedBy: actor() }, ...s.expenses] })),

        // ─── Fleet ────────────────────────────────────────────────────────
        addFuelLog: (input) => {
          const s = get();
          const id = `FUEL-${String(maxNum(s.fuelLogs.map((f) => f.id), /FUEL-(\d+)/) + 1).padStart(4, "0")}`;
          const log: FuelLog = { ...input, id, totalCost: Math.round(input.liters * input.pricePerLiter) };
          set({ fuelLogs: [log, ...s.fuelLogs] });
          get().addExpense({ date: input.date.slice(0, 10), category: "Diesel", amount: log.totalCost, description: `${input.liters} L diesel @ ₱${input.pricePerLiter.toFixed(2)}/L${input.fullTank ? " (full tank)" : " (top-up)"}`, tripId: input.tripId, truckId: input.truckId, driverId: input.driverId, fuelLogId: id, paidTo: input.station, receiptRef: input.receiptRef });
          return id;
        },

        addMaintenance: (m) => {
          const s = get();
          const id = `MNT-${String(maxNum(s.maintenance.map((x) => x.id), /MNT-(\d+)/) + 1).padStart(3, "0")}`;
          set({ maintenance: [{ ...m, id }, ...s.maintenance] });
          if (m.status === "Scheduled") notify({ kind: "fleet", title: "Maintenance scheduled", body: `${truckById(m.truckId).code}: ${m.type} on ${m.date} (${m.vendor}).`, href: "/maintenance", severity: "info", roles: ["owner", "dispatcher"] });
          return id;
        },

        setMaintenanceStatus: (id, status, patch) => {
          stamp();
          set((s) => ({ maintenance: s.maintenance.map((m) => (m.id === id ? { ...m, ...patch, status } : m)) }));
        },

        renewDocument: (id, patch) => {
          stamp();
          set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch, notes: `Renewed ${TODAY}.` } : d)) }));
        },

        // ─── Load board ───────────────────────────────────────────────────
        postBoardLoad: (input) => {
          const at = stamp();
          const id = nextSeqId("FRT", yymmdd(at), get().boardLoads);
          set((s) => ({ boardLoads: [{ ...input, id, status: "Looking for Truck", createdAt: at, postedBy: actor() }, ...s.boardLoads] }));
          return id;
        },

        postCapacity: (input) => {
          const at = stamp();
          const id = nextSeqId("CAP", yymmdd(at), get().boardCapacity);
          const post: AvailableCapacity = { ...input, id, status: "Open", createdAt: at, postedBy: actor() };
          set((s) => ({ boardCapacity: [post, ...s.boardCapacity] }));
          return id;
        },

        addTruckingPartner: (input) => {
          const s = get();
          const id = `TP-${String(maxNum(s.truckingPartners.map((p) => p.id), /TP-(\d+)/) + 1).padStart(3, "0")}`;
          set({ truckingPartners: [...s.truckingPartners, { ...input, id, since: TODAY }] });
          return id;
        },

        setBoardLoadStatus: (id, status, reason) => {
          stamp();
          const s = get();
          const load = s.boardLoads.find((l) => l.id === id);
          if (!load || load.jobId) return;
          // Leaving a partner-truck reservation (other than confirming it) gives the space back.
          const release = load.status === "Reserved" && load.capacityId && status !== "Booked" && status !== "Reserved" ? load.capacityId : undefined;
          set({
            boardLoads: s.boardLoads.map((l) =>
              l.id === id ? { ...l, status, capacityId: release ? undefined : l.capacityId, bookedAt: release ? undefined : l.bookedAt, closedReason: status === "Looking for Truck" || status === "Matching" ? undefined : (reason ?? l.closedReason) } : l,
            ),
            boardCapacity: release ? s.boardCapacity.map((c) => (c.id === release && c.fleet === "external" ? { ...c, usedCapacityKg: Math.max(0, c.usedCapacityKg - load.weightKg) } : c)) : s.boardCapacity,
          });
        },

        setCapacityStatus: (id, status, reason) => {
          stamp();
          set((s) => ({ boardCapacity: s.boardCapacity.map((c) => (c.id === id ? { ...c, status, closedReason: reason ?? c.closedReason } : c)) }));
        },

        updateCapacityUsed: (id, usedKg) => {
          stamp();
          set((s) => ({ boardCapacity: s.boardCapacity.map((c) => (c.id === id && c.fleet === "external" ? { ...c, usedCapacityKg: Math.min(c.totalCapacityKg, Math.max(0, usedKg)) } : c)) }));
        },

        reserveOnPartnerTruck: (loadId, capacityId) => {
          const s = get();
          const load = s.boardLoads.find((l) => l.id === loadId);
          const cap = s.boardCapacity.find((c) => c.id === capacityId);
          if (!load || !cap || cap.fleet !== "external" || load.jobId || load.capacityId === capacityId) return;
          const at = stamp();
          set({
            boardLoads: s.boardLoads.map((l) => (l.id === loadId ? { ...l, status: "Reserved", capacityId, bookedAt: at } : l)),
            boardCapacity: s.boardCapacity.map((c) => (c.id === capacityId && c.fleet === "external" ? { ...c, usedCapacityKg: Math.min(c.totalCapacityKg, c.usedCapacityKg + load.weightKg) } : c)),
          });
        },

        bookBoardLoad: (input) => {
          const s = get();
          const load = s.boardLoads.find((l) => l.id === input.loadId);
          if (!load) return undefined;
          const cap = input.capacityId ? s.boardCapacity.find((c) => c.id === input.capacityId) : undefined;
          const tripId = cap?.fleet === "internal" ? cap.tripId : undefined;

          // Already booked: never create a second job or load — at most move it onto the trip.
          const existing = load.jobId ? s.jobs.find((j) => j.id === load.jobId) : undefined;
          if (existing && existing.status !== "Cancelled") {
            if (tripId && existing.tripId !== tripId) get().assignJobToTrip(existing.id, tripId);
            set((st) => ({ boardLoads: st.boardLoads.map((l) => (l.id === load.id ? { ...l, capacityId: cap?.id ?? l.capacityId } : l)) }));
            return { jobId: existing.id, created: false };
          }

          let customerId = input.customerId || load.customerId;
          if (!customerId) {
            const partner = load.partnerId ? s.truckingPartners.find((p) => p.id === load.partnerId) : undefined;
            customerId = addShipperCustomer({
              name: input.newCustomerName?.trim() || partner?.name || load.contact.name,
              contact: load.contact,
              place: load.pickup,
              addressLabel: "Pickup point",
              category: load.cargoCategory,
              paymentTerms: input.paymentTerms,
              leadSource: leadSourceFor(load.source),
              notes: `First booked through Load Board ${load.id} (${load.source}${load.sourceReference ? ` · ${load.sourceReference}` : ""}).`,
            });
          }

          const at = stamp();
          const { job, loads } = buildJob(
            {
              customerId,
              source: "Load Board",
              leg: bookingLeg(load, cap),
              pickup: load.pickup,
              dropoff: load.destination,
              consignee: input.consignee,
              cargo: [{ cargoDescription: load.cargoDescription, cargoCategory: load.cargoCategory, quantity: load.weightKg, unit: "kg", weightKg: load.weightKg, handlingNotes: load.specialHandling }],
              truckRequirement: truckRequirementFor(load),
              pickupAt: load.pickupAt,
              requiredBy: requiredByFor(load),
              freightCharge: input.freightCharge,
              additionalCharges: [],
              paymentTerms: input.paymentTerms,
              instructions: load.specialHandling,
              notes: load.notes,
              status: "Awaiting Dispatch",
              loadType: "Third-Party",
            },
            at,
          );
          job.history.push({ at, label: `Booked from Load Board ${load.id}`, by: actor(), note: `${load.source}${load.sourceReference ? ` · ${load.sourceReference}` : ""} · posted by ${load.contact.name}` });
          set((st) => ({
            jobs: [job, ...st.jobs],
            loads: [...loads, ...st.loads],
            boardLoads: st.boardLoads.map((l) => (l.id === load.id ? { ...l, customerId, jobId: job.id, capacityId: cap?.id, bookedAt: at } : l)),
          }));
          if (tripId) get().assignJobToTrip(job.id, tripId);
          const trip = tripId ? get().trips.find((t) => t.id === tripId) : undefined;
          notify({
            kind: "job",
            title: "Load Board booking",
            body: `${load.id} → ${job.id}: ${load.cargoDescription}, ${load.weightKg.toLocaleString("en-PH")} kg${trip ? ` on ${truckById(trip.truckId).code} (${trip.id})` : " — awaiting dispatch"}.`,
            href: `/jobs/${job.id}`,
            severity: "info",
            roles: ["owner", "dispatcher"],
          });
          return { jobId: job.id, created: true };
        },

        // ─── Backhaul marketplace (preview) ───────────────────────────────
        publishBackhaulListing: (input) => {
          const s = get();
          const trip = s.trips.find((t) => t.id === input.tripId);
          if (!trip || !legOpen(trip, "return")) return undefined;
          const at = stamp();
          // One listing per return leg: publishing again updates the terms and reopens it.
          const existing = s.backhaulListings.find((l) => l.tripId === input.tripId);
          if (existing) {
            set({ backhaulListings: s.backhaulListings.map((l) => (l.id === existing.id ? { ...l, ...input, status: "Published", publishedAt: l.status === "Published" ? l.publishedAt : at, publishedBy: l.status === "Published" ? l.publishedBy : actor() } : l)) });
            return existing.id;
          }
          const id = nextSeqId("BHL", yymmdd(at), s.backhaulListings);
          set({ backhaulListings: [{ ...input, id, status: "Published", publishedAt: at, publishedBy: actor() }, ...s.backhaulListings] });
          return id;
        },

        setBackhaulListingStatus: (id, status) => {
          stamp();
          set((s) => ({ backhaulListings: s.backhaulListings.map((l) => (l.id === id ? { ...l, status } : l)) }));
        },

        requestBackhaulSpace: (input) => {
          const s = get();
          const listing = s.backhaulListings.find((l) => l.id === input.listingId);
          const trip = listing ? s.trips.find((t) => t.id === listing.tripId) : undefined;
          if (!listing || !trip) return undefined;
          const space = returnSpace(trip.id);
          if (listingStatus(listing, trip, space) !== "Published" || input.weightKg <= 0 || input.weightKg > space) return undefined;
          const at = stamp();
          const id = nextSeqId("BKR", yymmdd(at), s.backhaulRequests);
          const request: BackhaulBookingRequest = { ...input, id, quotedFreight: marketplaceQuote(listing, input.weightKg), status: "Requested", createdAt: at };
          set((st) => ({ backhaulRequests: [request, ...st.backhaulRequests] }));
          notify({
            kind: "backhaul",
            title: "Backhaul space requested",
            body: `${input.shipper.businessName}: ${input.weightKg.toLocaleString("en-PH")} kg ${input.cargoDescription}, ${shortArea(input.pickup.areaId)} → ${shortArea(input.dropoff.areaId)} on ${truckById(trip.truckId).code}'s return (${trip.id}).`,
            href: `/future/backhaul-marketplace?tab=requests&q=${id}`,
            severity: "info",
            roles: ["owner", "dispatcher"],
          });
          return id;
        },

        confirmBackhaulRequest: (input) => {
          const s = get();
          const req = s.backhaulRequests.find((r) => r.id === input.requestId);
          if (!req) return undefined;
          // Already confirmed: never create a second job or load.
          if (req.jobId) return { jobId: req.jobId, created: false };
          if (req.status !== "Requested") return undefined;
          const listing = s.backhaulListings.find((l) => l.id === req.listingId);
          const trip = listing ? s.trips.find((t) => t.id === listing.tripId) : undefined;
          if (!listing || !trip || listing.status === "Closed" || !legOpen(trip, "return") || req.weightKg > returnSpace(trip.id)) return undefined;

          const customerId =
            input.customerId ||
            req.customerId ||
            addShipperCustomer({
              name: req.shipper.businessName,
              contact: { name: req.shipper.contactName, phone: req.shipper.phone },
              place: req.dropoff,
              addressLabel: "Receiving address",
              category: req.cargoCategory,
              paymentTerms: input.paymentTerms,
              leadSource: "Backhaul Marketplace",
              notes: `First booked through Backhaul Marketplace request ${req.id}.`,
            });

          const at = stamp();
          const { job, loads } = buildJob(
            {
              customerId,
              source: "Backhaul Marketplace",
              leg: "return",
              pickup: req.pickup,
              dropoff: req.dropoff,
              consignee: req.consignee ?? { name: req.shipper.contactName, phone: req.shipper.phone },
              cargo: [{ cargoDescription: req.cargoDescription, cargoCategory: req.cargoCategory, quantity: req.quantity, unit: req.unit, weightKg: req.weightKg }],
              truckRequirement: truckRequirementFor({ weightKg: req.weightKg, cargoCategory: req.cargoCategory, truckType: "Any Closed Van" }),
              pickupAt: req.readyAt,
              requiredBy: requiredByFor({ pickupAt: req.readyAt }),
              freightCharge: input.freightCharge,
              additionalCharges: [],
              paymentTerms: input.paymentTerms,
              notes: req.notes,
              status: "Awaiting Dispatch",
              loadType: "Third-Party",
            },
            at,
          );
          job.history.push({ at, label: `Booked from Backhaul Marketplace request ${req.id}`, by: actor(), note: `${req.shipper.businessName} · instant quote ₱${req.quotedFreight.toLocaleString("en-PH")}` });
          set((st) => ({
            jobs: [job, ...st.jobs],
            loads: [...loads, ...st.loads],
            backhaulRequests: st.backhaulRequests.map((r) => (r.id === req.id ? { ...r, customerId, status: "Confirmed", jobId: job.id, respondedAt: at, respondedBy: actor() } : r)),
          }));
          get().assignJobToTrip(job.id, trip.id);
          notify({
            kind: "job",
            title: "Marketplace booking confirmed",
            body: `${req.id} → ${job.id}: ${req.cargoDescription}, ${req.weightKg.toLocaleString("en-PH")} kg on ${truckById(trip.truckId).code}'s return leg (${trip.id}).`,
            href: `/jobs/${job.id}`,
            severity: "success",
            roles: ["owner", "dispatcher"],
          });
          return { jobId: job.id, created: true };
        },

        declineBackhaulRequest: (id, reason) => {
          const at = stamp();
          set((s) => ({ backhaulRequests: s.backhaulRequests.map((r) => (r.id === id && r.status === "Requested" && !r.jobId ? { ...r, status: "Declined", declineReason: reason, respondedAt: at, respondedBy: actor() } : r)) }));
        },

        markNotificationRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
        markAllNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

        // ─── Trading (Phase 2 preview) ────────────────────────────────────
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
          if (input.status === "Pending Confirmation") notify({ kind: "order", title: "Order needs confirmation", body: `Order ${id} (${customer.name}) needs confirmation.`, href: `/orders/${id}`, severity: "warning", roles: ["owner", "sales"] });
          return id;
        },

        updateOrder: (id, patch, event) => {
          const at = event ? stamp() : "";
          set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch, history: event ? [...o.history, { at, label: event.label, by: actor(), note: event.note }] : o.history } : o)) }));
        },

        setOrderStatus: (id, status, note) => {
          const at = stamp();
          set((s) => ({
            orders: s.orders.map((o) => {
              if (o.id !== id) return o;
              const label = status === "Confirmed" ? "Order confirmed" : status === "Delivered" ? (o.fulfillment === "pickup" ? "Picked up at bodega" : "Delivered") : `Status changed to ${status}`;
              return { ...o, status, deliveredAt: status === "Delivered" ? at : o.deliveredAt, history: [...o.history, { at, label, by: actor(), note }] };
            }),
          }));
        },

        cancelOrder: (id, reason) => {
          const at = stamp();
          set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: "Cancelled", cancelReason: reason, history: [...o.history, { at, label: "Order cancelled", by: actor(), note: reason }] } : o)) }));
        },

        recordSalesPayment: (input) => {
          const s = get();
          const date = stamp();
          const id = nextSeqId("SP", yymmdd(date), s.salesPayments);
          const receiptNo = `SR-${String(maxNum(s.salesPayments.map((p) => p.receiptNo), /SR-(\d+)/) + 1).padStart(6, "0")}`;
          const payment: SalesPayment = { ...input, id, receiptNo, date, recordedBy: actor() };
          set((st) => ({
            salesPayments: [...st.salesPayments, payment],
            orders: st.orders.map((o) => (o.id === input.orderId ? { ...o, history: [...o.history, { at: date, label: `Payment received — ₱${input.amount.toLocaleString("en-PH")}`, by: payment.recordedBy, note: `${input.method} · ${receiptNo}` }] } : o)),
          }));
          return receiptNo;
        },

        createPO: (input) => {
          const s = get();
          const id = nextSeqId("PO", yymmdd(TODAY), s.purchaseOrders);
          const sup = supplierById(input.supplierId);
          const po: PurchaseOrder = { id, supplierId: input.supplierId, items: input.items, status: input.status, createdAt: stamp(), pickupDate: input.pickupDate, pickupLocation: sup.pickupLocation, pickupAreaId: sup.pickupAreaId, createdBy: actor(), notes: input.notes };
          set({ purchaseOrders: [po, ...s.purchaseOrders] });
          return id;
        },

        setPOStatus: (id, status) => {
          const at = stamp();
          set((s) => ({
            purchaseOrders: s.purchaseOrders.map((p) =>
              p.id === id
                ? { ...p, status, pickedUpAt: status === "Picked Up" ? at : p.pickedUpAt, receivedAt: status === "Received" ? at : p.receivedAt, items: status === "Received" ? p.items.map((i) => ({ ...i, receivedQty: i.receivedQty ?? i.quantity })) : p.items }
                : p,
            ),
          }));
        },

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
          notify({ kind: "lead", title: "New quote request", body: `${q.businessName} requested a wholesale quote (${id}).`, href: "/orders", severity: "info", roles: ["owner", "sales"] });
          return id;
        },

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
      name: "tradeloop-logistics-demo-v3",
      version: 3,
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        removeItem: (name) => localStorage.removeItem(name),
        /** Demo sessions can run long enough to approach the localStorage quota; drop the oldest notifications and retry once rather than losing every later write. */
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed?.state?.notifications)) parsed.state.notifications = parsed.state.notifications.slice(0, 50);
              localStorage.setItem(name, JSON.stringify(parsed));
            } catch {
              // still over quota after trimming — skip this write, keep the in-memory state
            }
          }
        },
      })),
      skipHydration: true,
      partialize: (s) => ({
        role: s.role,
        tick: s.tick,
        customers: s.customers,
        leads: s.leads,
        quotes: s.quotes,
        jobs: s.jobs,
        loads: s.loads,
        trips: s.trips,
        deliveries: s.deliveries,
        payments: s.payments,
        expenses: s.expenses,
        fuelLogs: s.fuelLogs,
        maintenance: s.maintenance,
        documents: s.documents,
        notifications: s.notifications,
        truckingPartners: s.truckingPartners,
        boardLoads: s.boardLoads,
        boardCapacity: s.boardCapacity,
        backhaulListings: s.backhaulListings,
        backhaulRequests: s.backhaulRequests,
        orders: s.orders,
        purchaseOrders: s.purchaseOrders,
        salesPayments: s.salesPayments,
        standingOrders: s.standingOrders,
        quoteRequests: s.quoteRequests,
        cart: s.cart,
      }),
    },
  ),
);

/** Hydration flag lives outside the persisted store. */
export const useHydrated = create<{ hydrated: boolean; set: (v: boolean) => void }>((set) => ({ hydrated: false, set: (v) => set({ hydrated: v }) }));

