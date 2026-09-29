"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Repeat,
  Search,
  UserRound,
  Users,
  type LucideIcon,
  Inbox,
} from "lucide-react";
import type { Address, JobSource, OrderSource } from "@/types";
import { cn } from "@/lib/utils";
import { peso, pesoCompact, kg, pct } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import { Input } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/overlays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/form-controls";

// ─── PageHeader ─────────────────────────────────────────────────────────────
export interface Crumb {
  label: string;
  href?: string;
}
export function PageHeader({ title, description, breadcrumbs, actions, children }: { title: React.ReactNode; description?: React.ReactNode; breadcrumbs?: Crumb[]; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-header mb-5 flex flex-col gap-3">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground/80">{c.label}</span>
              )}
              {i < breadcrumbs.length - 1 && <ChevronRight className="size-3" />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────
export function KPICard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  deltaGood = true,
  href,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  delta?: number;
  deltaGood?: boolean;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const good = up === deltaGood;
  const body = (
    <Card className={cn("h-full gap-2 p-4 transition-colors", href && "hover:border-primary/40 hover:bg-accent/30", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md",
              tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-[oklch(0.55_0.13_65)]" : tone === "success" ? "bg-success-soft text-success" : "bg-accent text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {(hint || delta !== undefined) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-[oklch(0.45_0.13_150)]" : "text-danger")}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

// ─── Money ──────────────────────────────────────────────────────────────────
export function MoneyDisplay({ amount, compact, className, decimals }: { amount: number; compact?: boolean; className?: string; decimals?: boolean }) {
  return <span className={cn("tabular whitespace-nowrap", className)}>{compact ? pesoCompact(amount) : peso(amount, decimals)}</span>;
}

// ─── Capacity bar ───────────────────────────────────────────────────────────
export function CapacityBar({ used, capacity, label, className, showNumbers = true, size = "md" }: { used: number; capacity: number; label?: string; className?: string; showNumbers?: boolean; size?: "sm" | "md" }) {
  const ratio = capacity ? used / capacity : 0;
  const over = used > capacity;
  const color = over ? "bg-danger" : ratio >= 0.95 ? "bg-[oklch(0.7_0.15_60)]" : ratio >= 0.6 ? "bg-primary" : "bg-[oklch(0.65_0.09_200)]";
  return (
    <div className={cn("grid gap-1.5", className)}>
      {(label || showNumbers) && (
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{label}</span>
          {showNumbers && (
            <span className="tabular font-medium">
              {kg(used)} <span className="text-muted-foreground">/ {kg(capacity)}</span> · <span className={cn(over && "text-danger")}>{pct(ratio)}</span>
            </span>
          )}
        </div>
      )}
      <div className={cn("relative w-full overflow-hidden rounded-full bg-[oklch(0.93_0.02_200)]", size === "sm" ? "h-1.5" : "h-2.5")} role="meter" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Capacity"}>
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Timeline ───────────────────────────────────────────────────────────────
export interface TimelineItem {
  at?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  note?: React.ReactNode;
  state?: "done" | "current" | "pending" | "failed";
  icon?: LucideIcon;
}
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative grid gap-0", className)}>
      {items.map((it, i) => {
        const state = it.state ?? "done";
        const Icon = it.icon;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span className={cn("absolute top-6 left-[11px] h-[calc(100%-1.25rem)] w-px", state === "done" ? "bg-primary/40" : "bg-border")} aria-hidden />}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                state === "done" && "border-primary bg-primary text-white",
                state === "current" && "border-primary bg-card text-primary ring-4 ring-primary/15",
                state === "pending" && "border-border bg-card text-muted-foreground",
                state === "failed" && "border-danger bg-danger text-white",
              )}
            >
              {Icon ? <Icon className="size-3" /> : <span className={cn("size-1.5 rounded-full", state === "done" || state === "failed" ? "bg-white" : state === "current" ? "bg-primary" : "bg-border")} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <div className={cn("text-sm font-medium", state === "pending" && "text-muted-foreground")}>{it.title}</div>
                {it.at && <div className="tabular text-xs text-muted-foreground">{it.at}</div>}
              </div>
              {it.meta && <div className="text-xs text-muted-foreground">{it.meta}</div>}
              {it.note && <div className="mt-1 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">{it.note}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Address ────────────────────────────────────────────────────────────────
export function AddressDisplay({ address, compact, className }: { address: Address & { landmark?: string; receivingHours?: string; label?: string }; compact?: boolean; className?: string }) {
  if (compact)
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}>
        <MapPin className="size-3.5 shrink-0" />
        {address.barangay !== "—" ? `${address.barangay}, ` : ""}
        {address.city}
      </span>
    );
  return (
    <div className={cn("flex gap-2 text-sm", className)}>
      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div>
        {address.label && <div className="text-xs font-medium text-muted-foreground">{address.label}</div>}
        <div>{address.line1}</div>
        <div className="text-muted-foreground">
          {address.barangay !== "—" ? `${address.barangay}, ` : ""}
          {address.city}, {address.province}
        </div>
        {address.landmark && <div className="text-xs text-muted-foreground">Landmark: {address.landmark}</div>}
        {address.receivingHours && <div className="text-xs text-muted-foreground">Receiving: {address.receivingHours}</div>}
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ─── Filter bar ─────────────────────────────────────────────────────────────
export function FilterBar({ search, onSearch, placeholder = "Search…", children, right, className }: { search?: string; onSearch?: (v: string) => void; placeholder?: string; children?: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {onSearch && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="pl-8" aria-label={placeholder} />
          </div>
        )}
        {children}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function FilterSelect({ value, onChange, options, label, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-full sm:w-44"} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Order source ───────────────────────────────────────────────────────────
const SOURCE_META: Record<OrderSource, { icon: LucideIcon; className: string; short: string }> = {
  "Customer Portal": { icon: Globe, className: "bg-accent text-accent-foreground", short: "Portal" },
  "Facebook Messenger": { icon: MessageCircle, className: "bg-[oklch(0.95_0.03_265)] text-[oklch(0.45_0.17_265)]", short: "Messenger" },
  Phone: { icon: Phone, className: "bg-muted text-foreground/80", short: "Phone" },
  "Facebook Lead": { icon: Users, className: "bg-[oklch(0.95_0.03_255)] text-[oklch(0.45_0.15_255)]", short: "FB Lead" },
  Salesperson: { icon: UserRound, className: "bg-warning-soft text-[oklch(0.48_0.12_65)]", short: "Sales" },
  "Repeat Order": { icon: Repeat, className: "bg-success-soft text-[oklch(0.42_0.12_150)]", short: "Repeat" },
};
export function SourceBadge({ source, short }: { source: OrderSource; short?: boolean }) {
  const m = SOURCE_META[source];
  const Icon = m.icon;
  const badge = (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", m.className)}>
      <Icon className="size-3" />
      {short ? m.short : source}
    </span>
  );
  return short ? <Tip content={source}>{badge}</Tip> : badge;
}
export const ORDER_SOURCES = Object.keys(SOURCE_META) as OrderSource[];
export { SOURCE_META };

// ─── Job (booking) source ───────────────────────────────────────────────────
const JOB_SOURCE_META: Record<JobSource, { icon: LucideIcon; className: string }> = {
  Phone: { icon: Phone, className: "bg-muted text-foreground/80" },
  Messenger: { icon: MessageCircle, className: "bg-[oklch(0.95_0.03_265)] text-[oklch(0.45_0.17_265)]" },
  Facebook: { icon: Users, className: "bg-[oklch(0.95_0.03_255)] text-[oklch(0.45_0.15_255)]" },
  "Sales Staff": { icon: UserRound, className: "bg-warning-soft text-[oklch(0.48_0.12_65)]" },
  "Repeat Customer": { icon: Repeat, className: "bg-success-soft text-[oklch(0.42_0.12_150)]" },
  Referral: { icon: Users, className: "bg-accent text-accent-foreground" },
  "Customer Portal": { icon: Globe, className: "bg-accent text-accent-foreground" },
};
export const JOB_SOURCES = Object.keys(JOB_SOURCE_META) as JobSource[];

export function JobSourceBadge({ source }: { source: JobSource }) {
  const m = JOB_SOURCE_META[source];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", m.className)}>
      <Icon className="size-3" />
      {source}
    </span>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────────
export function Stat({ label, value, className, sub }: { label: string; value: React.ReactNode; className?: string; sub?: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-2", className)}>
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function DemoPriceNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>Prices shown are illustrative demo values only — not live market prices.</p>;
}

export function DemoRateNote({ className }: { className?: string }) {
  return <p className={cn("text-xs text-muted-foreground", className)}>Freight rates and diesel prices are illustrative demo values — not published tariffs.</p>;
}

/** Compact label/value row used in financial summaries. */
export function LineItem({ label, value, strong, muted, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-3", muted && "text-muted-foreground", className)}>
      <span>{label}</span>
      <span className={cn("tabular", strong && "font-semibold")}>{value}</span>
    </div>
  );
}
