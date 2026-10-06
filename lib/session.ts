"use client";

import { create } from "zustand";
import { ApiError, setTokenSource } from "@/lib/api/client";

/**
 * Sign-in state. The refresh token is an httpOnly cookie handled by the /api/session routes; the
 * short-lived access token is kept for this tab only (sessionStorage), so moving between pages
 * doesn't spend a refresh.
 *
 * The API rotates refresh tokens and treats a reused one as stolen (it ends the whole session). So
 * refreshes are serialized across tabs (Web Locks) and sent with `keepalive`: if the page unloads
 * mid-refresh, the browser still stores the rotated cookie instead of keeping the spent one.
 */
export type SessionStatus = "loading" | "signedOut" | "signedIn" | "unreachable";

interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  /** Resume the session from the refresh cookie (once per page load). */
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** New access token, or null when the session has ended. */
  refresh: () => Promise<string | null>;
}

let inflight: Promise<string | null> | null = null;

const TAB_TOKEN = "tradeloop-access";
const SKEW_MS = 30_000;

/** This tab's access token, if it has not expired yet. */
function storedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TAB_TOKEN);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: number };
    return expiresAt - SKEW_MS > Date.now() ? token : null;
  } catch {
    return null;
  }
}

function storeToken(token: string | null, expiresIn = 0) {
  try {
    if (token) sessionStorage.setItem(TAB_TOKEN, JSON.stringify({ token, expiresAt: Date.now() + expiresIn * 1000 }));
    else sessionStorage.removeItem(TAB_TOKEN);
  } catch {
    // storage unavailable — the token stays in memory for this page
  }
}

const withLock = async <T,>(fn: () => Promise<T>): Promise<T> =>
  typeof navigator !== "undefined" && navigator.locks ? await navigator.locks.request("tradeloop-session", fn) : fn();

export const useSession = create<SessionState>()((set, get) => ({
  status: "loading",
  accessToken: null,

  refresh: () => {
    inflight ??= withLock(async () => {
      try {
        const res = await fetch("/api/session/refresh", { method: "POST", cache: "no-store", keepalive: true });
        if (!res.ok) throw new Error(`refresh ${res.status}`);
        const { accessToken, expiresIn } = (await res.json()) as { accessToken: string | null; expiresIn: number };
        if (!accessToken) {
          storeToken(null);
          set({ status: "signedOut", accessToken: null });
          return null;
        }
        storeToken(accessToken, expiresIn);
        set({ status: "signedIn", accessToken });
        return accessToken;
      } catch {
        set({ status: "unreachable" });
        return null;
      }
    }).finally(() => {
      inflight = null;
    });
    return inflight;
  },

  bootstrap: async () => {
    if (get().status === "signedIn") return;
    const token = storedToken();
    if (token) return set({ status: "signedIn", accessToken: token });
    set({ status: "loading" });
    await get().refresh();
  },

  login: async (email, password) => {
    let res: Response;
    try {
      res = await fetch("/api/session/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    } catch {
      throw new ApiError(0, "API_UNREACHABLE", "Can't reach the TradeLoop server. Check your connection and try again.");
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.code ?? "LOGIN_FAILED", body?.message ?? "Sign-in failed");
    storeToken(body.accessToken, body.expiresIn);
    set({ status: "signedIn", accessToken: body.accessToken });
  },

  logout: async () => {
    const token = get().accessToken;
    storeToken(null);
    await fetch("/api/session/logout", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} }).catch(() => undefined);
    set({ status: "signedOut", accessToken: null });
  },
}));

setTokenSource({
  token: () => useSession.getState().accessToken,
  refresh: () => useSession.getState().refresh(),
});
