import type { Metadata } from "next";
import { ReceivablesView } from "@/features/finance/receivables-view";

export const metadata: Metadata = { title: "Accounts Receivable" };

export default function Page() {
  return <ReceivablesView />;
}
