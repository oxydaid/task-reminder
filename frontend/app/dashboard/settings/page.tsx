"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  User as UserIcon,
  Lock,
  Bell,
  Smartphone,
  Shield,
  Clock,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { UserSettings, ReminderLog } from "@/types";
import { formatDateWIB } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Settings form state
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [offsetMinutes, setOffsetMinutes] = useState(2880);
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Pagination for logs
  const [currentLogsPage, setCurrentLogsPage] = useState(1);
  const LOGS_PER_PAGE = 6;
  const totalLogsPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE));

  const paginatedLogs = useMemo(() => {
    const start = (currentLogsPage - 1) * LOGS_PER_PAGE;
    return logs.slice(start, start + LOGS_PER_PAGE);
  }, [logs, currentLogsPage, LOGS_PER_PAGE]);

  // Parallel fetch per vercel react best practices
  const loadData = useCallback(async () => {
    try {
      const [settingsRes, logsRes] = await Promise.all([
        api.get<UserSettings>("/settings"),
        api.get<ReminderLog[]>("/notifications"),
      ]);
      setSettings(settingsRes);
      setReminderEnabled(settingsRes.reminder_enabled);
      setOffsetMinutes(settingsRes.default_reminder_offset_minutes || 2880);
      setTimezone(settingsRes.timezone || "Asia/Jakarta");
      setLogs(logsRes);
    } catch {
      toast.error("Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      loadData();
    }
  }, [user, authLoading, router, loadData]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Password saat ini wajib diisi");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password baru minimal 6 karakter");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password baru tidak cocok");
      return;
    }

    setPwdLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password berhasil diubah!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah password");
    } finally {
      setPwdLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      await api.put("/settings", {
        reminder_enabled: reminderEnabled,
        default_reminder_offset_minutes: Number(offsetMinutes),
        timezone,
      });
      toast.success("Pengaturan pengingat berhasil disimpan!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pengaturan");
    } finally {
      setSettingsLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex justify-center text-sm text-[#9C9C9C]">
        Memuat pengaturan...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Pengaturan</h1>
        <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
          Kelola profil pengguna, preferensi WhatsApp, dan riwayat notifikasi.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-[#6366F1]" />
              <CardTitle>Profil Mahasiswa</CardTitle>
            </div>
            <CardDescription>Informasi akun terdaftar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <span className="text-[#6B6B6B] block mb-1">Nama Lengkap</span>
              <span className="font-semibold text-sm text-[#0A0A0A]">{user?.name}</span>
            </div>

            <div>
              <span className="text-[#6B6B6B] block mb-1">Nomor WhatsApp Penerima</span>
              <div className="flex items-center gap-2 flex-wrap">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-sm text-[#0A0A0A]">
                  {user?.whatsapp_number}
                </span>
                <Badge variant="success" className="text-[10px]">Aktif</Badge>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-t border-[#E8E8EC]">
              <span className="text-[#6B6B6B]">Role Akun</span>
              <Badge variant="outline" className="uppercase font-mono text-[10px] w-fit">
                {user?.role}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="text-[#6B6B6B]">Tanggal Bergabung</span>
              <span className="text-[#0A0A0A] font-medium">
                {user?.created_at ? formatDateWIB(user.created_at) : "-"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#6366F1]" />
              <CardTitle>Ubah Password</CardTitle>
            </div>
            <CardDescription>Gunakan password yang aman</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#6B6B6B] mb-1">Password Saat Ini</label>
                <Input
                  type="password"
                  placeholder="Masukkan password lama"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#6B6B6B] mb-1">Password Baru</label>
                <Input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-[#6B6B6B] mb-1">Konfirmasi Password Baru</label>
                <Input
                  type="password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" size="sm" className="w-full" isLoading={pwdLoading}>
                  Simpan Password Baru
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Reminder Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#6366F1]" />
            <CardTitle>Preferensi Pengingat WhatsApp</CardTitle>
          </div>
          <CardDescription>
            Atur kapan dan bagaimana bot WhatsApp mengingatkan tenggat tugas Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSettingsSubmit} className="space-y-5 text-xs">
            <div className="flex items-center justify-between p-3 rounded-[8px] bg-zinc-50 border border-[#E8E8EC]">
              <div>
                <span className="font-semibold text-sm text-[#0A0A0A] block">
                  Aktifkan Pengingat Otomatis
                </span>
                <span className="text-[#6B6B6B] text-xs">
                  Bot WhatsApp akan otomatis mengirimkan rincian tugas saat mendekati deadline.
                </span>
              </div>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-5 h-5 rounded text-[#6366F1] cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-[#0A0A0A] mb-1">
                  Waktu Pengingat Default
                </label>
                <Select
                  value={offsetMinutes}
                  onChange={(e) => setOffsetMinutes(Number(e.target.value))}
                  className="h-9 text-xs"
                >
                  <option value={1440}>1 hari sebelum (H-1)</option>
                  <option value={2880}>2 hari sebelum (H-2 / Standar)</option>
                  <option value={4320}>3 hari sebelum (H-3)</option>
                  <option value={720}>12 jam sebelum</option>
                </Select>
                <span className="text-[11px] text-[#9C9C9C] mt-1 block">
                  Dapat diubah secara terpisah per masing-masing tugas
                </span>
              </div>

              <div>
                <label className="block font-medium text-[#0A0A0A] mb-1">Zona Waktu</label>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="Asia/Jakarta">WIB — Asia/Jakarta (UTC+7)</option>
                  <option value="Asia/Makassar">WITA — Asia/Makassar (UTC+8)</option>
                  <option value="Asia/Jayapura">WIT — Asia/Jayapura (UTC+9)</option>
                </Select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" size="sm" isLoading={settingsLoading}>
                Simpan Preferensi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Notification Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#6366F1]" />
            <CardTitle>Riwayat Notifikasi WhatsApp</CardTitle>
          </div>
          <CardDescription>Daftar pesan pengingat yang telah diproses oleh bot</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#9C9C9C]">
              Belum ada riwayat pengingat yang dikirim.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E8EC]">
              {paginatedLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0A0A0A] truncate">{log.task_title}</div>
                    <div className="text-[#6B6B6B] text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                      {log.course_name ? <span>{log.course_name} •</span> : null}
                      <span>Pengingat H-{Math.round(log.offset_minutes / 1440)}</span>
                      <span className="text-[#9C9C9C] sm:hidden">• {log.sent_at ? formatDateWIB(log.sent_at) : formatDateWIB(log.scheduled_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {log.status === "sent" ? (
                      <Badge variant="success" className="flex items-center gap-1 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Terkirim
                      </Badge>
                    ) : log.status === "failed" ? (
                      <Badge variant="error" className="flex items-center gap-1 text-[10px]" title={log.last_error}>
                        <XCircle className="w-3 h-3" />
                        Gagal
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3" />
                        Menunggu
                      </Badge>
                    )}

                    <span className="text-[11px] text-[#9C9C9C] hidden sm:inline whitespace-nowrap">
                      {log.sent_at ? formatDateWIB(log.sent_at) : formatDateWIB(log.scheduled_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentLogsPage}
            totalPages={totalLogsPages}
            totalItems={logs.length}
            itemsPerPage={LOGS_PER_PAGE}
            onPageChange={setCurrentLogsPage}
            itemName="riwayat"
            className="mt-4"
          />
        </CardContent>
      </Card>
    </div>
  );
}
