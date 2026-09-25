import type { Metadata } from "next";
import { MyOrders } from "@/features/portal/my-orders";

export const metadata: Metadata = { title: "My Orders" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <MyOrders initialTab={tab} />;
}
