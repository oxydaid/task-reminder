import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded-[4px] text-xs font-medium border transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-[#0A0A0A] border-zinc-200",
        secondary: "bg-zinc-100 text-[#0A0A0A] border-zinc-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        error: "bg-rose-50 text-rose-700 border-rose-200",
        destructive: "bg-rose-50 text-rose-700 border-rose-200",
        outline: "bg-transparent text-[#6B6B6B] border-[#E8E8EC]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
