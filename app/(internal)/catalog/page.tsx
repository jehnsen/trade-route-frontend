import type { Metadata } from "next";
import { CatalogView } from "@/features/catalog/catalog-view";

export const metadata: Metadata = { title: "Products" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <CatalogView initialQ={q} />;
}
