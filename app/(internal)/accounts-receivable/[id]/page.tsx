import type { Metadata } from "next";
import { InvoiceDetail } from "@/features/finance/invoice-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Invoice ${id}` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ print?: string }> }) {
  const { id } = await params;
  const { print } = await searchParams;
  return <InvoiceDetail id={id} autoPrint={print === "1"} />;
}
