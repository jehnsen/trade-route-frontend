import type { Metadata } from "next";
import { LoginView } from "@/features/auth/login-view";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginView next={next} />;
}
