"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Smartphone,
  Save,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { adminSettingsApi, api } from "@/lib/api";
import { AdminNotificationSettings, WhatsAppStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [receiveTx, setReceiveTx] = useState<boolean>(true);
  const [receiveProof, setReceiveProof] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [notifData, waData] = await Promise.allSettled([
        adminSettingsApi.getNotifications(),
        api.get<WhatsAppStatus>("/admin/whatsapp/status"),
      ]);

      if (notifData.status === "fulfilled" && notifData.value) {
        setSettings(notifData.value);
        setReceiveTx(notifData.value.receive_transaction_notification);
        setReceiveProof(notifData.value.receive_payment_proof_notification);
      }
      if (waData.status === "fulfilled" && waData.value) {
        setWaStatus(waData.value);
      }
    } catch {
      toast.error("Gagal memuat pengaturan notifikasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminSettingsApi.updateNotifications({
        receive_transaction_notification: receiveTx,
        receive_payment_proof_notification: receiveProof,
      });
      toast.success("Pengaturan notifikasi admin berhasil disimpan");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Setelan Notifikasi Admin
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Atur notifikasi instan yang dikirimkan ke nomor WhatsApp admin saat ada transaksi atau bukti transfer baru.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          className="flex items-center gap-1.5 self-start sm:self-auto text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan</span>
        </Button>
      </div>

      {/* WhatsApp Connection Status Card */}
      <Card className="border-[#6366F1]/20 bg-gradient-to-br from-white via-indigo-50/10 to-purple-50/20">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-[#6366F1] text-white flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#0A0A0A]">Gateway WhatsApp</span>
                <Badge
                  variant={waStatus?.is_logged_in ? "success" : "destructive"}
                  className="text-[10px]"
                >
                  {waStatus?.is_logged_in ? "Terhubung" : "Belum Terhubung"}
                </Badge>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-0.5">
                {waStatus?.is_logged_in
                  ? `Nomor bot aktif: ${waStatus.phone_number || "whatsmeow connected"}`
                  : "Perangkat WhatsApp bot belum dipindai QR code. Pengingat & outbox tidak dapat dikirim."}
              </p>
            </div>
          </div>

          <Link href="/admin/whatsapp">
            <Button variant="outline" size="sm" className="text-xs shrink-0 bg-white">
              <QrCode className="w-3.5 h-3.5 mr-1 text-[#6366F1]" />
              Kelola Perangkat WA
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Notification Preferences Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#6366F1]" />
            <span>Pilihan Notifikasi Transaksi</span>
          </CardTitle>
          <CardDescription>
            Notifikasi akan dikirimkan langsung ke nomor WhatsApp akun admin Anda saat kejadian berlangsung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-xs text-[#9C9C9C]">
              Memuat preferensi notifikasi...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Toggle 1: Transaksi Baru */}
              <div className="p-4 rounded-[8px] border border-[#E8E8EC] bg-white hover:border-zinc-300 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="receiveTxToggle"
                    className="font-bold text-xs sm:text-sm text-[#0A0A0A] cursor-pointer"
                  >
                    Notifikasi Transaksi Baru Dibuat
                  </label>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Kirim pesan WhatsApp ke admin saat ada pengguna yang melakukan checkout pembelian paket baru.
                  </p>
                </div>
                <input
                  id="receiveTxToggle"
                  type="checkbox"
                  checked={receiveTx}
                  onChange={(e) => setReceiveTx(e.target.checked)}
                  className="w-4 h-4 mt-1 rounded border-zinc-300 text-[#6366F1] focus:ring-[#6366F1] cursor-pointer"
                />
              </div>

              {/* Toggle 2: Bukti Transfer Diunggah */}
              <div className="p-4 rounded-[8px] border border-[#E8E8EC] bg-white hover:border-zinc-300 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label
                    htmlFor="receiveProofToggle"
                    className="font-bold text-xs sm:text-sm text-[#0A0A0A] cursor-pointer"
                  >
                    Notifikasi Unggahan Bukti Pembayaran
                  </label>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Kirim pesan WhatsApp instan saat pengguna mengunggah foto bukti transfer agar Anda dapat segera memverifikasi transaksi.
                  </p>
                </div>
                <input
                  id="receiveProofToggle"
                  type="checkbox"
                  checked={receiveProof}
                  onChange={(e) => setReceiveProof(e.target.checked)}
                  className="w-4 h-4 mt-1 rounded border-zinc-300 text-[#6366F1] focus:ring-[#6366F1] cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-[8px] bg-zinc-50 border border-zinc-200 text-xs text-[#6B6B6B] flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Sistem menggunakan antrean <strong>Persistent Outbox (SQLite)</strong> yang otomatis mengirimkan pesan dengan proteksi idempotency dan retry otomatis hingga 3 kali.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={saving}
                  className="font-bold text-xs shadow-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Simpan Pengaturan
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
