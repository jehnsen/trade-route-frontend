import { PortalShell } from "@/components/portal/portal-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
