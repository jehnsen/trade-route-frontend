import type { Metadata } from "next";
import { PortalContact } from "@/features/portal/account-contact";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <PortalContact />;
}
