import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Task Reminder — Pengingat Tugas Kuliah Otomatis via WhatsApp",
  description: "Aplikasi pengingat tenggat tugas kuliah praktis dengan notifikasi otomatis langsung ke WhatsApp.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192x192.svg",
  },
  openGraph: {
    title: "Task Reminder — Pengingat Tugas Kuliah Otomatis via WhatsApp",
    description: "Catat tugas kuliah, kelola deadline, dan dapatkan notifikasi WhatsApp otomatis sebelum tugas terlambat.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366F1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={cn("font-sans", geist.variable)}>
      <body className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <BottomNav />
          <Toaster
            position="top-right"
            expand={true}
            richColors
            closeButton
            duration={3500}
            visibleToasts={4}
            offset={{ top: "72px", right: "20px" }}
            mobileOffset={{ top: "72px", left: "16px", right: "16px" }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
