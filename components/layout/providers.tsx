"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlays";
import { useAppStore, useHydrated } from "@/lib/store";

/** Superseded storage keys from earlier schema versions — orphaned data that only wastes quota. */
const STALE_STORAGE_KEYS = ["tradeloop-logistics-demo", "tradeloop-logistics-demo-v2"];

function StoreHydrator() {
  const setHydrated = useHydrated((s) => s.set);
  React.useEffect(() => {
    try {
      for (const key of STALE_STORAGE_KEYS) localStorage.removeItem(key);
    } catch {
      // storage unavailable (private mode, SSR) — nothing to clean up
    }
    const done = () => setHydrated(true);
    try {
      const res = useAppStore.persist.rehydrate();
      if (res && typeof (res as Promise<void>).then === "function") (res as Promise<void>).then(done, done);
      else done();
    } catch {
      done();
    }
  }, [setHydrated]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <StoreHydrator />
      {children}
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: "text-sm" }} />
    </TooltipProvider>
  );
}
