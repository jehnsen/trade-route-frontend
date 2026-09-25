import type { Metadata } from "next";
import { DriverView } from "@/features/driver/driver-view";

export const metadata: Metadata = { title: "Driver" };

export default function Page() {
  return <DriverView />;
}
