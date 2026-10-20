import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "w-full h-10 px-3.5 text-sm bg-white border rounded-[6px] transition-all text-[#0A0A0A] placeholder:text-[#9C9C9C]",
          "focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]",
          error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : "border-[#E8E8EC]",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
