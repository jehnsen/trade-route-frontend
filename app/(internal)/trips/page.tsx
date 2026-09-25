import type { Metadata } from "next";
import { TripsView } from "@/features/trips/trips-view";

export const metadata: Metadata = { title: "Trips" };

export default function Page() {
  return <TripsView />;
}
