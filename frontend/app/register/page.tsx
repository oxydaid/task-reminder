"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Smartphone, User, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama lengkap wajib diisi");
      return;
    }
    if (!phone.trim()) {
      setError("Nomor WhatsApp wajib diisi");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);
    try {
      await register(name, phone, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Gagal mendaftar. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#FAFAFA]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg text-[#0A0A0A]">
            <div className="w-8 h-8 rounded-[8px] bg-[#6366F1] flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span>Task Reminder</span>
          </Link>
          <p className="mt-2 text-xs text-[#6B6B6B]">Daftar gratis untuk mulai mengatur pengingat tugas</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buat Akun Baru</CardTitle>
            <CardDescription>Cukup nomor WhatsApp dan password</CardDescription>
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
                  Nama Lengkap
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                  <Input
                    type="text"
                    placeholder="Contoh: Budi Pratama"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
              </div>

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
                <span className="text-[11px] text-[#9C9C9C] mt-1 block">
                  Format: 08xx, +62xx, atau 62xx
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0A0A0A] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#9C9C9C]" />
                  <Input
                    type="password"
                    placeholder="Minimal 6 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" isLoading={loading}>
                Daftar Akun
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-[#E8E8EC] text-center text-xs text-[#6B6B6B]">
              Sudah memiliki akun?{" "}
              <Link href="/login" className="font-semibold text-[#6366F1] hover:underline">
                Masuk di sini
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
