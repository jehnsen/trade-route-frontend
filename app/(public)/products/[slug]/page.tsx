import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCTS, productBySlug } from "@/data/products";
import { PortalProductDetail } from "@/features/portal/product-detail";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = productBySlug(slug);
  return p ? { title: `${p.name} — ${p.variant}`, description: p.description } : { title: "Product not found" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();
  return <PortalProductDetail product={product} />;
}
