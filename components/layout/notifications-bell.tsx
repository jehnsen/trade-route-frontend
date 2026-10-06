"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCircle2, CircleDollarSign, ClipboardList, Info, Megaphone, PackageCheck, ShoppingCart, Truck, Undo2, Wrench } from "lucide-react";
import type { AppNotification, NotificationKind } from "@/types";
import { useAppStore } from "@/lib/store";
import { act } from "@/lib/act";
import { cn } from "@/lib/utils";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";

export const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  job: ClipboardList,
  trip: Truck,
  delivery: PackageCheck,
  finance: CircleDollarSign,
  fleet: Wrench,
  backhaul: Undo2,
  lead: Megaphone,
  order: ShoppingCart,
};

export function severityIcon(sev: AppNotification["severity"]) {
  return sev === "critical" || sev === "warning" ? AlertTriangle : sev === "success" ? CheckCircle2 : Info;
}

export function useRoleNotifications() {
  const role = useAppStore((s) => s.role);
  const all = useAppStore((s) => s.notifications);
  return React.useMemo(() => all.filter((n) => role === "owner" || n.roles.includes(role)).sort((a, b) => b.at.localeCompare(a.at)), [all, role]);
}

export function NotificationRow({ n, onClick }: { n: AppNotification; onClick?: () => void }) {
  const Icon = KIND_ICON[n.kind];
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full gap-3 rounded-md px-2.5 py-2 text-left hover:bg-accent cursor-pointer", !n.read && "bg-accent/40")}>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          n.severity === "critical" ? "bg-danger-soft text-danger" : n.severity === "warning" ? "bg-warning-soft text-[oklch(0.55_0.13_65)]" : n.severity === "success" ? "bg-success-soft text-success" : "bg-info-soft text-info",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold">{n.title}</span>
          {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
        </span>
        <span className="block text-[13px] leading-snug text-foreground/80">{n.body}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{fmtRelative(n.at)}</span>
      </span>
    </button>
  );
}

export function NotificationsBell() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const list = useRoleNotifications();
  const markRead = useAppStore((s) => s.markNotificationRead);
  const markAll = useAppStore((s) => s.markAllNotificationsRead);
  const unread = list.filter((n) => !n.read).length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell />
          {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,400px)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <div className="text-sm font-semibold">Notifications</div>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => void act(markAll)}>
            Mark all as read
          </Button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5">
          {list.slice(0, 8).map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onClick={() => {
                if (!n.read) void act(() => markRead(n.id));
                setOpen(false);
                router.push(n.href);
              }}
            />
          ))}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              Open notification center
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
