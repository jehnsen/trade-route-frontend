import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground bg-card",
        success: "border-transparent bg-success-soft text-[oklch(0.42_0.12_150)]",
        warning: "border-transparent bg-warning-soft text-[oklch(0.48_0.12_65)]",
        danger: "border-transparent bg-danger-soft text-[oklch(0.5_0.19_25)]",
        info: "border-transparent bg-info-soft text-[oklch(0.45_0.14_250)]",
        muted: "border-transparent bg-muted text-muted-foreground",
        teal: "border-transparent bg-accent text-accent-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, asChild = false, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
