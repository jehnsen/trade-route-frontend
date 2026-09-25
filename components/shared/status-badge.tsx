import type { ComponentProps } from "react";
import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  FileText,
  PackageCheck,
  PackageOpen,
  Truck,
  XCircle,
  AlertTriangle,
  Loader,
  CornerUpLeft,
  MapPin,
  Send,
  Pause,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = NonNullable<ComponentProps<typeof Badge>["variant"]>;
type Spec = [Variant, React.ComponentType<{ className?: string }>?];

const MAP: Record<string, Spec> = {
  // Orders
  Draft: ["muted", FileText],
  "Pending Confirmation": ["info", Clock],
  Confirmed: ["success", CheckCircle2],
  Preparing: ["teal", PackageOpen],
  "Ready for Dispatch": ["teal", PackageCheck],
  "Out for Delivery": ["teal", Truck],
  Delivered: ["success", CheckCircle2],
  "Partially Delivered": ["warning", AlertTriangle],
  Cancelled: ["danger", XCircle],
  // Payment
  Unpaid: ["danger"],
  Partial: ["warning"],
  Paid: ["success"],
  Credit: ["info"],
  // Invoice
  Current: ["info"],
  Overdue: ["danger", AlertTriangle],
  // Delivery
  Scheduled: ["info", Clock],
  Loading: ["warning", Loader],
  Ready: ["teal", PackageCheck],
  "In Transit": ["teal", Truck],
  Arrived: ["teal", MapPin],
  Failed: ["danger", XCircle],
  Returned: ["danger", CornerUpLeft],
  // Trip
  Planned: ["muted", CircleDashed],
  Returning: ["teal", CornerUpLeft],
  Completed: ["success", CheckCircle2],
  // PO
  Sent: ["info", Send],
  "Ready for Pickup": ["teal", PackageCheck],
  "Picked Up": ["info", Truck],
  "Partially Received": ["warning", AlertTriangle],
  Received: ["success", CheckCircle2],
  // Fleet / people
  Available: ["success", CircleDot],
  "On Trip": ["info", Truck],
  Maintenance: ["warning", AlertTriangle],
  "Rest Day": ["muted"],
  "On Leave": ["muted"],
  // Leads
  New: ["info"],
  Contacted: ["teal"],
  Quoted: ["warning"],
  "Sample Order": ["teal"],
  Negotiating: ["warning"],
  Won: ["success", CheckCircle2],
  Lost: ["danger", XCircle],
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
  // RFQ
  Submitted: ["info"],
  "Under Review": ["warning"],
  Accepted: ["success"],
  Declined: ["muted"],
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

export function OrderStatus({ status }: { status: string }) {
  return <StatusBadge status={status} />;
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
