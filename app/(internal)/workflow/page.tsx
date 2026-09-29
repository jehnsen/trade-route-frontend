import type { Metadata } from "next";
import { WorkflowView } from "@/features/workflow/workflow-view";

export const metadata: Metadata = { title: "How It Works" };

export default async function Page({ searchParams }: { searchParams: Promise<{ job?: string; step?: string }> }) {
  const { job, step } = await searchParams;
  return <WorkflowView initialJobId={job} initialStep={step} />;
}
