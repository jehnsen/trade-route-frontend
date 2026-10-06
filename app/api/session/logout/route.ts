import { NextResponse, type NextRequest } from "next/server";
import { callAuth, clearRefreshToken, sameOrigin } from "@/lib/api/session-cookie";

/** Sign out: revoke the session on the API and drop the refresh cookie. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ code: "FORBIDDEN", message: "Cross-site request" }, { status: 403 });
  const accessToken = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (accessToken) await callAuth(req, "logout", undefined, accessToken).catch(() => undefined);
  const out = new NextResponse(null, { status: 204 });
  clearRefreshToken(out);
  return out;
}
