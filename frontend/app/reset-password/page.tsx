"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, Lock, AlertCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Token reset password tidak valid atau tidak ditemukan di tautan URL.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password baru minimal harus 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password tidak cocok dengan password baru.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Gagal mengatur ulang kata sandi. Token mungkin sudah kedaluwarsa.");
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
          <p className="mt-2 text-xs text-[#6B6B6B]">Atur Ulang Kata Sandi Akun</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>
              Buat password baru yang aman untuk akun Task Reminder Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-4 p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[#0A0A0A]">Password Berhasil Diperbarui!</h3>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">
                    Silakan masuk kembali dengan nomor WhatsApp Anda dan kata sandi baru yang telah dibuat.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="primary" className="w-full text-xs font-bold">
                      <span>Masuk Sekarang</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : !token ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-red-600">
                  Tautan tidak valid. Harap gunakan tautan reset password lengkap yang dikirimkan ke WhatsApp Anda.
                </p>
                <Link href="/forgot-password">
                  <Button variant="outline" size="sm" className="text-xs">
                    Minta Tautan Baru
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                    <Input
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-9"
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                    <Input
                      type="password"
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full font-bold text-xs" isLoading={loading}>
                  Simpan Password Baru
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA] text-xs text-[#9C9C9C]">
          Menyiapkan halaman reset password...
        </div>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  );
}
