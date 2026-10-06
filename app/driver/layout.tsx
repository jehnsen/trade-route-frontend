import { SessionGate } from "@/components/layout/session-gate";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-muted/40 shadow-sm">
      <SessionGate>{children}</SessionGate>
    </div>
  );
}
