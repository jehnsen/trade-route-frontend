"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export {
  FleetRoutes as FleetSnapshot,
  FreightDeliveries as DashboardDeliveries,
} from "@/features/command-center/operations-panels";

export function DashboardMetric({
  label,
  value,
  detail,
  icon: Icon,
  href,
  featured,
  footnote,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon: LucideIcon;
  href: string;
  featured?: boolean;
  footnote: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "dashboard-metric group flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-card hover:border-primary/40",
        featured &&
          "border-[#21604e] bg-[#21604e] text-white hover:border-[#398068]",
      )}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-xs font-medium",
              featured ? "text-white/80" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          <Icon
            className={cn(
              "size-[18px]",
              featured ? "text-[#bce1cc]" : "text-primary/70",
            )}
            strokeWidth={1.7}
          />
        </div>
        <div className="mt-4 text-[21px] leading-none font-semibold tracking-[-0.045em] tabular sm:text-[30px]">
          {value}
        </div>
        <div
          className={cn(
            "mt-3 text-[11px] leading-relaxed",
            featured ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {detail}
        </div>
      </div>
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-t px-4 py-3 text-[11px] font-medium sm:px-5",
          featured
            ? "border-white/10 bg-black/5 text-white/85"
            : "border-border/70 bg-muted/25 text-muted-foreground",
        )}
      >
        <span>{footnote}</span>
        <ArrowUpRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
    </Link>
  );
}
