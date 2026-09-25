import type { Metadata } from "next";
import { SuppliersView } from "@/features/suppliers/suppliers-view";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page() {
  return <SuppliersView />;
}
