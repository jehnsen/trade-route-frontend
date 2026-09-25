import type { Metadata } from "next";
import { DeliveryReceipt } from "@/features/orders/delivery-receipt";

export const metadata: Metadata = { title: "Delivery Receipt" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryReceipt id={id} />;
}
