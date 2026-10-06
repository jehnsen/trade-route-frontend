import type { NextRequest, NextResponse } from "next/server";

/**
 * Server-side half of the session: the API's rotating refresh token lives in an httpOnly cookie
 * scoped to /api/session, so page scripts never see it. The short-lived access token is handed to
 * the browser and kept in memory only.
 */
export const API_URL = process.env.TRADELOOP_API_URL ?? "http://localhost:4000";
const COOKIE = "tl_refresh";
const MAX_AGE = 30 * 24 * 60 * 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const readRefreshToken = (req: NextRequest) => req.cookies.get(COOKIE)?.value;

export function setRefreshToken(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/session", maxAge: MAX_AGE });
}

export function clearRefreshToken(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/session", maxAge: 0 });
}

/** Rejects cross-site POSTs (the cookie is SameSite=Strict too; this is belt and braces). */
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).host === req.headers.get("host");
}

/** POST to the API's auth endpoints, forwarding the caller's address for rate limiting and audit. */
export function callAuth(req: NextRequest, path: string, body?: unknown, accessToken?: string) {
  const forwarded = req.headers.get("x-forwarded-for");
  return fetch(`${API_URL}/api/v1/auth/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}
