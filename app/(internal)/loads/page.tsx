import type { Metadata } from "next";
import { LoadsView } from "@/features/loads/loads-view";

export const metadata: Metadata = { title: "Loads / Cargo" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; trip?: string }> }) {
  const { q, trip } = await searchParams;
  return <LoadsView initialQ={q} initialTrip={trip} />;
}
