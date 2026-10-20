"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Users, Layers, QrCode, ArrowRight, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { AdminUserItem, Plan, WhatsAppStatus } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AdminOverviewPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Parallel fetch per vercel react best practices
  const loadStats = useCallback(async () => {
    try {
      const [u, p, w] = await Promise.all([
        api.get<AdminUserItem[]>("/admin/users"),
        api.get<Plan[]>("/admin/plans"),
        api.get<WhatsAppStatus>("/admin/whatsapp/status"),
      ]);
      setUsers(u);
      setPlans(p);
      setWaStatus(w);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat data administrasi...
      </div>
    );
  }

  const activePlansCount = plans.filter((p) => p.is_active).length;
  const isWaConnected = waStatus?.is_logged_in;

  return (
    <div className="space-y-8 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          Dashboard Administrator
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
          Pantau kesehatan gateway WhatsApp, statistik pengguna, dan konfigurasi paket aplikasi.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Total Pengguna</span>
            <Users className="w-4 h-4 text-[#6366F1]" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A]">{users.length}</div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">
            {users.filter((u) => u.is_active).length} akun aktif
          </span>
        </Card>

        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Paket Layanan (Plans)</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A]">{plans.length}</div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block">
            {activePlansCount} paket aktif ditampilkan
          </span>
        </Card>

        <Card>
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-[#6B6B6B]">Status Bot WhatsApp</span>
            <QrCode className="w-4 h-4 text-[#6366F1]" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isWaConnected ? (
              <Badge variant="success" className="text-xs py-1">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Terhubung (Online)
              </Badge>
            ) : (
              <Badge variant="error" className="text-xs py-1">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Belum Terhubung
              </Badge>
            )}
          </div>
          <span className="text-[11px] text-[#9C9C9C] mt-1 block truncate">
            {waStatus?.phone_number ? `Nomor: +${waStatus.phone_number}` : "Sesi belum di-pairing"}
          </span>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-[12px] bg-white border border-[#E8E8EC] card-hover flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-[8px] bg-indigo-50 flex items-center justify-center text-[#6366F1] mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0A0A0A]">Kelola Pengguna</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
              Cari mahasiswa berdasarkan nama atau nomor WA, tambah user manual, atur role admin, atau nonaktifkan akun.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[#E8E8EC]">
            <Link href="/admin/users" className="text-xs font-semibold text-[#6366F1] hover:underline flex items-center gap-1">
              Buka Manajemen User <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="p-5 rounded-[12px] bg-white border border-[#E8E8EC] card-hover flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-[8px] bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0A0A0A]">Manage Plans</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
              Konfigurasi paket Free, Basic, Sibuk, SuperSibuk. Ubah harga bulanan, kuota mata kuliah & batas tugas.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[#E8E8EC]">
            <Link href="/admin/plans" className="text-xs font-semibold text-[#6366F1] hover:underline flex items-center gap-1">
              Buka Manajemen Plans <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="p-5 rounded-[12px] bg-white border border-[#E8E8EC] card-hover flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-[8px] bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#0A0A0A]">WhatsApp Gateway</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 leading-relaxed">
              Pindai QR code whatsmeow untuk menghubungkan nomor bot pengirim WhatsApp atau lakukan pemutusan sesi.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-[#E8E8EC]">
            <Link href="/admin/whatsapp" className="text-xs font-semibold text-[#6366F1] hover:underline flex items-center gap-1">
              Kelola Koneksi WhatsApp <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
