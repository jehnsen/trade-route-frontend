import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Gauge,
  HandCoins,
  LayoutDashboard,
  Megaphone,
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
  Kanban,
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
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badgeKey?: "pendingOrders" | "overdue" | "unassigned" | "newLeads";
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["owner", "sales", "dispatcher", "procurement", "warehouse", "accounting"];

export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/command-center", label: "Command Center", icon: Gauge, roles: ["owner", "dispatcher"] },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
    ],
  },
  {
    label: "Sales & CRM",
    items: [
      { href: "/orders", label: "Orders", icon: ShoppingCart, roles: ["owner", "sales", "dispatcher", "warehouse", "accounting"], badgeKey: "pendingOrders" },
      { href: "/customers", label: "Customers", icon: Users, roles: ["owner", "sales", "accounting"] },
      { href: "/leads", label: "Leads & Facebook", icon: Megaphone, roles: ["owner", "sales"], badgeKey: "newLeads" },
    ],
  },
  {
    label: "Logistics",
    items: [
      { href: "/dispatch", label: "Dispatch Board", icon: Kanban, roles: ["owner", "dispatcher", "warehouse"], badgeKey: "unassigned" },
      { href: "/trips", label: "Trips", icon: Route, roles: ["owner", "dispatcher", "procurement", "accounting"] },
      { href: "/deliveries", label: "Deliveries", icon: Truck, roles: ["owner", "dispatcher", "sales", "warehouse"] },
      { href: "/backhaul", label: "Backhaul", icon: Undo2, roles: ["owner", "dispatcher", "procurement"] },
    ],
  },
  {
    label: "Stock & Purchasing",
    items: [
      { href: "/catalog", label: "Products", icon: PackageSearch, roles: ["owner", "sales", "procurement", "warehouse"] },
      { href: "/inventory", label: "Inventory", icon: Warehouse, roles: ["owner", "sales", "dispatcher", "procurement", "warehouse"] },
      { href: "/procurement", label: "Procurement", icon: ClipboardList, roles: ["owner", "procurement"] },
      { href: "/purchase-orders", label: "Purchase Orders", icon: Receipt, roles: ["owner", "procurement", "warehouse", "accounting"] },
      { href: "/suppliers", label: "Suppliers", icon: Store, roles: ["owner", "procurement", "accounting"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/accounts-receivable", label: "Receivables", icon: HandCoins, roles: ["owner", "accounting", "sales"], badgeKey: "overdue" },
      { href: "/payments", label: "Payments", icon: CreditCard, roles: ["owner", "accounting"] },
      { href: "/expenses", label: "Expenses", icon: Wallet, roles: ["owner", "accounting", "dispatcher"] },
    ],
  },
  {
    label: "Fleet",
    items: [
      { href: "/trucks", label: "Trucks", icon: Container, roles: ["owner", "dispatcher", "accounting"] },
      { href: "/drivers", label: "Drivers", icon: UserRound, roles: ["owner", "dispatcher"] },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, roles: ["owner", "sales", "accounting", "procurement"] },
      { href: "/settings", label: "Settings", icon: Settings, roles: ALL },
    ],
  },
];

export interface FutureModule {
  slug: string;
  label: string;
  icon: LucideIcon;
  summary: string;
  bullets: string[];
}

export const FUTURE_MODULES: FutureModule[] = [
  { slug: "marketplace", label: "Marketplace", icon: Store, summary: "Let verified buyers across Luzon browse and order from multiple Quezon suppliers through one storefront.", bullets: ["Multi-supplier listings with verified sellers", "Escrow-style payment release on delivery", "Buyer ratings and dispute handling"] },
  { slug: "supplier-bidding", label: "Supplier Bidding", icon: Gavel, summary: "Post tomorrow's backhaul requirements and let suppliers bid on price and pickup time.", bullets: ["Daily RFQs to Valenzuela, Divisoria and Laguna suppliers", "Auto-rank bids by landed cost incl. detour", "One-click conversion of winning bids to POs"] },
  { slug: "backhaul-marketplace", label: "Backhaul Marketplace", icon: Waypoints, summary: "Sell unused return capacity on Manila → Lucena legs to other traders and shippers.", bullets: ["Publish open kg per return leg", "Instant quotes for third-party cargo", "Separate manifests and waybills"] },
  { slug: "live-gps", label: "Live GPS", icon: Satellite, summary: "Real-time truck location and automatic ETAs to customers via SMS/Messenger.", bullets: ["GPS device or driver-phone tracking", "Geofenced arrival and departure events", "Customer ETA links"] },
  { slug: "temperature-monitoring", label: "Temperature Monitoring", icon: Thermometer, summary: "Cold-chain sensors inside the closed vans to protect sugpo and shellfish quality.", bullets: ["In-van temperature and door-open alerts", "Per-trip cold-chain report attached to DR", "Spoilage root-cause analysis"] },
  { slug: "route-optimization", label: "Route Optimization", icon: Route, summary: "Suggest the best drop sequence considering truck bans, market hours and traffic.", bullets: ["MMDA truck-ban aware sequencing", "Receiving-window constraints per customer", "Fuel and toll cost estimates"] },
  { slug: "ai-demand-forecasting", label: "AI Demand Forecasting", icon: Brain, summary: "Forecast next week's demand per customer and product using order history and seasonality.", bullets: ["Holiday and fiesta seasonality", "Standing-order drift detection", "Suggested procurement quantities"] },
  { slug: "price-intelligence", label: "Price Intelligence", icon: LineChart, summary: "Track supplier quotes and selling prices over time to protect margins.", bullets: ["Supplier price history per product", "Margin alerts when costs spike", "Suggested selling-price bands"] },
  { slug: "inter-island-logistics", label: "Inter-Island Logistics", icon: Ship, summary: "Manage reefer bookings, vessel schedules and waybills for Visayas and Mindanao buyers.", bullets: ["Partner reefer booking and tracking", "Port charges and landed-cost calculator", "Consignee arrival confirmation"] },
  { slug: "api-integrations", label: "API Integrations", icon: Plug, summary: "Connect FreshRoute to accounting software, GCash/Maya collections and Messenger.", bullets: ["Accounting export (sales & AR)", "E-wallet payment matching", "Messenger order capture"] },
];

export const ROLE_META: Record<Role, { label: string; description: string; home: string; icon: LucideIcon }> = {
  owner: { label: "Owner", description: "Rodel Samonte · full access", home: "/command-center", icon: Sparkles },
  sales: { label: "Sales", description: "Kristine Ramos · orders & customers", home: "/orders", icon: ShoppingCart },
  dispatcher: { label: "Dispatcher", description: "Noel Pascual · trucks & trips", home: "/dispatch", icon: Kanban },
  procurement: { label: "Procurement", description: "Edwin Manalo · buying & backhaul", home: "/procurement", icon: ClipboardList },
  warehouse: { label: "Warehouse", description: "Bong Esguerra · bodega & loading", home: "/inventory", icon: Boxes },
  accounting: { label: "Accounting", description: "Grace Lontoc · collections", home: "/accounts-receivable", icon: HandCoins },
  driver: { label: "Driver", description: "Joel Mendoza · Truck 01", home: "/driver", icon: Truck },
  customer: { label: "Customer", description: "Seaside Grill Bacoor · portal", home: "/my-orders", icon: Store },
};

export function canAccess(role: Role, pathname: string) {
  if (role === "owner") return true;
  for (const s of NAV) for (const i of s.items) if (pathname === i.href || pathname.startsWith(i.href + "/")) return i.roles.includes(role);
  return true;
}
