import type { Metadata } from "next";
import { PortalReturnTrips } from "@/features/portal/return-trips";

export const metadata: Metadata = {
  title: "Return Trips to Quezon",
  description: "Book space on our trucks returning to Lucena from Metro Manila, Cavite and Laguna. Instant quote, confirmed by our dispatch desk.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  const { request } = await searchParams;
  return <PortalReturnTrips initialRequest={request} />;
}
