import type { Metadata } from "next";
import { RequestQuote } from "@/features/portal/request-quote";

export const metadata: Metadata = { title: "Request a Wholesale Quote" };

export default async function Page({ searchParams }: { searchParams: Promise<{ product?: string; qty?: string }> }) {
  const { product, qty } = await searchParams;
  return <RequestQuote productId={product} qty={qty ? Number(qty) : undefined} />;
}
