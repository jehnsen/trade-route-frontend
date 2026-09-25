// FreshRoute domain types. Dates are stored as local ISO strings:
// "YYYY-MM-DD" for dates and "YYYY-MM-DDTHH:mm" for date-times.

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

// ─── Products ───────────────────────────────────────────────────────────────
export type ProductCategory = "seafood" | "produce";
export type ProductUnit = "kg" | "pc";
export type ProductStatus = "active" | "low-stock" | "seasonal" | "inactive";
/** Outbound = sourced in Quezon and hauled to Manila. Backhaul = bought in Manila/CALABARZON on the return leg. */
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
  /** Multiplier for truck load weight: ice, styro boxes, banyera, sacks. */
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
  | "Catering Company";

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
  preferredProductIds: string[];
  fulfillment: Fulfillment;
  status: CustomerStatus;
  notes: string;
  deliveryFee: number;
  /** Used by the demo data generator to shape payment history. */
  paymentBehavior: PaymentBehavior;
  /** Relative ordering frequency weight for the generator (1–10). */
  frequency: number;
  tin?: string;
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

// ─── Suppliers ──────────────────────────────────────────────────────────────
export type SupplierType = "Seafood Source" | "Farm Supplier" | "Agricultural Trader" | "Wholesale Market" | "Distributor";

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  address: Address;
  /** Where our trucks pick up (may differ from office address). */
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

// ─── Fleet ──────────────────────────────────────────────────────────────────
export type TruckStatus = "Available" | "Loading" | "On Trip" | "Maintenance";

export interface MaintenanceRecord {
  id: string;
  truckId: string;
  date: ISODate;
  type: "Preventive Maintenance" | "Repair" | "Tires" | "Registration" | "Inspection";
  description: string;
  shop: string;
  cost: number;
  odometerKm: number;
  downtimeHours: number;
}

export interface Truck {
  id: string;
  code: string;
  name: string;
  make: string;
  model: string;
  body: string;
  plateNo: string;
  year: number;
  capacityKg: number;
  cargoVolumeCbm: number;
  mileageKm: number;
  fuelEfficiencyKmPerL: number;
  primaryDriverId: string;
  nextMaintenanceKm: number;
  nextMaintenanceDate: ISODate;
  registrationExpiry: ISODate;
  insuranceExpiry: ISODate;
  color: string;
}

export interface Driver {
  id: string;
  name: string;
  initials: string;
  phone: string;
  licenseNo: string;
  licenseExpiry: ISODate;
  licenseRestrictions: string;
  assignedTruckId: string;
  hiredDate: ISODate;
  address: string;
  emergencyContact: string;
  status: "On Trip" | "Available" | "Rest Day" | "On Leave";
}

export interface Helper {
  id: string;
  name: string;
  phone: string;
}

// ─── Orders ─────────────────────────────────────────────────────────────────
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

export type PaymentStatus = "Unpaid" | "Partial" | "Paid" | "Credit";

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
  tripId?: string;
  salespersonId: string;
  notes?: string;
  history: OrderEvent[];
  cancelReason?: string;
  /** When goods were received by the customer (or handed to the sea-freight partner). */
  deliveredAt?: ISODateTime;
}

// ─── Deliveries ─────────────────────────────────────────────────────────────
export type DeliveryStatus = "Scheduled" | "Loading" | "Ready" | "In Transit" | "Arrived" | "Delivered" | "Failed" | "Returned";

export interface ProofOfDelivery {
  receivedBy: string;
  signedAt: ISODateTime;
  photoCount: number;
  remarks?: string;
}

export interface Delivery {
  id: string;
  orderId: string;
  tripId: string;
  stopSeq: number;
  status: DeliveryStatus;
  eta: ISODateTime;
  arrivedAt?: ISODateTime;
  completedAt?: ISODateTime;
  pod?: ProofOfDelivery;
  failureReason?: string;
}

// ─── Trips ──────────────────────────────────────────────────────────────────
export type TripStatus = "Planned" | "Loading" | "In Transit" | "Returning" | "Completed" | "Cancelled";

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

export interface TripStop {
  seq: number;
  type: "depart" | "delivery" | "pickup" | "arrive";
  areaId: AreaId;
  label: string;
  orderId?: string;
  poId?: string;
  eta: ISODateTime;
  actual?: ISODateTime;
  status: "done" | "current" | "pending" | "skipped";
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
  notes?: string;
}

// ─── Procurement ────────────────────────────────────────────────────────────
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
  /** Return trip that hauls this PO back to Lucena. Undefined for supplier-delivered POs. */
  tripId?: string;
  deliveredBySupplier?: boolean;
  pickupEta?: ISODateTime;
  pickedUpAt?: ISODateTime;
  receivedAt?: ISODateTime;
  createdBy: string;
  notes?: string;
}

// ─── Inventory ──────────────────────────────────────────────────────────────
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

// ─── Finance ────────────────────────────────────────────────────────────────
export type PaymentMethod = "Cash" | "GCash" | "Maya" | "Bank Transfer" | "Check" | "COD" | "Credit Settlement";

export interface Payment {
  id: string;
  receiptNo: string;
  customerId: string;
  invoiceId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  date: ISODateTime;
  recordedBy: string;
  notes?: string;
}

export interface Invoice {
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

export type ExpenseCategory =
  | "Diesel"
  | "Toll"
  | "Driver Allowance"
  | "Helper Allowance"
  | "Meals"
  | "Parking"
  | "Loading Fee"
  | "Unloading Fee"
  | "Ice"
  | "Packaging"
  | "Maintenance"
  | "Repairs"
  | "Port / Shipping Fee"
  | "Miscellaneous";

export interface Expense {
  id: string;
  date: ISODate;
  category: ExpenseCategory;
  amount: number;
  description: string;
  tripId?: string;
  truckId?: string;
  orderId?: string;
  paidTo: string;
  recordedBy: string;
  receiptRef?: string;
}

// ─── CRM ────────────────────────────────────────────────────────────────────
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
  interestedProductIds: string[];
  potentialVolume: string;
  potentialWeeklyValue: number;
  stage: LeadStage;
  ownerId: string;
  createdAt: ISODate;
  lastContactAt: ISODate;
  nextStep?: string;
  lostReason?: string;
  convertedCustomerId?: string;
  activities: LeadActivity[];
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

// ─── Notifications ──────────────────────────────────────────────────────────
export type NotificationKind = "order" | "trip" | "finance" | "inventory" | "backhaul" | "procurement" | "lead";

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

// ─── Portal ─────────────────────────────────────────────────────────────────
export interface CartLine {
  productId: string;
  quantity: number;
}
