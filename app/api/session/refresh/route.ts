import { NextResponse, type NextRequest } from "next/server";
import { callAuth, clearRefreshToken, readRefreshToken, sameOrigin, setRefreshToken, type TokenPair } from "@/lib/api/session-cookie";

/** Trade the refresh cookie for a new access token (null when signed out). The API rotates the refresh token every time. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "FORBIDDEN", message: "Cross-site request" }, { status: 403 });
  const refreshToken = readRefreshToken(req);
  // Signed-out visitors are the normal case on public pages: answer without an error status.
  if (!refreshToken) return NextResponse.json({ accessToken: null });
  const res = await callAuth(req, "refresh", { refreshToken }).catch(() => null);
  if (!res) return NextResponse.json({ code: "API_UNREACHABLE", message: "Can't reach the TradeLoop server." }, { status: 503 });
  if (!res.ok) {
    const out = NextResponse.json({ accessToken: null });
    clearRefreshToken(out);
    return out;
  }
  const tokens = (await res.json()).data as TokenPair;
  const out = NextResponse.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  setRefreshToken(out, tokens.refreshToken);
  return out;
}
