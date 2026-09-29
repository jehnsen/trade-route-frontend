import type { Metadata } from "next";
import { LoadBoardView } from "@/features/load-board/load-board-view";

export const metadata: Metadata = { title: "Load Board" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams;
  return <LoadBoardView initialTab={tab} initialQ={q} />;
}
