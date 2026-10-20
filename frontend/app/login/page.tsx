"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Smartphone, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Nomor WhatsApp wajib diisi");
      return;
    }
    if (!password) {
      setError("Password wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await login(phone, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Gagal masuk. Periksa nomor WhatsApp dan password Anda.");
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
          <p className="mt-2 text-xs text-[#6B6B6B]">Masuk ke akun Anda untuk memantau tugas kuliah</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Masuk Akun</CardTitle>
            <CardDescription>Gunakan nomor WhatsApp terdaftar</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="mb-4 p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                  Nomor WhatsApp
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

              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                  <Input
                    type="password"
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" isLoading={loading}>
                Masuk
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#E8E8EC] text-center text-xs text-[#6B6B6B]">
              Belum punya akun?{" "}
              <Link href="/register" className="font-semibold text-[#6366F1] hover:underline">
                Daftar Sekarang
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
