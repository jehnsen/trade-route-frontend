import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  Fuel,
  Gauge,
  HandCoins,
  Kanban,
  LayoutDashboard,
  Megaphone,
  PackageCheck,
  PackageSearch,
  Receipt,
  Route,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Undo2,
  UserRound,
  Users,
  Warehouse,
  Wallet,
  Wrench,
  Sparkles,
  Satellite,
  Thermometer,
  Brain,
  LineChart,
  Ship,
  Plug,
  Gavel,
  Container,
  Waypoints,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export type NavBadgeKey = "awaitingDispatch" | "overdue" | "newLeads" | "openQuotes" | "maintenanceDue" | "docsExpiring" | "deliveryIssues" | "openBoardLoads";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badgeKey?: NavBadgeKey;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["owner", "sales", "dispatcher", "procurement", "warehouse", "accounting"];

/** Phase 1 — logistics operations. */
export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/command-center", label: "Command Center", icon: Gauge, roles: ["owner", "dispatcher", "accounting"] },
      { href: "/workflow", label: "How It Works", icon: Workflow, roles: ALL },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { href: "/leads", label: "Leads", icon: Megaphone, roles: ["owner", "sales"], badgeKey: "newLeads" },
      { href: "/customers", label: "Customers", icon: Users, roles: ["owner", "sales", "accounting", "dispatcher"] },
      { href: "/quotes", label: "Quotes", icon: FileText, roles: ["owner", "sales"], badgeKey: "openQuotes" },
      { href: "/jobs", label: "Logistics Jobs", icon: ClipboardList, roles: ["owner", "sales", "dispatcher", "accounting"] },
    ],
  },
  {
    label: "Logistics",
    items: [
      { href: "/dispatch", label: "Dispatch", icon: Kanban, roles: ["owner", "dispatcher", "warehouse"], badgeKey: "awaitingDispatch" },
      { href: "/trips", label: "Trips", icon: Route, roles: ["owner", "dispatcher", "warehouse", "accounting", "procurement"] },
      { href: "/deliveries", label: "Deliveries", icon: PackageCheck, roles: ["owner", "dispatcher", "sales", "warehouse"], badgeKey: "deliveryIssues" },
      { href: "/loads", label: "Loads / Cargo", icon: Boxes, roles: ["owner", "dispatcher", "warehouse", "procurement"] },
      { href: "/backhaul", label: "Backhaul", icon: Undo2, roles: ["owner", "dispatcher", "procurement"] },
      { href: "/load-board", label: "Load Board", icon: ArrowLeftRight, roles: ["owner", "dispatcher", "sales", "procurement"], badgeKey: "openBoardLoads" },
    ],
  },
  {
    label: "Fleet",
    items: [
      { href: "/trucks", label: "Trucks", icon: Container, roles: ["owner", "dispatcher", "accounting"] },
      { href: "/drivers", label: "Drivers", icon: UserRound, roles: ["owner", "dispatcher"] },
      { href: "/maintenance", label: "Maintenance", icon: Wrench, roles: ["owner", "dispatcher", "accounting"], badgeKey: "maintenanceDue" },
      { href: "/fuel-logs", label: "Fuel Logs", icon: Fuel, roles: ["owner", "dispatcher", "accounting"] },
      { href: "/documents", label: "Vehicle Documents", icon: FileCheck2, roles: ["owner", "dispatcher", "accounting"], badgeKey: "docsExpiring" },
    ],
  },
  {
    label: "Finance & Costs",
    items: [
      { href: "/accounts-receivable", label: "Receivables", icon: HandCoins, roles: ["owner", "accounting", "sales"], badgeKey: "overdue" },
      { href: "/payments", label: "Payments", icon: CreditCard, roles: ["owner", "accounting"] },
      { href: "/expenses", label: "Trip Expenses", icon: Wallet, roles: ["owner", "accounting", "dispatcher"] },
    ],
  },
  {
    label: "Analytics",
    items: [{ href: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "accounting", "sales", "dispatcher"] }],
  },
  {
    label: "Administration",
    items: [{ href: "/settings", label: "Settings", icon: Settings, roles: ALL }],
  },
];

/**
 * Trading module (Phase 2 preview). Product sales, stock and purchasing are kept working but
 * are not part of the Phase 1 logistics workflow and never feed trips or cargo.
 */
export const TRADING_NAV: NavItem[] = [
  { href: "/orders", label: "Sales Orders", icon: ShoppingCart, roles: ["owner", "sales", "accounting"] },
  { href: "/dashboard", label: "Trading Dashboard", icon: LayoutDashboard, roles: ["owner", "sales"] },
  { href: "/catalog", label: "Products", icon: PackageSearch, roles: ["owner", "sales", "procurement", "warehouse"] },
  { href: "/inventory", label: "Inventory", icon: Warehouse, roles: ["owner", "procurement", "warehouse"] },
  { href: "/procurement", label: "Procurement", icon: ClipboardList, roles: ["owner", "procurement"] },
  { href: "/purchase-orders", label: "Purchase Orders", icon: Receipt, roles: ["owner", "procurement", "accounting"] },
  { href: "/suppliers", label: "Suppliers", icon: Store, roles: ["owner", "procurement", "accounting"] },
];

export interface FutureModule {
  slug: string;
  label: string;
  icon: LucideIcon;
  summary: string;
  bullets: string[];
  /** Has a working preview page at /future/<slug> instead of the roadmap card. */
  preview?: boolean;
}

export const FUTURE_MODULES: FutureModule[] = [
  { slug: "marketplace", label: "Marketplace", icon: Store, summary: "Let verified buyers across Luzon browse and order from multiple Quezon suppliers through one storefront.", bullets: ["Multi-supplier listings with verified sellers", "Escrow-style payment release on delivery", "Buyer ratings and dispute handling"] },
  { slug: "supplier-bidding", label: "Supplier Bidding", icon: Gavel, summary: "Post tomorrow's backhaul requirements and let suppliers bid on price and pickup time.", bullets: ["Daily RFQs to Valenzuela, Divisoria and Laguna suppliers", "Rank bids by landed cost incl. detour", "One-click conversion of winning bids to POs"] },
  { slug: "backhaul-marketplace", label: "Backhaul Marketplace", icon: Waypoints, summary: "Publish unused return capacity on Manila → Lucena legs for other traders and shippers to book.", bullets: ["Publish open kg per return leg", "Instant quotes for third-party cargo", "Separate manifests and waybills"], preview: true },
  { slug: "live-gps", label: "Live GPS", icon: Satellite, summary: "Real-time truck location and automatic ETAs to customers via SMS/Messenger. Today, location comes from the latest stop update.", bullets: ["GPS device or driver-phone tracking", "Geofenced arrival and departure events", "Customer ETA links"] },
  { slug: "temperature-monitoring", label: "Temperature Monitoring", icon: Thermometer, summary: "Cold-chain sensors inside the closed vans to protect sugpo and shellfish quality.", bullets: ["In-van temperature and door-open alerts", "Per-trip cold-chain report attached to the DR", "Spoilage root-cause analysis"] },
  { slug: "route-optimization", label: "Route Optimization", icon: Route, summary: "Suggest the best drop sequence considering truck bans, market hours and traffic.", bullets: ["MMDA truck-ban aware sequencing", "Receiving-window constraints per customer", "Fuel and toll cost estimates"] },
  { slug: "ai-demand-forecasting", label: "AI Demand Forecasting", icon: Brain, summary: "Forecast next week's bookings per lane using job history and seasonality.", bullets: ["Holiday and fiesta seasonality", "Repeat-booking drift detection", "Suggested truck schedules"] },
  { slug: "price-intelligence", label: "Price Intelligence", icon: LineChart, summary: "Track freight rates and diesel prices over time to protect trip margins.", bullets: ["Rate history per lane", "Margin alerts when diesel spikes", "Suggested rate bands"] },
  { slug: "inter-island-logistics", label: "Inter-Island Logistics", icon: Ship, summary: "Manage reefer bookings, vessel schedules and waybills for Visayas and Mindanao consignees.", bullets: ["Partner reefer booking and tracking", "Port charges and landed-cost calculator", "Consignee arrival confirmation"] },
  { slug: "api-integrations", label: "API Integrations", icon: Plug, summary: "Connect TradeLoop to accounting software, GCash/Maya collections and Messenger.", bullets: ["Accounting export (freight billing & AR)", "E-wallet payment matching", "Messenger booking capture"] },
];

export const ROLE_META: Record<Role, { label: string; description: string; home: string; icon: LucideIcon }> = {
  owner: { label: "Owner", description: "Full access", home: "/command-center", icon: Sparkles },
  sales: { label: "Sales", description: "Quotes, jobs & customers", home: "/jobs", icon: ClipboardList },
  dispatcher: { label: "Dispatcher", description: "Trucks, trips & drivers", home: "/dispatch", icon: Kanban },
  procurement: { label: "Procurement", description: "Backhaul cargo", home: "/backhaul", icon: Undo2 },
  warehouse: { label: "Warehouse", description: "Loading & cargo", home: "/loads", icon: Boxes },
  accounting: { label: "Accounting", description: "Billing & collections", home: "/accounts-receivable", icon: HandCoins },
  driver: { label: "Driver", description: "Driver app: trip, stops & POD", home: "/driver", icon: Truck },
  customer: { label: "Customer", description: "Customer portal", home: "/my-orders", icon: Store },
};

const ALL_ITEMS = [...NAV.flatMap((s) => s.items), ...TRADING_NAV];

export function canAccess(role: Role, pathname: string) {
  if (role === "owner") return true;
  for (const i of ALL_ITEMS) if (pathname === i.href || pathname.startsWith(i.href + "/")) return i.roles.includes(role);
  return true;
}

/** Internal routes the role switcher may keep the user on. */
export const INTERNAL_PREFIXES = [...ALL_ITEMS.map((i) => i.href), "/notifications", "/future"];
