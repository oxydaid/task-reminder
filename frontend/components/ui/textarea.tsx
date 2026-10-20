import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full min-h-[80px] p-3 text-sm bg-white border rounded-[6px] transition-all text-[#0A0A0A] placeholder:text-[#9C9C9C]",
          "focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]",
          error ? "border-red-500 focus:ring-red-500/20 focus:border-red-500" : "border-[#E8E8EC]",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
