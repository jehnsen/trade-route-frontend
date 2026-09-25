import type { Metadata } from "next";
import { ProcurementView } from "@/features/procurement/procurement-view";

export const metadata: Metadata = { title: "Procurement" };

export default function Page() {
  return <ProcurementView />;
}
