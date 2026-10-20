"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CheckSquare, BookOpen, Settings, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function BottomNav() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();

  if (!user) return null;
  // BottomNav hanya ditampilkan pada halaman dashboard dan admin, TIDAK di landing page (/) maupun /pricing
  const isAppPage = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (!isAppPage) return null;

  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, active: pathname === "/dashboard" },
    { href: "/dashboard/tasks", label: "Tugas", icon: CheckSquare, active: pathname.startsWith("/dashboard/tasks") },
    { href: "/dashboard/courses", label: "Kuliah", icon: BookOpen, active: pathname.startsWith("/dashboard/courses") },
    { href: "/dashboard/settings", label: "Setelan", icon: Settings, active: pathname.startsWith("/dashboard/settings") },
  ];

  if (isAdmin) {
    links.push({
      href: "/admin",
      label: "Admin",
      icon: ShieldAlert,
      active: pathname.startsWith("/admin"),
    });
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8E8EC] px-2 py-1.5 safe-area-pb">
      <div className="flex items-center justify-around">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-[8px] transition-colors ${
                item.active ? "text-[#6366F1] font-semibold" : "text-[#6B6B6B] hover:text-[#0A0A0A]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
