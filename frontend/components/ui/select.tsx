import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full h-10 px-3 text-sm bg-white border rounded-[6px] transition-all text-[#0A0A0A] cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]",
          error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : "border-[#E8E8EC]",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";
