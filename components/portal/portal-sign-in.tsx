"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, UserRound } from "lucide-react";
import { useSession } from "@/lib/session";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/shared/common";

/**
 * Account pages of the storefront (orders, checkout, account, quotes) need a signed-in business.
 * Shows a skeleton while the session resumes and a sign-in prompt for visitors.
 */
export function PortalAccountGate({ children, what }: { children: React.ReactNode; what: string }) {
  const session = useSession((s) => s.status);
  const ready = useAppStore((s) => s.status === "ready");
  const pathname = usePathname();
  if (session === "loading" || (session === "signedIn" && !ready))
    return (
      <div className="portal-container grid gap-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  if (session !== "signedIn")
    return (
      <div className="portal-container py-12">
        <EmptyState
          icon={UserRound}
          title={`Sign in to ${what}`}
          description="Use the business account we set up for you. Call or message us if you don't have one yet."
          action={
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
                <LogIn /> Sign in
              </Link>
            </Button>
          }
          className="mx-auto max-w-lg bg-card"
        />
      </div>
    );
  return <>{children}</>;
}
