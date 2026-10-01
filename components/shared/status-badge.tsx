import type { ComponentProps } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bookmark,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  CornerUpLeft,
  FileText,
  Handshake,
  Loader,
  MapPin,
  PackageCheck,
  PackageOpen,
  Pause,
  Radio,
  Inbox,
  Search,
  Send,
  Timer,
  Truck,
  Wrench,
  XCircle,
  Ban,
  UserCheck,
} from "lucide-react";
import type { LoadType, Leg } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = NonNullable<ComponentProps<typeof Badge>["variant"]>;
type Spec = [Variant, React.ComponentType<{ className?: string }>?];

const MAP: Record<string, Spec> = {
  // Jobs
  Inquiry: ["muted", CircleDashed],
  Quoted: ["warning", FileText],
  Confirmed: ["success", CheckCircle2],
  "Awaiting Dispatch": ["warning", Timer],
  Assigned: ["info", UserCheck],
  "In Transit": ["teal", Truck],
  Delivered: ["success", CheckCircle2],
  Completed: ["success", CheckCircle2],
  Cancelled: ["danger", XCircle],
  // Loads & stops
  Pending: ["muted", Clock],
  Loaded: ["teal", PackageCheck],
  Skipped: ["muted", Ban],
  // Trips
  Planned: ["muted", CircleDashed],
  Loading: ["warning", Loader],
  Ready: ["teal", PackageCheck],
  Dispatched: ["teal", Truck],
  Returning: ["teal", CornerUpLeft],
  // Deliveries
  Scheduled: ["info", Clock],
  Arrived: ["teal", MapPin],
  Failed: ["danger", XCircle],
  Returned: ["danger", CornerUpLeft],
  // Payment / invoices
  Unpaid: ["danger"],
  Partial: ["warning"],
  Paid: ["success"],
  Credit: ["info"],
  Current: ["info"],
  Overdue: ["danger", AlertTriangle],
  // Quotes
  Draft: ["muted", FileText],
  Sent: ["info", Send],
  Accepted: ["success", Handshake],
  Rejected: ["danger", XCircle],
  Expired: ["muted", CalendarClock],
  // Fleet / people / documents / maintenance
  Available: ["success", CircleDot],
  "On Trip": ["info", Truck],
  Maintenance: ["warning", Wrench],
  "Out of Service": ["danger", Ban],
  "Rest Day": ["muted"],
  "On Leave": ["muted"],
  Valid: ["success", CheckCircle2],
  "Expiring Soon": ["warning", AlertTriangle],
  "In Progress": ["warning", Wrench],
  // Leads
  New: ["info"],
  Contacted: ["teal"],
  "Sample Order": ["teal"],
  Negotiating: ["warning"],
  Won: ["success", CheckCircle2],
  Lost: ["danger", XCircle],
  // Trading orders & POs
  "Pending Confirmation": ["info", Clock],
  Preparing: ["teal", PackageOpen],
  "Ready for Dispatch": ["teal", PackageCheck],
  "Out for Delivery": ["teal", Truck],
  "Partially Delivered": ["warning", AlertTriangle],
  "Ready for Pickup": ["teal", PackageCheck],
  "Picked Up": ["info", Truck],
  "Partially Received": ["warning", AlertTriangle],
  Received: ["success", CheckCircle2],
  Submitted: ["info"],
  "Under Review": ["warning"],
  Declined: ["muted"],
  // Load board
  "Looking for Truck": ["warning", Search],
  Matching: ["info", Handshake],
  Reserved: ["teal", Bookmark],
  Booked: ["success", CheckCircle2],
  Open: ["success", CircleDot],
  "Partially Filled": ["info", Truck],
  Full: ["muted", PackageCheck],
  Departed: ["muted", Truck],
  "Strong Match": ["success", CheckCircle2],
  "Possible Match": ["warning", CircleDashed],
  "Poor Fit": ["muted", XCircle],
  // Backhaul marketplace
  Published: ["success", Radio],
  Paused: ["warning", Pause],
  Closed: ["muted", Ban],
  "Not Listed": ["outline", CircleDashed],
  Requested: ["warning", Inbox],
  // Customers / generic
  active: ["success"],
  new: ["info"],
  "on-hold": ["warning"],
  inactive: ["muted"],
  preferred: ["teal"],
  paused: ["warning", Pause],
  cancelled: ["danger"],
  "low-stock": ["warning"],
  seasonal: ["info"],
};

const LABELS: Record<string, string> = {
  active: "Active",
  new: "New",
  "on-hold": "On Hold",
  inactive: "Inactive",
  preferred: "Preferred",
  paused: "Paused",
  cancelled: "Cancelled",
  "low-stock": "Low Stock",
  seasonal: "Seasonal",
};

export function StatusBadge({ status, className, icon = true, label }: { status: string; className?: string; icon?: boolean; label?: string }) {
  const [variant, Icon] = MAP[status] ?? (["outline"] as Spec);
  return (
    <Badge variant={variant} className={cn("font-medium", className)}>
      {icon && Icon ? <Icon /> : null}
      {label ?? LABELS[status] ?? status}
    </Badge>
  );
}

export function ReceivableBadge({ daysOverdue, balance }: { daysOverdue: number; balance: number }) {
  if (balance <= 0) return <StatusBadge status="Paid" icon={false} />;
  if (daysOverdue <= 0) return <Badge variant="info">Current</Badge>;
  if (daysOverdue <= 7) return <Badge variant="warning">{daysOverdue}d overdue</Badge>;
  if (daysOverdue <= 30) return <Badge variant="danger">{daysOverdue}d overdue</Badge>;
  return (
    <Badge variant="danger" className="bg-[oklch(0.5_0.19_25)] text-white">
      <AlertTriangle />
      {daysOverdue}d overdue
    </Badge>
  );
}

const LOAD_TYPE: Record<LoadType, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  Outbound: { className: "bg-accent text-accent-foreground", icon: ArrowUpRight },
  Backhaul: { className: "bg-[oklch(0.95_0.04_300)] text-[oklch(0.45_0.14_300)]", icon: ArrowDownLeft },
  "Third-Party": { className: "bg-info-soft text-[oklch(0.45_0.14_250)]", icon: Handshake },
  "Company-Owned": { className: "bg-warning-soft text-[oklch(0.48_0.12_65)]", icon: Building2 },
};

/** Load type chip — Outbound, Backhaul, Third-Party or Company-Owned. */
export function LoadTypeBadge({ type, className }: { type: LoadType; className?: string }) {
  const m = LOAD_TYPE[type];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", m.className, className)}>
      <Icon className="size-3" />
      {type}
    </span>
  );
}

export function LegBadge({ leg, className }: { leg: Leg; className?: string }) {
  return leg === "outbound" ? (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-primary", className)}>
      <ArrowUpRight className="size-3.5" /> Outbound
    </span>
  ) : (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-[oklch(0.45_0.14_300)]", className)}>
      <ArrowDownLeft className="size-3.5" /> Return leg
    </span>
  );
}
