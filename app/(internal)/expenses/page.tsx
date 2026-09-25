import type { Metadata } from "next";
import { ExpensesView } from "@/features/finance/expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return <ExpensesView />;
}
