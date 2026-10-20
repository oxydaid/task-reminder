"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, ShieldAlert, LogOut, LayoutDashboard, CheckSquare, BookOpen, Settings } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage) return null;

  const isAppRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-white/85 backdrop-blur-md border-b border-[#E8E8EC]">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Brand */}
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 font-bold text-base tracking-tight text-[#0A0A0A]">
          <div className="w-8 h-8 rounded-[8px] bg-[#6366F1] flex items-center justify-center text-white shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span>Task Reminder</span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {user && isAppRoute ? (
            <>
              <Link
                href="/dashboard"
                className={`transition-colors ${pathname === "/dashboard" ? "text-[#6366F1] font-semibold" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/tasks"
                className={`transition-colors ${pathname.startsWith("/dashboard/tasks") ? "text-[#6366F1] font-semibold" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
              >
                Tugas
              </Link>
              <Link
                href="/dashboard/courses"
                className={`transition-colors ${pathname.startsWith("/dashboard/courses") ? "text-[#6366F1] font-semibold" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
              >
                Mata Kuliah
              </Link>
              <Link
                href="/dashboard/settings"
                className={`transition-colors ${pathname.startsWith("/dashboard/settings") ? "text-[#6366F1] font-semibold" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}
              >
                Pengaturan
              </Link>
              {isAdmin ? (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 transition-colors ${pathname.startsWith("/admin") ? "text-[#6366F1] font-semibold" : "text-amber-600 hover:text-amber-700"}`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  Admin
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/" className={`transition-colors ${pathname === "/" ? "text-[#6366F1]" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}>
                Beranda
              </Link>
              <Link href="/pricing" className={`transition-colors ${pathname === "/pricing" ? "text-[#6366F1]" : "text-[#6B6B6B] hover:text-[#0A0A0A]"}`}>
                Pricing
              </Link>
            </>
          )}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Tombol Dashboard hanya tampil di landing/public page (!isAppRoute) baik di mobile maupun desktop */}
              {!isAppRoute ? (
                <Link href="/dashboard">
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 text-xs font-semibold px-2.5 sm:px-3 flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
              ) : null}

              {/* Keterangan Akun hanya ditampilkan di dalam rute aplikasi (/dashboard atau /admin), BUKAN di landing page */}
              {isAppRoute ? (
                <div className="hidden sm:flex flex-col items-end text-xs">
                  <span className="font-medium text-[#0A0A0A]">{user.name}</span>
                  <span className="text-[#9C9C9C]">{user.whatsapp_number}</span>
                </div>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                title="Logout"
                className="text-[#6B6B6B] hover:text-[#0A0A0A] h-8 px-2 sm:px-3"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-1.5">Keluar</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Masuk
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">
                  Mulai Gratis
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
