import { SessionGate } from "@/components/layout/session-gate";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate>{children}</SessionGate>;
}
