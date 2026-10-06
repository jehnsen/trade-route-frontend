"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CloudOff, RotateCcw, ServerCrash } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/common";

/**
 * Screens behind sign-in. Sends signed-out visitors to /login (and back here afterwards) and
 * explains when the API can't be reached or the data failed to load. While the data loads, pages
 * show their own skeletons.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const session = useSession((s) => s.status);
  const load = useAppStore((s) => s.status);
  const loadError = useAppStore((s) => s.loadError);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (session === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [session, router, pathname]);

  if (session === "unreachable")
    return (
      <EmptyState
        icon={CloudOff}
        className="mx-auto mt-16 max-w-lg bg-card"
        title="Can't reach the TradeLoop server"
        description="Check your connection. If you run TradeLoop yourself, make sure the API is running."
        action={
          <Button onClick={() => void useSession.getState().bootstrap()}>
            <RotateCcw /> Try again
          </Button>
        }
      />
    );
  if (load === "error")
    return (
      <EmptyState
        icon={ServerCrash}
        className="mx-auto mt-16 max-w-lg bg-card"
        title="Your operations data didn't load"
        description={loadError}
        action={
          <Button onClick={() => void useAppStore.getState().load()}>
            <RotateCcw /> Reload data
          </Button>
        }
      />
    );
  if (session === "signedOut") return null;
  return <>{children}</>;
}
