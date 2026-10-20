"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, Users, Layers, QrCode, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/dashboard");
    }
  }, [user, loading, isAdmin, router]);

  if (loading || !isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 flex justify-center text-sm text-[#9C9C9C]">
        Memeriksa hak akses administrator...
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Ringkasan", icon: LayoutDashboard },
    { href: "/admin/users", label: "Kelola Pengguna", icon: Users },
    { href: "/admin/plans", label: "Manage Plans", icon: Layers },
    { href: "/admin/whatsapp", label: "WhatsApp Gateway", icon: QrCode },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#FAFAFA]">
      {/* Sub-header navigation for admin */}
      <div className="bg-white border-b border-[#E8E8EC] sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-0">
          <div className="flex items-center gap-1.5 py-1 sm:py-3 shrink-0">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
              Admin Panel
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1.5 sm:py-2 whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#6366F1] text-white shadow-xs"
                      : "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-28 md:py-8">{children}</div>
    </div>
  );
}
