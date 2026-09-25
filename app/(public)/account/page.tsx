import type { Metadata } from "next";
import { PortalAccount } from "@/features/portal/account-contact";

export const metadata: Metadata = { title: "Business Account" };

export default function Page() {
  return <PortalAccount />;
}
