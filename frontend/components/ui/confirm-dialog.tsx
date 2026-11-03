"use client";

import * as React from "react";
import { Trash2, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "primary";
  icon?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  children?: React.ReactNode;
  maxWidth?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Hapus",
  cancelText = "Batal",
  variant = "destructive",
  icon,
  onConfirm,
  isLoading = false,
  children,
  maxWidth = "max-w-md",
}: ConfirmDialogProps) {
  const renderIcon = () => {
    if (icon) return icon;
    if (variant === "destructive") {
      return (
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
          <Trash2 className="w-6 h-6" />
        </div>
      );
    }
    if (variant === "warning") {
      return (
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#6366F1] flex items-center justify-center shrink-0">
        <Info className="w-6 h-6" />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maxWidth={maxWidth}>
      <div className="space-y-4">
        {renderIcon()}

        <div>
          <h3 className="text-lg font-bold text-[#0A0A0A] tracking-tight">{title}</h3>
          <div className="text-xs sm:text-sm text-[#6B6B6B] mt-1.5 leading-relaxed">
            {description}
          </div>
        </div>

        {children}

        <div className="flex items-center justify-end gap-2.5 pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "primary"}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
