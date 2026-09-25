import type { Metadata } from "next";
import { OrdersView } from "@/features/orders/orders-view";

export const metadata: Metadata = { title: "Orders" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <OrdersView initial={{ date: sp.date, status: sp.status, source: sp.source, q: sp.q }} />;
}
