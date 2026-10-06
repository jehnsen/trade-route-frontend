import type { NextConfig } from "next";

const apiUrl = process.env.TRADELOOP_API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't let `next dev` write agent instructions into the project's CLAUDE.md.
  agentRules: false,
  // The browser talks to the TradeLoop API through this app (same origin, no CORS).
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
