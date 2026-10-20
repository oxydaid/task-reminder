"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  QrCode,
  Smartphone,
  RefreshCw,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { WhatsAppStatus } from "@/types";
import { formatDateWIB } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminWhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get<WhatsAppStatus>("/admin/whatsapp/status");
      setStatus(data);
      return data;
    } catch {
      toast.error("Gagal memeriksa status koneksi WhatsApp");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadStatus]);

  // Polling for status when QR code is active
  useEffect(() => {
    if (status?.qr_code && !status.is_logged_in) {
      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(async () => {
          const res = await loadStatus();
          if (res?.is_logged_in) {
            toast.success("WhatsApp bot berhasil terhubung!");
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        }, 3000);
      }
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [status?.qr_code, status?.is_logged_in, loadStatus]);

  const handleStartPairing = async () => {
    setPairingLoading(true);
    try {
      const res = await api.post<WhatsAppStatus>("/admin/whatsapp/pair");
      setStatus(res);
      toast.info("Kode QR pairing berhasil di-generate. Silakan pindai melalui WhatsApp.");
    } catch (err: any) {
      toast.error(err.message || "Gagal memulai pairing WhatsApp");
    } finally {
      setPairingLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await api.post("/admin/whatsapp/logout");
      toast.success("Sesi WhatsApp bot telah diputus.");
      loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Gagal logout WhatsApp");
    } finally {
      setLogoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memeriksa gateway WhatsApp...
      </div>
    );
  }

  const isConnected = status?.is_logged_in;

  return (
    <div className="space-y-6 pb-28 md:pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
          WhatsApp Gateway & Pairing
        </h1>
        <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
          Koneksi akun WhatsApp pengirim (whatsmeow) untuk seluruh notifikasi pengingat otomatis.
        </p>
      </div>

      {/* Status banner */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 ${
                isConnected ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
              }`}
            >
              <Smartphone className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#0A0A0A]">Status Gateway:</span>
                {isConnected ? (
                  <Badge variant="success" className="text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Terhubung (Online)
                  </Badge>
                ) : (
                  <Badge variant="error" className="text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    Terputus / Belum Login
                  </Badge>
                )}
              </div>

              <div className="text-xs text-[#6B6B6B] mt-1">
                {isConnected ? (
                  <span>
                    Nomor WhatsApp Pengirim: <strong className="text-[#0A0A0A]">+{status?.phone_number}</strong>
                    {status?.last_connected ? ` • Terhubung sejak ${formatDateWIB(status.last_connected)}` : ""}
                  </span>
                ) : (
                  <span>Bot belum terhubung dengan akun WhatsApp apa pun. Klik "Pair WhatsApp" untuk memunculkan QR Code.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => loadStatus()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Refresh
            </Button>

            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                isLoading={logoutLoading}
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Putus Sesi
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStartPairing}
                isLoading={pairingLoading}
              >
                <QrCode className="w-3.5 h-3.5 mr-1" />
                Pair WhatsApp Sekarang
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* QR Code Scanner Section */}
      {!isConnected ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* QR Display Card */}
          <Card className="flex flex-col items-center justify-center p-8 text-center min-h-[380px] h-full">
            {status?.qr_code_image ? (
              <div>
                <div className="p-3 bg-white border border-[#E8E8EC] rounded-[12px] shadow-sm inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={status.qr_code_image}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#6B6B6B]">
                  <span className="w-2 h-2 rounded-full bg-[#6366F1] animate-ping" />
                  Menunggu pemindaian dari WhatsApp smartphone...
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-[#6366F1] mb-3">
                  <QrCode className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-sm text-[#0A0A0A]">Kode QR Belum Di-generate</h3>
                <p className="text-xs text-[#6B6B6B] mt-1 max-w-xs mx-auto">
                  Klik tombol <strong>"Pair WhatsApp Sekarang"</strong> di atas untuk membuat kode QR baru.
                </p>
                <div className="mt-4">
                  <Button size="sm" onClick={handleStartPairing} isLoading={pairingLoading}>
                    Generate QR Code
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Instructions Card */}
          <Card className="flex flex-col justify-between p-6 h-full">
            <div>
              <h3 className="font-bold text-base text-[#0A0A0A] mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#6366F1]" />
                Petunjuk Menautkan Perangkat
              </h3>

              <ol className="space-y-3 text-xs text-[#6B6B6B] list-decimal list-inside leading-relaxed">
                <li>Buka aplikasi <strong>WhatsApp</strong> di smartphone Anda.</li>
                <li>
                  Ketuk <strong>Menu</strong> (ikon titik tiga di Android) atau{" "}
                  <strong>Pengaturan / Settings</strong> (di iPhone).
                </li>
                <li>
                  Pilih menu <strong>"Perangkat Tertaut" (Linked Devices)</strong>.
                </li>
                <li>
                  Ketuk <strong>"Tautkan Perangkat" (Link a Device)</strong> dan arahkan kamera Anda ke kode QR yang muncul.
                </li>
                <li>
                  Tunggu hingga status berubah menjadi <strong>Terhubung (Online)</strong>.
                </li>
              </ol>

              <div className="mt-6 p-3 rounded-[8px] bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Catatan Keamanan:</strong> Nomor bot ini digunakan untuk mengirim pengingat kepada seluruh mahasiswa. Pastikan nomor yang ditautkan adalah nomor khusus bot atau server aplikasi.
              </div>
            </div>

            <div className="mt-6 pt-3 border-t border-[#E8E8EC] text-[11px] text-[#9C9C9C]">
              Sesi login disimpan persisten di SQLite (<code>WHATSAPP_STORE_PATH</code>) sehingga tidak perlu pairing ulang setiap kali server restart.
            </div>
          </Card>
        </div>
      ) : (
        <Card className="p-6 bg-emerald-50/30 border-emerald-200">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <h3 className="font-bold text-sm text-emerald-950 mb-1">
                WhatsApp Bot Beroperasi Normal
              </h3>
              <p className="text-emerald-800">
                Bot whatsmeow aktif dan siap mengirimkan pesan pengingat otomatis ke nomor WhatsApp mahasiswa sesuai jadwal deadline tugas. Sesi tersimpan secara aman dan persisten di database SQLite.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
