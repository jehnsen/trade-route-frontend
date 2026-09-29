import type { Metadata } from "next";
import { JobForm } from "@/features/jobs/job-form";

export const metadata: Metadata = { title: "Create Job" };

export default async function Page({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  return <JobForm initialCustomerId={customer} />;
}
