import type { Metadata } from "next";
import { PortalCatalog } from "@/features/portal/catalog";

export const metadata: Metadata = { title: "Wholesale Products" };

export default async function Page({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  return <PortalCatalog initialCategory={category} />;
}
