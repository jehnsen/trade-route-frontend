import type { Metadata } from "next";
import { DocumentsView } from "@/features/fleet/documents-view";

export const metadata: Metadata = { title: "Vehicle Documents" };

export default function Page() {
  return <DocumentsView />;
}
