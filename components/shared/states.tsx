"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useHydrated } from "@/lib/store";
import { Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./common";

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

/** Shows a skeleton while the organization's data loads, then a friendly not-found state. */
export function RecordNotFound({ kind, id, backHref, backLabel }: { kind: string; id: string; backHref: string; backLabel: string }) {
  const hydrated = useHydrated((s) => s.hydrated);
  if (!hydrated) return <PageSkeleton />;
  return (
    <EmptyState
      icon={SearchX}
      className="mx-auto mt-10 max-w-lg bg-card"
      title={`${kind} ${id} was not found`}
      description="It may have been removed, or the link is mistyped. Check the ID and try again."
      action={
        <Button asChild variant="outline">
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      }
    />
  );
}
