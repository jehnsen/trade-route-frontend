"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/common";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      className="mx-auto mt-10 max-w-lg bg-card"
      title="Something went wrong loading this page"
      description={
        <>
          The rest of FreshRoute is still available. If this keeps happening, reset the demo data from the Demo Data badge.
          {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
        </>
      }
      action={
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
      }
    />
  );
}
