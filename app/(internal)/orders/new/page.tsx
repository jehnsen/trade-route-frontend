import type { Metadata } from "next";
import { OrderForm } from "@/features/orders/order-form";

export const metadata: Metadata = { title: "Create Order" };

export default async function Page({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  return <OrderForm initialCustomerId={customer} />;
}
