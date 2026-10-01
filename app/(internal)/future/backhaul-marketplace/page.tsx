import type { Metadata } from "next";
import { BackhaulMarketplaceView } from "@/features/backhaul-marketplace/marketplace-view";

export const metadata: Metadata = { title: "Backhaul Marketplace" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <BackhaulMarketplaceView initialTab={tab} initialQ={q} />;
}
