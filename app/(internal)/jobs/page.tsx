import type { Metadata } from "next";
import { JobsView } from "@/features/jobs/jobs-view";

export const metadata: Metadata = { title: "Logistics Jobs" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <JobsView initialTab={tab} initialQ={q} />;
}
