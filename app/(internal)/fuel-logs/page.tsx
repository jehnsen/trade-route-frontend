import type { Metadata } from "next";
import { FuelLogsView } from "@/features/fleet/fuel-logs-view";

export const metadata: Metadata = { title: "Fuel Logs" };

export default function Page() {
  return <FuelLogsView />;
}
