"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/overlays";
import { useAppStore } from "@/lib/store";
import { useSession } from "@/lib/session";

/** Browser copies of the whole demo data set from before the API — orphaned, only wasting quota. */
const STALE_STORAGE_KEYS = ["tradeloop-logistics-demo", "tradeloop-logistics-demo-v2", "tradeloop-logistics-demo-v3"];
const SYNC_INTERVAL_MS = 20_000;

/** Resume the session, load the organization's data and keep it current while the tab is open. */
function AppBootstrap() {
  const session = useSession((s) => s.status);

  React.useEffect(() => {
    try {
      for (const key of STALE_STORAGE_KEYS) localStorage.removeItem(key);
    } catch {
      // storage unavailable (private mode) — nothing to clean up
    }
    void useAppStore.persist.rehydrate();
    void useSession.getState().bootstrap();
  }, []);

  React.useEffect(() => {
    const store = useAppStore.getState();
    if (session === "signedIn" && store.status === "idle") void store.load();
    if (session === "signedOut" && store.status !== "idle") store.clear();
  }, [session]);

  React.useEffect(() => {
    if (session !== "signedIn") return;
    const sync = () => {
      if (document.visibilityState === "visible") void useAppStore.getState().sync();
    };
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [session]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <AppBootstrap />
      {children}
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: "text-sm" }} />
    </TooltipProvider>
  );
}
