import type { Metadata } from "next";
import { LeadsView } from "@/features/leads/leads-view";

export const metadata: Metadata = { title: "Leads & Facebook" };

export default function Page() {
  return <LeadsView />;
}
