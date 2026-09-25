import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't let `next dev` write agent instructions into the project's CLAUDE.md.
  agentRules: false,
};

export default nextConfig;
