import type { Metadata } from "next";
import { DeliveriesView } from "@/features/deliveries/deliveries-view";

export const metadata: Metadata = { title: "Deliveries" };

export default async function Page({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  return <DeliveriesView initialArea={area} />;
}
