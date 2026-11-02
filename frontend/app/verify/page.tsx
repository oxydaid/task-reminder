"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, ArrowRight, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

function VerifyAccountPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      if (!token) {
        setError("Token verifikasi tidak ditemukan di tautan URL.");
        setLoading(false);
        return;
      }

      try {
        await api.post("/auth/verify", { token });
        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA]">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg text-[#0A0A0A]">
            <div className="w-8 h-8 rounded-[8px] bg-[#6366F1] flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span>Task Reminder</span>
          </Link>
          <p className="mt-2 text-xs text-[#6B6B6B]">Verifikasi Akun WhatsApp Anda</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Verifikasi Akun</CardTitle>
            <CardDescription>Status konfirmasi nomor WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-4 space-y-4">
            {loading ? (
              <div className="py-6 space-y-3">
                <RefreshCw className="w-8 h-8 text-[#6366F1] animate-spin mx-auto" />
                <p className="text-xs text-[#6B6B6B]">Memverifikasi akun Anda, harap tunggu...</p>
              </div>
            ) : success ? (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Akun Berhasil Diverifikasi!</h3>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Nomor WhatsApp Anda telah terverifikasi secara resmi. Notifikasi tugas kuliah akan otomatis dikirimkan ke nomor ini.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="primary" className="w-full text-xs font-bold">
                      <span>Masuk ke Akun Anda</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                  <XCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Verifikasi Gagal</h3>
                  <p className="text-xs text-red-600 leading-relaxed">{error}</p>
                </div>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="outline" className="w-full text-xs">
                      Kembali ke Halaman Masuk
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] text-xs text-[#9C9C9C]">
          Memverifikasi akun...
        </div>
      }
    >
      <VerifyAccountPageContent />
    </Suspense>
  );
}
