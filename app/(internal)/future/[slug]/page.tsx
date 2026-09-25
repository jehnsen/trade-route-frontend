import type { Metadata } from "next";
import { FUTURE_MODULES } from "@/lib/nav";
import { FutureModuleView } from "@/features/settings/settings-views";

export const metadata: Metadata = { title: "Coming Soon" };

export function generateStaticParams() {
  return FUTURE_MODULES.map((m) => ({ slug: m.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <FutureModuleView slug={slug} />;
}
