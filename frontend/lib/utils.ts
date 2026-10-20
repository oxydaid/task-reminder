import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  if (amount === 0) return "Gratis";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateWIB(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return (
    new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB"
  );
}

export function formatTimeRemaining(deadlineStr: string): { label: string; isPast: boolean } {
  if (!deadlineStr) return { label: "-", isPast: false };
  const target = new Date(deadlineStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff < 0) {
    const pastMinutes = Math.floor(Math.abs(diff) / 60000);
    if (pastMinutes < 60) return { label: `Terlambat ${pastMinutes}m`, isPast: true };
    const pastHours = Math.floor(pastMinutes / 60);
    if (pastHours < 24) return { label: `Terlambat ${pastHours}j`, isPast: true };
    const pastDays = Math.floor(pastHours / 24);
    return { label: `Terlambat ${pastDays} hari`, isPast: true };
  }

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return { label: `${minutes} menit lagi`, isPast: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `${hours} jam lagi`, isPast: false };
  const days = Math.floor(hours / 24);
  return { label: `${days} hari lagi`, isPast: false };
}
