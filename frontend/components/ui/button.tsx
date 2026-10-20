import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-medium transition-all duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#6366F1] text-white hover:bg-[#4F46E5] shadow-xs btn-primary-glow rounded-[6px]",
        primary:
          "bg-[#6366F1] text-white hover:bg-[#4F46E5] shadow-xs btn-primary-glow rounded-[6px]",
        outline:
          "border border-[#E8E8EC] bg-transparent text-[#0A0A0A] hover:bg-zinc-100 rounded-[6px]",
        secondary:
          "bg-white border border-[#E8E8EC] text-[#0A0A0A] hover:bg-zinc-100 shadow-xs rounded-[6px]",
        ghost:
          "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100 rounded-[6px]",
        destructive:
          "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-[6px]",
        link:
          "text-[#6366F1] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-xs sm:text-sm gap-2",
        md: "h-9 px-4 text-xs sm:text-sm gap-2",
        sm: "h-8 px-3 text-xs gap-1.5",
        xs: "h-7 px-2 text-[11px] gap-1",
        lg: "h-11 px-6 text-sm sm:text-base gap-2.5",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    return (
      <ButtonPrimitive
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin -ml-0.5 mr-2 h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : null}
        {children}
      </ButtonPrimitive>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
