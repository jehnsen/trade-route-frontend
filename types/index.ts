// TradeLoop domain types. Dates are stored as local ISO strings:
// "YYYY-MM-DD" for dates and "YYYY-MM-DDTHH:mm" for date-times.
//
// Phase 1 is a logistics operations system: Quote → Job → Load → Trip → Delivery → POD →
// Invoice → Payment, plus fleet records. The product-trading types (Order, PurchaseOrder,
// InventoryBatch, SalesInvoice…) back the secondary "Trading" module and are independent
// of trips and cargo.

export type ISODate = string;
export type ISODateTime = string;

// ─── Roles ──────────────────────────────────────────────────────────────────
export type Role =
  | "owner"
  | "sales"
  | "dispatcher"
  | "procurement"
  | "warehouse"
  | "accounting"
  | "driver"
  | "customer";

// ─── Geography ──────────────────────────────────────────────────────────────
export type Region = "Quezon Province" | "Metro Manila" | "Cavite" | "Laguna" | "Batangas" | "Visayas" | "Mindanao";

export type AreaId =
  | "lucena"
  | "sariaya"
  | "tayabas"
  | "pagbilao"
  | "candelaria"
  | "navotas"
  | "valenzuela"
  | "caloocan"
  | "quezon-city"
  | "manila"
  | "pasay"
  | "paranaque"
  | "las-pinas"
  | "bacoor"
  | "imus"
  | "dasmarinas"
  | "general-trias"
  | "calamba"
  | "santa-rosa"
  | "batangas-city"
  | "cebu"
  | "iloilo"
  | "bacolod"
  | "davao"
  | "cagayan-de-oro"
  | "general-santos";

export interface Area {
  id: AreaId;
  name: string;
  province: string;
  region: Region;
  /** Road distance from the Lucena Main Warehouse, one way. 0 for inter-island. */
  distanceKm: number;
  /** Typical drive time from Lucena in minutes (early-morning traffic). */
  driveMinutes: number;
  interIsland?: boolean;
}

export interface Address {
  line1: string;
  barangay: string;
  city: string;
  province: string;
  areaId: AreaId;
  landmark?: string;
}

/** A pickup, drop-off or stop location. */
export interface Place {
  name: string;
  areaId: AreaId;
  address?: string;
}

// ─── People ─────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  title: string;
  phone: string;
  initials: string;
}

// ─── Customers ──────────────────────────────────────────────────────────────
export type CustomerType =
  | "Palengke Vendor"
  | "Restaurant"
  | "Hotel"
  | "Resort"
  | "Seafood Dealer"
  | "Distributor"
  | "Retailer"
  | "Grocery"
  | "Catering Company"
  | "Agri Trader"
  | "Cooperative"
  | "General Merchandise";

export type PaymentTerms = "COD" | "Credit 7 Days" | "Credit 15 Days" | "Credit 30 Days" | "50% Down, Balance on Arrival";
export type CustomerStatus = "active" | "new" | "on-hold" | "inactive";
export type LeadSource =
  | "Facebook Marketplace"
  | "Facebook Group"
  | "Facebook Page"
  | "Messenger"
  | "Referral"
  | "Walk-in"
  | "Existing Customer Referral";
export type Fulfillment = "truck" | "pickup" | "partner";
export type PaymentBehavior = "prompt" | "average" | "slow" | "delinquent";

export interface ContactPerson {
  name: string;
  position: string;
  phone: string;
  email?: string;
  primary?: boolean;
}

export interface DeliveryAddress extends Address {
  id: string;
  label: string;
  receivingHours: string;
  default?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  areaId: AreaId;
  contacts: ContactPerson[];
  addresses: DeliveryAddress[];
  paymentTerms: PaymentTerms;
  creditLimit: number;
  salespersonId: string;
  leadSource: LeadSource;
  customerSince: ISODate;
  /** Trading module: products usually bought. Logistics customers leave this empty. */
  preferredProductIds: string[];
  fulfillment: Fulfillment;
  status: CustomerStatus;
  notes: string;
  deliveryFee: number;
  /** Used by the demo data generators to shape payment history. */
  paymentBehavior: PaymentBehavior;
  /** Relative booking frequency weight for the generators (1–10). */
  frequency: number;
  tin?: string;
}

// ─── Fleet ──────────────────────────────────────────────────────────────────
export type TruckStatus = "Available" | "Assigned" | "Loading" | "On Trip" | "Maintenance" | "Out of Service";

export interface Truck {
  id: string;
  code: string;
  name: string;
  make: string;
  model: string;
  vehicleType: string;
  body: string;
  plateNo: string;
  year: number;
  /** Configured operational payload used for load planning (not a manufacturer rating). */
  capacityKg: number;
  cargoVolumeCbm: number;
  /** Last recorded odometer reading (trip start/end or fuel log). */
  mileageKm: number;
  /** Planning figure used to estimate diesel before a fill-up is logged. */
  fuelEfficiencyKmPerL: number;
  primaryDriverId: string;
  /** Set when the owner parks the truck (major repair, franchise issue). */
  outOfService?: boolean;
  color: string;
}

export interface DriverUnavailability {
  from: ISODate;
  to: ISODate;
  reason: string;
}

export interface Driver {
  id: string;
  name: string;
  initials: string;
  phone: string;
  /** Fictional, masked license number. */
  licenseNo: string;
  licenseExpiry: ISODate;
  licenseRestrictions: string;
  assignedTruckId: string;
  hiredDate: ISODate;
  address: string;
  emergencyContact: string;
  unavailable: DriverUnavailability[];
}

export interface Helper {
  id: string;
  name: string;
  phone: string;
}

export type MaintenanceType =
  | "Preventive Maintenance"
  | "Oil Change"
  | "Tire Replacement"
  | "Brake Service"
  | "Engine Repair"
  | "Electrical"
  | "Aircon"
  | "Body Repair"
  | "Other";
export type MaintenanceStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled";

export interface MaintenanceRecord {
  id: string;
  truckId: string;
  type: MaintenanceType;
  /** Odometer at service (or planned odometer for scheduled work). */
  odometerKm: number;
  date: ISODate;
  vendor: string;
  cost: number;
  notes: string;
  nextServiceDate?: ISODate;
  nextServiceKm?: number;
  status: MaintenanceStatus;
  downtimeHours?: number;
}

export interface FuelLog {
  id: string;
  truckId: string;
  tripId?: string;
  driverId: string;
  date: ISODateTime;
  odometerKm: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  station: string;
  areaId: AreaId;
  /** Full-tank fill-ups allow a full-to-full fuel efficiency calculation. */
  fullTank: boolean;
  receiptRef?: string;
}

export type VehicleDocumentType =
  | "OR/CR"
  | "LTO Registration"
  | "Comprehensive Insurance"
  | "CTPL Insurance"
  | "Emission Test"
  | "LTFRB Franchise (CPC)"
  | "Fish Port Gate Pass"
  | "Driver's License"
  | "NBI Clearance"
  | "Drug Test";

export interface VehicleDocument {
  id: string;
  type: VehicleDocumentType;
  truckId?: string;
  driverId?: string;
  /** Fictional reference, masked where it would be sensitive. */
  reference: string;
  issuer: string;
  issueDate: ISODate;
  expiryDate: ISODate;
  attachment?: string;
  notes?: string;
}

// ─── Sales & CRM ────────────────────────────────────────────────────────────
export type LeadStage = "New" | "Contacted" | "Quoted" | "Sample Order" | "Negotiating" | "Won" | "Lost";

export interface LeadActivity {
  at: ISODateTime;
  note: string;
  by: string;
}

export interface Lead {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  source: LeadSource;
  location: string;
  areaId?: AreaId;
  businessType: CustomerType;
  /** What they need hauled, e.g. "Sugpo & tahong, iced". */
  cargoInterest: string;
  /** Typical lane, e.g. "Lucena → Imus". */
  lane: string;
  potentialVolume: string;
  /** Estimated monthly freight revenue. */
  potentialMonthlyValue: number;
  stage: LeadStage;
  ownerId: string;
  createdAt: ISODate;
  lastContactAt: ISODate;
  nextStep?: string;
  lostReason?: string;
  convertedCustomerId?: string;
  activities: LeadActivity[];
}

export type CargoCategory = "Seafood" | "Shellfish" | "Produce" | "Dry Goods" | "General Cargo";
export type TruckRequirement = "Shared van (LTL)" | "Full truck — 10-wheeler" | "Insulated van, iced cargo";

export interface Charge {
  label: string;
  amount: number;
}

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";

export interface FreightQuote {
  id: string;
  customerId?: string;
  leadId?: string;
  pickup: Place;
  dropoff: Place;
  cargoDescription: string;
  cargoCategory: CargoCategory;
  weightKg: number;
  volumeCbm?: number;
  truckRequirement: TruckRequirement;
  pickupDate: ISODate;
  requiredDate: ISODate;
  freightCharge: number;
  additionalCharges: Charge[];
  notes?: string;
  validUntil: ISODate;
  status: QuoteStatus;
  createdAt: ISODateTime;
  createdBy: string;
  sentAt?: ISODateTime;
  respondedAt?: ISODateTime;
  rejectReason?: string;
  jobId?: string;
}

// ─── Logistics jobs & cargo ─────────────────────────────────────────────────
export type JobStatus =
  | "Inquiry"
  | "Quoted"
  | "Confirmed"
  | "Awaiting Dispatch"
  | "Assigned"
  | "In Transit"
  | "Delivered"
  | "Completed"
  | "Cancelled";

export type JobSource = "Phone" | "Messenger" | "Facebook" | "Sales Staff" | "Repeat Customer" | "Referral" | "Customer Portal";

/** Outbound = leaves Lucena; Return = hauled on a return (backhaul) leg toward Quezon. */
export type Leg = "outbound" | "return";

export interface JobEvent {
  at: ISODateTime;
  label: string;
  by: string;
  note?: string;
}

export interface LogisticsJob {
  id: string;
  customerId: string;
  source: JobSource;
  quoteId?: string;
  leg: Leg;
  pickup: Place;
  dropoff: Place;
  /** Receiving contact at drop-off (may differ from the booking customer). */
  consignee: { name: string; phone: string };
  cargoDescription: string;
  cargoCategory: CargoCategory;
  weightKg: number;
  volumeCbm?: number;
  truckRequirement: TruckRequirement;
  pickupAt: ISODateTime;
  requiredBy: ISODateTime;
  freightCharge: number;
  additionalCharges: Charge[];
  paymentTerms: PaymentTerms;
  status: JobStatus;
  tripId?: string;
  salespersonId: string;
  instructions?: string;
  notes?: string;
  createdAt: ISODateTime;
  /** When the consignee received the cargo (POD). Drives invoice issue date. */
  deliveredAt?: ISODateTime;
  history: JobEvent[];
  cancelReason?: string;
}

export type LoadType = "Outbound" | "Backhaul" | "Third-Party" | "Company-Owned";
export type LoadStatus = "Pending" | "Assigned" | "Loaded" | "In Transit" | "Delivered" | "Cancelled";

export interface Load {
  id: string;
  jobId?: string;
  /** Booking customer; empty for company-owned cargo. */
  customerId?: string;
  type: LoadType;
  leg: Leg;
  cargoDescription: string;
  cargoCategory: CargoCategory;
  quantity: number;
  unit: string;
  weightKg: number;
  pickup: Place;
  destination: Place;
  tripId?: string;
  status: LoadStatus;
  handlingNotes?: string;
  /** Company-owned cargo only: purchase value, for backhaul value reporting (not freight revenue). */
  estimatedValue?: number;
  createdAt: ISODateTime;
}

// ─── Trips ──────────────────────────────────────────────────────────────────
export type TripStatus = "Planned" | "Loading" | "Ready" | "Dispatched" | "In Transit" | "Returning" | "Completed" | "Cancelled";

export interface RouteTemplate {
  id: string;
  name: string;
  outboundAreas: AreaId[];
  returnAreas: AreaId[];
  roundTripKm: number;
  tollFee: number;
  departure: string;
  expectedReturn: string;
}

export type StopType = "Pickup" | "Delivery" | "Backhaul Pickup" | "Fuel" | "Port" | "Warehouse" | "Other";
export type StopStatus = "Pending" | "Arrived" | "Completed" | "Skipped";

export interface TripStop {
  id: string;
  seq: number;
  type: StopType;
  location: Place;
  customerId?: string;
  contactName?: string;
  contactPhone?: string;
  plannedArrival: ISODateTime;
  actualArrival?: ISODateTime;
  plannedDeparture: ISODateTime;
  actualDeparture?: ISODateTime;
  loaded: string[];
  unloaded: string[];
  status: StopStatus;
  notes?: string;
}

export interface TripEvent {
  at: ISODateTime;
  label: string;
  by: string;
  note?: string;
}

export interface Trip {
  id: string;
  date: ISODate;
  truckId: string;
  driverId: string;
  helperIds: string[];
  routeId: string;
  status: TripStatus;
  departure: ISODateTime;
  actualDeparture?: ISODateTime;
  expectedReturn: ISODateTime;
  actualReturn?: ISODateTime;
  odometerStart?: number;
  odometerEnd?: number;
  stops: TripStop[];
  notes?: string;
  history: TripEvent[];
}

// ─── Deliveries ─────────────────────────────────────────────────────────────
export type DeliveryStatus = "Scheduled" | "Loading" | "Ready" | "In Transit" | "Arrived" | "Delivered" | "Failed" | "Returned";

export interface ProofOfDelivery {
  receivedBy: string;
  signedAt: ISODateTime;
  /** Delivery receipt number written on the DR. */
  receiptNo: string;
  signatureCaptured: boolean;
  photoCount: number;
  driverNotes?: string;
  customerRemarks?: string;
  shortKg?: number;
  damagedKg?: number;
}

export type DeliveryIssueType = "Damaged Cargo" | "Short Quantity" | "Late Arrival" | "Consignee Unavailable" | "Rejected by Consignee" | "Road / Access Problem" | "Vehicle Problem" | "Other";

export interface DeliveryIssue {
  type: DeliveryIssueType;
  note: string;
  reportedAt: ISODateTime;
  reportedBy: string;
}

export interface Delivery {
  id: string;
  jobId: string;
  tripId: string;
  customerId: string;
  loadIds: string[];
  status: DeliveryStatus;
  eta: ISODateTime;
  arrivedAt?: ISODateTime;
  completedAt?: ISODateTime;
  pod?: ProofOfDelivery;
  issues: DeliveryIssue[];
  failureReason?: string;
}

// ─── Finance (freight billing) ──────────────────────────────────────────────
export type PaymentMethod = "Cash" | "Bank Transfer" | "GCash" | "Maya" | "Check" | "COD";

export interface Payment {
  id: string;
  receiptNo: string;
  customerId: string;
  invoiceId: string;
  jobId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  date: ISODateTime;
  recordedBy: string;
  notes?: string;
}

/** Freight billing — one invoice per delivered job. Derived from jobs + payments. */
export interface Invoice {
  id: string;
  jobId: string;
  customerId: string;
  tripId?: string;
  issueDate: ISODate;
  dueDate: ISODate;
  total: number;
  paid: number;
  balance: number;
  daysOverdue: number;
  status: "Paid" | "Current" | "Overdue" | "Partial";
}

export type PaymentStatus = "Unpaid" | "Partial" | "Paid" | "Credit";

export type ExpenseCategory =
  | "Diesel"
  | "Toll"
  | "Driver Allowance"
  | "Helper Allowance"
  | "Meals"
  | "Parking"
  | "Loading Fee"
  | "Unloading Fee"
  | "Port Fee"
  | "Repair"
  | "Other";

export interface Expense {
  id: string;
  date: ISODate;
  category: ExpenseCategory;
  amount: number;
  description: string;
  tripId?: string;
  truckId?: string;
  driverId?: string;
  fuelLogId?: string;
  paidTo: string;
  recordedBy: string;
  receiptRef?: string;
}

// ─── Notifications ──────────────────────────────────────────────────────────
export type NotificationKind = "job" | "trip" | "delivery" | "finance" | "fleet" | "backhaul" | "lead" | "order";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: ISODateTime;
  href: string;
  severity: "info" | "success" | "warning" | "critical";
  read: boolean;
  roles: Role[];
}

// ═══ Trading module (Phase 2 preview) ════════════════════════════════════════
// Product sales, procurement and stock. Independent of trips and cargo.

export type ProductCategory = "seafood" | "produce";
export type ProductUnit = "kg" | "pc";
export type ProductStatus = "active" | "low-stock" | "seasonal" | "inactive";
/** Outbound = sourced in Quezon and sold in Manila. Backhaul = bought in Manila/CALABARZON. */
export type ProductFlow = "outbound" | "backhaul";

export interface Product {
  id: string;
  sku: string;
  slug: string;
  name: string;
  localName?: string;
  variant?: string;
  category: ProductCategory;
  subcategory: string;
  unit: ProductUnit;
  /** Weight per unit in kg (1 for kg-based items). */
  unitWeightKg: number;
  /** Multiplier for gross weight: ice, styro boxes, banyera, sacks. */
  loadFactor: number;
  cost: number;
  wholesalePrice: number;
  sellingPrice: number;
  moq: number;
  bulkThreshold: number;
  origin: string;
  flow: ProductFlow;
  grade: string;
  description: string;
  packaging: string[];
  storage: string;
  shelfLifeDays: number;
  status: ProductStatus;
  icon: "shrimp" | "shell" | "fish" | "crab" | "squid" | "onion" | "garlic" | "ginger" | "tomato" | "potato" | "carrot" | "cabbage" | "citrus" | "coconut" | "banana" | "chili" | "sweet-potato";
}

export interface StandingOrderLine {
  productId: string;
  quantity: number;
}

export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";

export interface StandingOrder {
  id: string;
  customerId: string;
  day: Weekday;
  lines: StandingOrderLine[];
  status: "active" | "paused" | "cancelled";
  startDate: ISODate;
  notes?: string;
}

export type SupplierType = "Seafood Source" | "Farm Supplier" | "Agricultural Trader" | "Wholesale Market" | "Distributor";

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  address: Address;
  /** Where goods are collected (may differ from office address). */
  pickupLocation: string;
  pickupAreaId: AreaId;
  contactPerson: string;
  phone: string;
  productIds: string[];
  paymentTerms: "Cash on Pickup" | "GCash on Pickup" | "Credit 7 Days" | "Credit 15 Days";
  reliability: number;
  /** Extra km off the regular truck route. */
  detourKm: number;
  status: "active" | "preferred" | "inactive";
  since: ISODate;
  notes: string;
}

export interface SupplierQuote {
  id: string;
  supplierId: string;
  productId: string;
  availableQty: number;
  quotedPrice: number;
  quotedAt: ISODateTime;
  validUntil: ISODate;
}

export type OrderSource =
  | "Customer Portal"
  | "Facebook Messenger"
  | "Phone"
  | "Facebook Lead"
  | "Salesperson"
  | "Repeat Order";

export type OrderStatus =
  | "Draft"
  | "Pending Confirmation"
  | "Confirmed"
  | "Preparing"
  | "Ready for Dispatch"
  | "Out for Delivery"
  | "Delivered"
  | "Partially Delivered"
  | "Cancelled";

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  /** Quantity actually delivered (for partial deliveries). */
  deliveredQty?: number;
}

export interface OrderEvent {
  at: ISODateTime;
  label: string;
  by: string;
  note?: string;
}

/** Trading sales order (product sale). Fulfilment runs through a logistics job in the live system. */
export interface Order {
  id: string;
  customerId: string;
  source: OrderSource;
  items: OrderItem[];
  discount: number;
  deliveryFee: number;
  status: OrderStatus;
  paymentTerms: PaymentTerms;
  addressId: string;
  createdAt: ISODateTime;
  deliveryDate: ISODate;
  /** Customer's requested receiving window, e.g. "Before 8:00 AM". */
  deliveryWindow?: string;
  fulfillment: Fulfillment;
  salespersonId: string;
  notes?: string;
  history: OrderEvent[];
  cancelReason?: string;
  /** When goods were received by the customer (or handed to the sea-freight partner). */
  deliveredAt?: ISODateTime;
}

export type POStatus =
  | "Draft"
  | "Sent"
  | "Confirmed"
  | "Ready for Pickup"
  | "Picked Up"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface POItem {
  productId: string;
  quantity: number;
  unitCost: number;
  receivedQty?: number;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: POItem[];
  status: POStatus;
  createdAt: ISODateTime;
  pickupDate: ISODate;
  pickupLocation: string;
  pickupAreaId: AreaId;
  deliveredBySupplier?: boolean;
  pickupEta?: ISODateTime;
  pickedUpAt?: ISODateTime;
  receivedAt?: ISODateTime;
  createdBy: string;
  notes?: string;
}

export type InventoryLocation =
  | "Lucena Main Warehouse"
  | "Truck 01"
  | "Truck 02"
  | "Temporary Manila Pickup"
  | "Supplier Pickup";

export interface InventoryBatch {
  id: string;
  productId: string;
  location: InventoryLocation;
  source: string;
  supplierId?: string;
  poId?: string;
  receivedAt: ISODateTime;
  onHand: number;
  damaged: number;
  unitCost: number;
  note?: string;
}

export type SalesPaymentMethod = "Cash" | "GCash" | "Maya" | "Bank Transfer" | "Check" | "COD" | "Credit Settlement";

export interface SalesPayment {
  id: string;
  receiptNo: string;
  customerId: string;
  invoiceId: string;
  orderId: string;
  amount: number;
  method: SalesPaymentMethod;
  reference: string;
  date: ISODateTime;
  recordedBy: string;
  notes?: string;
}

export interface SalesInvoice {
  id: string;
  orderId: string;
  customerId: string;
  issueDate: ISODate;
  dueDate: ISODate;
  total: number;
  paid: number;
  balance: number;
  daysOverdue: number;
  status: "Paid" | "Current" | "Overdue" | "Partial";
}

export interface QuoteRequest {
  id: string;
  businessName: string;
  contactName: string;
  phone: string;
  businessType: CustomerType;
  productId: string;
  quantity: number;
  unit: string;
  frequency: string;
  deliveryArea: string;
  preferredDate: ISODate;
  notes?: string;
  status: "Submitted" | "Under Review" | "Quoted" | "Accepted" | "Declined";
  quotedPrice?: number;
  createdAt: ISODateTime;
  customerId?: string;
}

export interface CartLine {
  productId: string;
  quantity: number;
}
