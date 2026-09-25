import type { Metadata } from "next";
import { DriversView } from "@/features/fleet/fleet-views";

export const metadata: Metadata = { title: "Drivers" };

export default function Page() {
  return <DriversView />;
}
