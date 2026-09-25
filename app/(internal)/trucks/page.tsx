import type { Metadata } from "next";
import { TrucksView } from "@/features/fleet/fleet-views";

export const metadata: Metadata = { title: "Trucks" };

export default function Page() {
  return <TrucksView />;
}
