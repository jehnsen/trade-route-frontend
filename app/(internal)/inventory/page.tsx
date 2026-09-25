import type { Metadata } from "next";
import { InventoryView } from "@/features/inventory/inventory-view";

export const metadata: Metadata = { title: "Inventory" };

export default function Page() {
  return <InventoryView />;
}
