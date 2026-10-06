import { AppShell } from "@/components/layout/app-shell";
import { SessionGate } from "@/components/layout/session-gate";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
