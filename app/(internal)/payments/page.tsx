import type { Metadata } from "next";
import { PaymentsView } from "@/features/finance/payments-view";

export const metadata: Metadata = { title: "Payments" };

export default function Page() {
  return <PaymentsView />;
}
