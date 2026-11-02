"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Smartphone, AlertCircle, ArrowLeft, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Nomor WhatsApp wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { whatsapp_number: phone });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengirim permintaan reset password");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="mt-2 text-xs text-[#6B6B6B]">Pemulihan Akses Akun Anda</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lupa Password</CardTitle>
            <CardDescription>
              Masukkan nomor WhatsApp yang terdaftar untuk menerima tautan pemulihan kata sandi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-4 p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {submitted ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Tautan Telah Dikirim!</h3>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Jika nomor <strong>{phone}</strong> terdaftar, kami telah mengirimkan instruksi dan tautan reset password langsung ke WhatsApp Anda.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="outline" className="w-full text-xs">
                      Kembali ke Halaman Masuk
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Nomor WhatsApp Terdaftar
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                    <Input
                      type="tel"
                      placeholder="Contoh: 08123456789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-9"
                      disabled={loading}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full font-bold text-xs" isLoading={loading}>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Kirim Tautan Reset
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Halaman Masuk</span>
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
