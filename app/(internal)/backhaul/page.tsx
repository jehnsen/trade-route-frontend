import type { Metadata } from "next";
import { BackhaulView } from "@/features/backhaul/backhaul-view";

export const metadata: Metadata = { title: "Backhaul Intelligence" };

export default function Page() {
  return <BackhaulView />;
}
