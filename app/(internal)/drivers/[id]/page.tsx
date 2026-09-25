import type { Metadata } from "next";
import { DriverProfile } from "@/features/fleet/fleet-views";

export const metadata: Metadata = { title: "Driver" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverProfile id={id} />;
}
