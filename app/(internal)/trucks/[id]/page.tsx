import type { Metadata } from "next";
import { TruckDetail } from "@/features/fleet/fleet-views";

export const metadata: Metadata = { title: "Truck" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TruckDetail id={id} />;
}
