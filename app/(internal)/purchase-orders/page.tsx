import type { Metadata } from "next";
import { PurchaseOrdersView } from "@/features/procurement/purchase-orders-view";

export const metadata: Metadata = { title: "Purchase Orders" };

export default async function Page({ searchParams }: { searchParams: Promise<{ po?: string }> }) {
  const { po } = await searchParams;
  return <PurchaseOrdersView initialPo={po} />;
}
