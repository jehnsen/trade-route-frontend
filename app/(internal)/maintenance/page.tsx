import type { Metadata } from "next";
import { MaintenanceView } from "@/features/fleet/maintenance-view";

export const metadata: Metadata = { title: "Maintenance" };

export default function Page() {
  return <MaintenanceView />;
}
