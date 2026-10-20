import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-[#E8E8EC] bg-white py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[6px] bg-[#6366F1] flex items-center justify-center text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm text-[#0A0A0A]">Task Reminder</span>
          <span className="text-xs text-[#9C9C9C]">© {new Date().getFullYear()}</span>
        </div>

        <div className="flex items-center gap-6 text-xs text-[#6B6B6B]">
          <Link href="/" className="hover:text-[#0A0A0A] transition-colors">
            Beranda
          </Link>
          <Link href="/pricing" className="hover:text-[#0A0A0A] transition-colors">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-[#0A0A0A] transition-colors">
            Masuk
          </Link>
          <Link href="/register" className="hover:text-[#0A0A0A] transition-colors">
            Daftar
          </Link>
        </div>

        <div className="text-xs text-[#9C9C9C] text-center md:text-right">
          Pengingat tugas kuliah via WhatsApp. Sederhana, tepat waktu, dan ringan.
        </div>
      </div>
    </footer>
  );
}
