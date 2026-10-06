"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AvailableLoadStatus,
  BackhaulListing,
  BookBoardLoadInput,
  BookingResult,
  CapacityStatus,
  CartLine,
  ConfirmBackhaulRequestInput,
  DeliveryIssueInput,
  DocumentRenewalInput,
  JobStatus,
  LeadStage,
  MaintenanceStatus,
  MaintenanceUpdateInput,
  ManualTripStatus,
  NewBackhaulRequestInput,
  NewBoardLoadInput,
  NewCapacityInput,
  NewCompanyLoadInput,
  NewCustomerInput,
  NewExpenseInput,
  NewFuelLogInput,
  NewJobInput,
  NewLeadInput,
  NewMaintenanceInput,
  NewOrderInput,
  NewPartnerInput,
  NewPaymentInput,
  NewPOInput,
  NewQuoteInput,
  NewQuoteRequestInput,
  NewSalesPaymentInput,
  NewTripInput,
  OpsCommandResponse,
  OpsData,
  OpsSnapshot,
  OpsViewer,
  OrderEditInput,
  OrderStatus,
  PodInput,
  POStatus,
  ProductStock,
  ProofOfDelivery,
  PublicStorefront,
  PublishListingInput,
  QuoteStatus,
  Role,
  StandingOrder,
  StandingOrderInput,
  TripCloseInput,
} from "@/types";
import { NOW, setClock } from "@/data/company";
import { applyTenantProfile } from "@/data/tenant";
import { api, errorMessage } from "@/lib/api/client";
import { applyOpsChanges, emptyOpsData, OPS_COLLECTIONS } from "@/lib/ops-data";

/** Customer the portal shows when office staff preview it (customers see their own account). */
export const DEMO_PORTAL_CUSTOMER_ID = "CUS-022";
/** Organization whose public pages (storefront, Return trips) this site serves. */
export const PUBLIC_ORG = process.env.NEXT_PUBLIC_OPS_ORG ?? "LUCENA-FRESH";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

interface StoreState extends OpsData {
  status: LoadStatus;
  loadError?: string;
  version: number;
  viewer: OpsViewer | null;
  /** Role the app is shown as: the viewer's own, or a desk an owner is previewing. */
  role: Role;
  /** Owner's "view as" choice, remembered on this device. */
  viewAs: Role | null;
  /** Product availability from the public storefront (when the full stock records aren't loaded). */
  storefrontStock: ProductStock[] | null;
  cart: CartLine[];
}

interface Actions {
  /** Fetch the organization's data (whole snapshot). */
  load: () => Promise<void>;
  /** Refetch when another user or tab changed the data. */
  sync: () => Promise<void>;
  /** Drop everything on sign-out. */
  clear: () => void;
  loadStorefront: () => Promise<void>;
  setRole: (role: Role) => void;
  /** Current operations time. */
  now: () => string;
  resetDemo: () => Promise<void>;
  // Sales & CRM
  createQuote: (input: NewQuoteInput) => Promise<string>;
  setQuoteStatus: (id: string, status: QuoteStatus, reason?: string) => Promise<void>;
  convertQuoteToJob: (quoteId: string) => Promise<string>;
  moveLead: (id: string, stage: LeadStage, note?: string) => Promise<void>;
  addLead: (lead: NewLeadInput) => Promise<string>;
  convertLead: (id: string) => Promise<string>;
  addCustomer: (c: NewCustomerInput) => Promise<string>;
  // Jobs & cargo
  createJob: (input: NewJobInput) => Promise<string>;
  setJobStatus: (id: string, status: Extract<JobStatus, "Quoted" | "Confirmed" | "Awaiting Dispatch">, note?: string) => Promise<void>;
  cancelJob: (id: string, reason: string) => Promise<void>;
  assignJobToTrip: (jobId: string, tripId: string | null) => Promise<void>;
  createCompanyLoad: (input: NewCompanyLoadInput) => Promise<string>;
  assignLoadToTrip: (loadId: string, tripId: string | null) => Promise<void>;
  // Trips
  createTrip: (input: NewTripInput) => Promise<string>;
  setTripStatus: (tripId: string, status: ManualTripStatus) => Promise<void>;
  completeTrip: (tripId: string, close: TripCloseInput) => Promise<void>;
  markStopArrived: (tripId: string, stopId: string) => Promise<void>;
  completeStop: (tripId: string, stopId: string) => Promise<void>;
  // Deliveries & POD
  markArrived: (deliveryId: string) => Promise<void>;
  markDelivered: (deliveryId: string, pod: PodInput, cashCollected?: number) => Promise<void>;
  updatePod: (deliveryId: string, patch: Partial<ProofOfDelivery>) => Promise<void>;
  reportDeliveryIssue: (deliveryId: string, issue: DeliveryIssueInput, failed?: boolean) => Promise<void>;
  // Finance
  recordPayment: (input: NewPaymentInput) => Promise<string>;
  addExpense: (e: NewExpenseInput) => Promise<string>;
  // Fleet
  addFuelLog: (input: NewFuelLogInput) => Promise<string>;
  addMaintenance: (m: NewMaintenanceInput) => Promise<string>;
  setMaintenanceStatus: (id: string, status: MaintenanceStatus, patch?: MaintenanceUpdateInput) => Promise<void>;
  renewDocument: (id: string, patch: DocumentRenewalInput) => Promise<void>;
  // Load board
  postBoardLoad: (input: NewBoardLoadInput) => Promise<string>;
  postCapacity: (input: NewCapacityInput) => Promise<string>;
  addTruckingPartner: (input: NewPartnerInput) => Promise<string>;
  setBoardLoadStatus: (id: string, status: AvailableLoadStatus, reason?: string) => Promise<void>;
  setCapacityStatus: (id: string, status: CapacityStatus, reason?: string) => Promise<void>;
  updateCapacityUsed: (id: string, usedKg: number) => Promise<void>;
  reserveOnPartnerTruck: (loadId: string, capacityId: string) => Promise<void>;
  bookBoardLoad: (input: BookBoardLoadInput) => Promise<BookingResult>;
  // Backhaul marketplace (preview)
  publishBackhaulListing: (input: PublishListingInput) => Promise<string>;
  setBackhaulListingStatus: (id: string, status: BackhaulListing["status"]) => Promise<void>;
  requestBackhaulSpace: (input: NewBackhaulRequestInput) => Promise<string>;
  confirmBackhaulRequest: (input: ConfirmBackhaulRequestInput) => Promise<BookingResult>;
  declineBackhaulRequest: (id: string, reason: string) => Promise<void>;
  // Notifications
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  // Trading (Phase 2 preview)
  createOrder: (input: NewOrderInput) => Promise<string>;
  updateOrder: (id: string, patch: OrderEditInput, event?: { label: string; note?: string }) => Promise<void>;
  setOrderStatus: (id: string, status: OrderStatus, note?: string) => Promise<void>;
  cancelOrder: (id: string, reason: string) => Promise<void>;
  recordSalesPayment: (input: NewSalesPaymentInput) => Promise<string>;
  createPO: (input: NewPOInput) => Promise<string>;
  setPOStatus: (id: string, status: POStatus) => Promise<void>;
  setStandingOrderStatus: (id: string, status: StandingOrder["status"]) => Promise<void>;
  saveStandingOrder: (so: StandingOrderInput) => Promise<string>;
  addQuoteRequest: (q: NewQuoteRequestInput) => Promise<string>;
  // Cart (this device only)
  addToCart: (productId: string, quantity: number) => void;
  setCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
}

const dataOf = (s: OpsData): OpsData => Object.fromEntries(OPS_COLLECTIONS.map((c) => [c, s[c]])) as unknown as OpsData;
const roleFor = (viewer: OpsViewer, viewAs: Role | null): Role => (viewer.canViewAs && viewAs ? viewAs : viewer.role);
const enc = encodeURIComponent;

export const useAppStore = create<StoreState & Actions>()(
  persist(
    (set, get) => {
      /** Run a command on the API and apply the records it changed. */
      const command = async <R,>(method: "POST" | "PUT" | "PATCH", path: string, body?: unknown): Promise<R> => {
        const before = get().version;
        const res = await api<OpsCommandResponse<R>>(`/ops${path}`, { method, body: body ?? {} });
        set((s) => ({ ...applyOpsChanges(dataOf(s), res.changes), version: res.version }));
        setClock(res.now);
        // Someone else changed the data in between: catch up with their changes too.
        if (res.version > before + 1) void get().sync();
        return res.result;
      };
      const post = <R = void,>(path: string, body?: unknown) => command<R>("POST", path, body);

      const applySnapshot = (snap: OpsSnapshot) => {
        applyTenantProfile(snap.profile);
        setClock(snap.now);
        set({ ...snap.data, version: snap.version, viewer: snap.viewer, role: roleFor(snap.viewer, get().viewAs), status: "ready", loadError: undefined });
      };

      return {
        ...emptyOpsData(),
        status: "idle",
        version: 0,
        viewer: null,
        role: "owner",
        viewAs: null,
        storefrontStock: null,
        cart: [],

        load: async () => {
          set({ status: "loading", loadError: undefined });
          try {
            applySnapshot(await api<OpsSnapshot>("/ops/snapshot"));
          } catch (e) {
            set({ status: "error", loadError: errorMessage(e) });
          }
        },

        sync: async () => {
          if (get().status !== "ready") return;
          try {
            const { version } = await api<{ version: number }>("/ops/version");
            if (version !== get().version) applySnapshot(await api<OpsSnapshot>("/ops/snapshot"));
          } catch {
            // Offline for a moment — the next poll catches up.
          }
        },

        clear: () => set({ ...emptyOpsData(), status: "idle", version: 0, viewer: null, role: "owner" }),

        loadStorefront: async () => {
          try {
            const sf = await api<PublicStorefront>(`/public/ops/${enc(PUBLIC_ORG)}`, { auth: false });
            if (!get().viewer) applyTenantProfile(sf.profile);
            set({ storefrontStock: sf.stock });
          } catch {
            // The storefront still works without live availability.
          }
        },

        setRole: (role) => {
          const viewer = get().viewer;
          if (!viewer?.canViewAs) return;
          set({ viewAs: role === viewer.role ? null : role, role });
        },

        now: () => NOW,

        resetDemo: async () => applySnapshot(await api<OpsSnapshot>("/ops/demo/reset", { method: "POST" })),

        // ─── Sales & CRM ──────────────────────────────────────────────────
        createQuote: (input) => post("/quotes", input),
        setQuoteStatus: (id, status, reason) => post(`/quotes/${enc(id)}/status`, { status, reason }),
        convertQuoteToJob: (id) => post(`/quotes/${enc(id)}/convert`),
        moveLead: (id, stage, note) => post(`/leads/${enc(id)}/stage`, { stage, note }),
        addLead: (lead) => post("/leads", lead),
        convertLead: (id) => post(`/leads/${enc(id)}/convert`),
        addCustomer: (c) => post("/customers", c),

        // ─── Jobs & cargo ─────────────────────────────────────────────────
        createJob: (input) => post("/jobs", input),
        setJobStatus: (id, status, note) => post(`/jobs/${enc(id)}/status`, { status, note }),
        cancelJob: (id, reason) => post(`/jobs/${enc(id)}/cancel`, { reason }),
        assignJobToTrip: (jobId, tripId) => post(`/jobs/${enc(jobId)}/assign`, { tripId }),
        createCompanyLoad: (input) => post("/loads", input),
        assignLoadToTrip: (loadId, tripId) => post(`/loads/${enc(loadId)}/assign`, { tripId }),

        // ─── Trips ────────────────────────────────────────────────────────
        createTrip: (input) => post("/trips", input),
        setTripStatus: (tripId, status) => post(`/trips/${enc(tripId)}/status`, { status }),
        completeTrip: (tripId, close) => post(`/trips/${enc(tripId)}/complete`, close),
        markStopArrived: (tripId, stopId) => post(`/trips/${enc(tripId)}/stops/${enc(stopId)}/arrive`),
        completeStop: (tripId, stopId) => post(`/trips/${enc(tripId)}/stops/${enc(stopId)}/complete`),

        // ─── Deliveries & POD ─────────────────────────────────────────────
        markArrived: (id) => post(`/deliveries/${enc(id)}/arrive`),
        markDelivered: (id, pod, cashCollected) => post(`/deliveries/${enc(id)}/deliver`, { pod, cashCollected }),
        updatePod: (id, patch) => command("PATCH", `/deliveries/${enc(id)}/pod`, patch),
        reportDeliveryIssue: (id, issue, failed) => post(`/deliveries/${enc(id)}/issues`, { ...issue, failed }),

        // ─── Finance ──────────────────────────────────────────────────────
        recordPayment: (input) => post("/payments", input),
        addExpense: (e) => post("/expenses", e),

        // ─── Fleet ────────────────────────────────────────────────────────
        addFuelLog: (input) => post("/fuel-logs", input),
        addMaintenance: (m) => post("/maintenance", m),
        setMaintenanceStatus: (id, status, patch) => post(`/maintenance/${enc(id)}/status`, { status, patch }),
        renewDocument: (id, patch) => post(`/documents/${enc(id)}/renew`, patch),

        // ─── Load board ───────────────────────────────────────────────────
        postBoardLoad: (input) => post("/board/loads", input),
        postCapacity: (input) => post(`/board/capacity/${input.fleet}`, input),
        addTruckingPartner: (input) => post("/board/partners", input),
        setBoardLoadStatus: (id, status, reason) => post(`/board/loads/${enc(id)}/status`, { status, reason }),
        setCapacityStatus: (id, status, reason) => post(`/board/capacity/${enc(id)}/status`, { status, reason }),
        updateCapacityUsed: (id, usedKg) => post(`/board/capacity/${enc(id)}/used`, { usedKg }),
        reserveOnPartnerTruck: (loadId, capacityId) => post(`/board/loads/${enc(loadId)}/reserve`, { capacityId }),
        bookBoardLoad: ({ loadId, ...input }) => post(`/board/loads/${enc(loadId)}/book`, input),

        // ─── Backhaul marketplace (preview) ───────────────────────────────
        publishBackhaulListing: (input) => post("/backhaul/listings", input),
        setBackhaulListingStatus: (id, status) => post(`/backhaul/listings/${enc(id)}/status`, { status }),
        requestBackhaulSpace: (input) => post("/backhaul/requests", input),
        confirmBackhaulRequest: ({ requestId, ...input }) => post(`/backhaul/requests/${enc(requestId)}/confirm`, input),
        declineBackhaulRequest: (id, reason) => post(`/backhaul/requests/${enc(id)}/decline`, { reason }),

        // ─── Notifications ────────────────────────────────────────────────
        markNotificationRead: (id) => post(`/notifications/${enc(id)}/read`),
        markAllNotificationsRead: () => post("/notifications/read-all"),

        // ─── Trading (Phase 2 preview) ────────────────────────────────────
        createOrder: (input) => post("/orders", input),
        updateOrder: (id, patch, event) => command("PATCH", `/orders/${enc(id)}`, { patch, event }),
        setOrderStatus: (id, status, note) => post(`/orders/${enc(id)}/status`, { status, note }),
        cancelOrder: (id, reason) => post(`/orders/${enc(id)}/cancel`, { reason }),
        recordSalesPayment: (input) => post("/sales-payments", input),
        createPO: (input) => post("/purchase-orders", input),
        setPOStatus: (id, status) => post(`/purchase-orders/${enc(id)}/status`, { status }),
        setStandingOrderStatus: (id, status) => post(`/standing-orders/${enc(id)}/status`, { status }),
        saveStandingOrder: (so) => command("PUT", "/standing-orders", so),
        addQuoteRequest: (q) => post("/quote-requests", q),

        // ─── Cart ─────────────────────────────────────────────────────────
        addToCart: (productId, quantity) =>
          set((s) => {
            const existing = s.cart.find((l) => l.productId === productId);
            return { cart: existing ? s.cart.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l)) : [...s.cart, { productId, quantity }] };
          }),
        setCartQty: (productId, quantity) => set((s) => ({ cart: s.cart.map((l) => (l.productId === productId ? { ...l, quantity } : l)) })),
        removeFromCart: (productId) => set((s) => ({ cart: s.cart.filter((l) => l.productId !== productId) })),
        clearCart: () => set({ cart: [] }),
      };
    },
    {
      // Only per-device preferences are kept in the browser; the records live on the API.
      name: "tradeloop-ui-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ cart: s.cart, viewAs: s.viewAs }),
    },
  ),
);

/** True once the organization's data has loaded (screens show skeletons until then). */
export const useHydrated = <T,>(select: (s: { hydrated: boolean }) => T): T => useAppStore((s) => select({ hydrated: s.status === "ready" }));

/** Customer account the portal shows: a customer's own, or the demo account when staff preview it. Null when signed out. */
export const usePortalCustomerId = (): string | null =>
  useAppStore((s) => (!s.viewer ? null : s.viewer.role === "customer" ? s.viewer.subjectRef : DEMO_PORTAL_CUSTOMER_ID));
