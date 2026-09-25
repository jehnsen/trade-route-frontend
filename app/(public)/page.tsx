import type { Metadata } from "next";
import { PortalHome } from "@/features/portal/home";

export const metadata: Metadata = {
  title: "Wholesale Seafood & Produce from Lucena",
  description: "Fresh seafood and agricultural products delivered to businesses across Luzon and selected destinations nationwide.",
};

export default function Page() {
  return <PortalHome />;
}
