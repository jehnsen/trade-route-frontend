import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <div className="text-sm font-semibold text-primary">404</div>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist in FreshRoute.</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Customer portal</Link>
        </Button>
      </div>
    </div>
  );
}
