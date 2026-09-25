import type { Metadata } from "next";
import { OrderCheckout } from "@/features/portal/order-checkout";

export const metadata: Metadata = { title: "Wholesale Order" };

export default function Page() {
  return <OrderCheckout />;
}
