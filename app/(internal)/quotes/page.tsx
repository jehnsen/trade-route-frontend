import type { Metadata } from "next";
import { QuotesView } from "@/features/quotes/quotes-view";

export const metadata: Metadata = { title: "Quotes" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; lead?: string; customer?: string }> }) {
  const { q, lead, customer } = await searchParams;
  return <QuotesView initialQ={q} newForLead={lead} newForCustomer={customer} />;
}
