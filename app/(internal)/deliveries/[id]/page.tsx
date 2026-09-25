import type { Metadata } from "next";
import { DeliveryDetail } from "@/features/deliveries/delivery-detail";

export const metadata: Metadata = { title: "Delivery" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryDetail id={id} />;
}
