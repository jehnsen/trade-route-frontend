import { NextResponse, type NextRequest } from "next/server";
import { callAuth, sameOrigin, setRefreshToken, type TokenPair } from "@/lib/api/session-cookie";

/** Sign in: the refresh token goes into an httpOnly cookie, the access token back to the page. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "FORBIDDEN", message: "Cross-site request" }, { status: 403 });
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const res = await callAuth(req, "login", { email, password }).catch(() => null);
  if (!res) return NextResponse.json({ code: "API_UNREACHABLE", message: "Can't reach the TradeLoop server." }, { status: 503 });
  const body = await res.json().catch(() => null);
  if (!res.ok) return NextResponse.json(body ?? { code: "LOGIN_FAILED", message: "Sign-in failed" }, { status: res.status });
  const tokens = body.data as TokenPair;
  const out = NextResponse.json({ accessToken: tokens.accessToken, expiresIn: tokens.expiresIn });
  setRefreshToken(out, tokens.refreshToken);
  return out;
}
