"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  History,
  Layers,
  BookOpen,
  CheckSquare,
  Bell,
  RefreshCw,
  Info,
} from "lucide-react";
import { subscriptionsApi, transactionsApi } from "@/lib/api";
import { UserUsage, Transaction } from "@/types";
import { formatDateOnly, formatDateWIB, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function SubscriptionPage() {
  const [usage, setUsage] = useState<UserUsage | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [pendingTx, setPendingTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Downgrade selector modal state
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState<boolean>(false);
  const [downgradeData, setDowngradeData] = useState<{
    plan_name: string;
    notification_limit: number;
    tasks: { id: string; title: string; reminder_enabled: boolean; deadline_at: string }[];
  } | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [savingSelection, setSavingSelection] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [uData, hData, txData] = await Promise.all([
        subscriptionsApi.getCurrent(),
        subscriptionsApi.getHistory(),
        transactionsApi.list().catch(() => []),
      ]);
      setUsage(uData);
      setHistory(hData || []);

      const foundPending = (txData || []).find(
        (t) =>
          t.status === "pending_payment" ||
          t.status === "waiting_verification" ||
          t.status === "rejected"
      );
      setPendingTx(foundPending || null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat status langganan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openDowngradeSelector = async () => {
    try {
      const res = await subscriptionsApi.getDowngradeStatus();
      if (res) {
        setDowngradeData(res);
        const currentlyActive = res.tasks.filter((t) => t.reminder_enabled).map((t) => t.id);
        setSelectedTaskIds(currentlyActive.slice(0, res.notification_limit));
        setIsDowngradeModalOpen(true);
      }
    } catch (err: any) {
      alert(err.message || "Gagal memuat daftar pengingat tugas");
    }
  };

  const handleToggleTask = (taskId: string) => {
    if (!downgradeData) return;
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter((id) => id !== taskId));
    } else {
      if (selectedTaskIds.length >= downgradeData.notification_limit) {
        alert(`Batas maksimal pengingat untuk paket ${downgradeData.plan_name} adalah ${downgradeData.notification_limit} tugas.`);
        return;
      }
      setSelectedTaskIds([...selectedTaskIds, taskId]);
    }
  };

  const handleSaveActiveReminders = async () => {
    try {
      setSavingSelection(true);
      await subscriptionsApi.selectActiveReminders(selectedTaskIds);
      setIsDowngradeModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan pengingat aktif");
    } finally {
      setSavingSelection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-sm text-[#9C9C9C]">
        Memuat informasi langganan...
      </div>
    );
  }

  const plan = usage?.active_plan;
  const sub = usage?.subscription;
  const isPaidOrTrial = sub?.subscription_type === "paid" || sub?.subscription_type === "trial";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Paket & Langganan</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Kelola paket langganan, batas kuota tugas, dan riwayat pembayaran Anda.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/pricing">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-xs text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{plan?.price === 0 ? "Upgrade Paket" : "Perpanjang / Ganti Paket"}</span>
            </Button>
          </Link>
          <Link href="/dashboard/transactions">
            <Button variant="outline" size="sm" className="text-xs font-medium">
              Riwayat Transaksi
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="p-4 rounded-[8px] bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="xs" onClick={loadData}>
            Coba Lagi
          </Button>
        </div>
      ) : null}

      {/* Pending / Active Transaction Notice */}
      {pendingTx ? (
        <div
          className={`p-4 rounded-[10px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
            pendingTx.status === "rejected"
              ? "bg-red-50 border-red-200 text-red-950"
              : pendingTx.status === "waiting_verification"
              ? "bg-blue-50 border-blue-200 text-blue-950"
              : "bg-amber-50 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex items-start gap-3">
            {pendingTx.status === "rejected" ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : pendingTx.status === "waiting_verification" ? (
              <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold text-sm">
                {pendingTx.status === "rejected"
                  ? `Bukti Pembayaran Ditolak: Paket ${pendingTx.plan_name} (#${pendingTx.code})`
                  : pendingTx.status === "waiting_verification"
                  ? `Menunggu Verifikasi Admin: Paket ${pendingTx.plan_name} (#${pendingTx.code})`
                  : `Transaksi Menunggu Pembayaran: Paket ${pendingTx.plan_name} (#${pendingTx.code})`}
              </div>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                {pendingTx.status === "rejected"
                  ? `Catatan admin: "${pendingTx.rejection_reason || "Bukti transfer tidak sesuai"}". Harap unggah ulang bukti yang benar.`
                  : pendingTx.status === "waiting_verification"
                  ? `Total tagihan ${formatRupiah(pendingTx.total_amount)}. Foto bukti transfer Anda sedang diverifikasi oleh admin.`
                  : `Total tagihan ${formatRupiah(pendingTx.total_amount)} via ${pendingTx.payment_method_name}. Harap selesaikan pembayaran & unggah bukti transfer.`}
              </p>
            </div>
          </div>

          <Link href={`/dashboard/transactions?id=${pendingTx.id}`} className="shrink-0 w-full sm:w-auto">
            <Button
              size="sm"
              variant={pendingTx.status === "rejected" ? "destructive" : "primary"}
              className="w-full sm:w-auto font-semibold text-xs h-8 shadow-xs"
            >
              {pendingTx.status === "rejected"
                ? "Unggah Ulang Bukti"
                : pendingTx.status === "waiting_verification"
                ? "Lihat Detail Transaksi"
                : "Bayar & Unggah Bukti"}
            </Button>
          </Link>
        </div>
      ) : null}

      {/* Over limit warning notice */}
      {usage?.is_over_limit ? (
        <div className="p-4 rounded-[10px] bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pengingat tugas melebihi kuota paket aktif!</span>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Anda memiliki tugas aktif dengan notifikasi lebih dari batas paket {plan?.name} ({plan?.notification_limit} notifikasi). Silakan pilih tugas mana yang ingin dipertahankan pengingatnya agar tidak melewatkan tugas penting.
              </p>
            </div>
          </div>
          <Button
            size="xs"
            variant="outline"
            onClick={openDowngradeSelector}
            className="shrink-0 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 font-semibold"
          >
            Atur Pengingat Aktif
          </Button>
        </div>
      ) : null}

      {/* Plan Overview Hero Card */}
      <Card className="p-0 overflow-hidden border-[#6366F1]/20 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/30">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={isPaidOrTrial ? "primary" : "secondary"}
                  className="uppercase text-[10px] font-bold tracking-wider"
                >
                  {sub?.subscription_type === "trial"
                    ? "Masa Trial"
                    : isPaidOrTrial
                    ? "Paket Berbayar"
                    : "Paket Gratis"}
                </Badge>
                {sub?.status === "active" ? (
                  <Badge variant="success" className="text-[10px]">
                    Aktif
                  </Badge>
                ) : sub?.status === "trialing" ? (
                  <Badge variant="warning" className="text-[10px]">
                    Trial Aktif
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    Kedaluwarsa
                  </Badge>
                )}
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
                  Paket {plan?.name}
                </h2>
                <p className="text-xs text-[#6B6B6B] mt-1 max-w-xl">{plan?.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[#6B6B6B] pt-1">
                <div className="flex items-center gap-1.5 font-medium text-[#0A0A0A]">
                  <span>Harga:</span>
                  <span className="font-bold text-[#6366F1]">
                    {plan?.price === 0 ? "Rp 0 (Gratis Selamanya)" : `${formatRupiah(plan?.price || 0)} / bulan`}
                  </span>
                </div>

                {sub?.expires_at ? (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#6B6B6B]" />
                    <span>
                      Berlaku hingga: <strong>{formatDateOnly(sub.expires_at)}</strong>
                      {usage?.days_remaining ? ` (${usage.days_remaining} hari lagi)` : ""}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tanpa batas masa aktif</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full sm:w-auto">
              <Link href="/pricing" className="w-full">
                <Button className="w-full font-bold text-xs">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Upgrade Kuota
                </Button>
              </Link>
              {usage?.is_over_limit ? (
                <Button variant="outline" size="sm" onClick={openDowngradeSelector} className="text-xs w-full">
                  Atur Pengingat Aktif
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      {/* Quota Progress Overview (3 Grid Items) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Mata Kuliah */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B6B] mb-2">
            <span className="flex items-center gap-1.5 text-[#0A0A0A]">
              <BookOpen className="w-4 h-4 text-[#6366F1]" />
              Mata Kuliah
            </span>
            <span>
              {usage?.course_count} / {usage?.course_limit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage?.course_count || 0) >= (usage?.course_limit || 1)
                  ? "bg-amber-500"
                  : "bg-[#6366F1]"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((usage?.course_count || 0) / (usage?.course_limit || 1)) * 100)
                )}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-[#9C9C9C] mt-2">
            {(usage?.course_limit || 0) - (usage?.course_count || 0) > 0
              ? `Tersisa ${(usage?.course_limit || 0) - (usage?.course_count || 0)} slot mata kuliah`
              : "Batas mata kuliah tercapai"}
          </p>
        </Card>

        {/* Tugas Kuliah */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B6B] mb-2">
            <span className="flex items-center gap-1.5 text-[#0A0A0A]">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Tugas Aktif
            </span>
            <span>
              {usage?.task_count} / {usage?.task_limit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage?.task_count || 0) >= (usage?.task_limit || 1)
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((usage?.task_count || 0) / (usage?.task_limit || 1)) * 100)
                )}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-[#9C9C9C] mt-2">
            {(usage?.task_limit || 0) - (usage?.task_count || 0) > 0
              ? `Tersisa ${(usage?.task_limit || 0) - (usage?.task_count || 0)} slot tugas baru`
              : "Batas tugas paket tercapai"}
          </p>
        </Card>

        {/* Notifikasi WhatsApp */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6B6B6B] mb-2">
            <span className="flex items-center gap-1.5 text-[#0A0A0A]">
              <Bell className="w-4 h-4 text-purple-600" />
              Pengingat WhatsApp
            </span>
            <span>
              {usage?.notification_count} / {usage?.notification_limit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                (usage?.notification_count || 0) > (usage?.notification_limit || 1)
                  ? "bg-red-500"
                  : (usage?.notification_count || 0) === (usage?.notification_limit || 1)
                  ? "bg-amber-500"
                  : "bg-purple-600"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(((usage?.notification_count || 0) / (usage?.notification_limit || 1)) * 100)
                )}%`,
              }}
            />
          </div>
          <p className="text-[11px] text-[#9C9C9C] mt-2">
            {(usage?.notification_count || 0) > (usage?.notification_limit || 1)
              ? "Melebihi kuota! Atur pengingat aktif"
              : `Maksimal ${usage?.notification_limit} tugas berpengingat`}
          </p>
        </Card>
      </div>

      {/* Subscription History Table (Full-bleed Card, No wrapping) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8E8EC] bg-white">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#6366F1]" />
            <h3 className="text-sm font-bold text-[#0A0A0A]">Riwayat Paket Langganan</h3>
          </div>
          <p className="text-xs text-[#6B6B6B] mt-0.5">
            Catatan seluruh paket langganan yang pernah aktif pada akun Anda.
          </p>
        </div>

        {!history.length ? (
          <div className="text-center py-10 text-xs text-[#9C9C9C]">
            Belum ada riwayat langganan sebelumnya.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-zinc-50 border-b border-[#E8E8EC] text-[#6B6B6B] font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Paket</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Mulai</th>
                    <th className="py-3 px-5">Berakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {history.map((h) => {
                    const isCur = h.id === sub?.id;
                    return (
                      <tr key={h.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-[#0A0A0A]">
                          Paket {h.plan?.name || "Standard"}
                          {isCur ? (
                            <span className="ml-2 text-[10px] bg-indigo-50 text-[#6366F1] px-1.5 py-0.5 rounded-[4px] font-bold">
                              Saat ini
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-4 capitalize text-[#6B6B6B]">{h.subscription_type}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              h.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : h.status === "trialing"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-zinc-100 text-[#6B6B6B]"
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#6B6B6B] font-mono">{formatDateOnly(h.started_at)}</td>
                        <td className="py-3.5 px-5 text-[#6B6B6B] font-mono">{formatDateOnly(h.expires_at) || "Permanen"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-[#E8E8EC]">
              {history.map((h) => {
                const isCur = h.id === sub?.id;
                return (
                  <div key={h.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#0A0A0A]">
                        <span>Paket {h.plan?.name || "Standard"}</span>
                        {isCur ? (
                          <span className="text-[10px] bg-indigo-50 text-[#6366F1] px-1.5 py-0.5 rounded-[4px] font-bold">
                            Saat ini
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          h.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : h.status === "trialing"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-zinc-100 text-[#6B6B6B]"
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#6B6B6B] flex items-center justify-between">
                      <span className="capitalize">{h.subscription_type}</span>
                      <span className="font-mono text-[10px]">
                        {formatDateOnly(h.started_at)} s/d {formatDateOnly(h.expires_at) || "Permanen"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Downgrade Selector Dialog */}
      <Dialog open={isDowngradeModalOpen} onOpenChange={setIsDowngradeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#6366F1]" />
              Pilih Pengingat Tugas Aktif
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paket <strong>{downgradeData?.plan_name}</strong> hanya mengizinkan maksimal{" "}
              <strong>{downgradeData?.notification_limit} tugas</strong> dengan pengingat WhatsApp aktif. Silakan pilih tugas yang paling prioritas:
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {downgradeData?.tasks.map((task) => {
              const isChecked = selectedTaskIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => handleToggleTask(task.id)}
                  className={`p-3 rounded-[8px] border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? "border-[#6366F1] bg-indigo-50/40 text-[#0A0A0A]"
                      : "border-[#E8E8EC] hover:border-zinc-300 text-[#6B6B6B]"
                  }`}
                >
                  <div>
                    <div className="font-semibold">{task.title}</div>
                    <div className="text-[10px] text-[#9C9C9C] mt-0.5">
                      Deadline: {formatDateWIB(task.deadline_at)}
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isChecked ? "border-[#6366F1] bg-[#6366F1] text-white" : "border-zinc-300"
                    }`}
                  >
                    {isChecked ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <span className="text-xs text-[#6B6B6B]">
              Terpilih: <strong>{selectedTaskIds.length}</strong> / {downgradeData?.notification_limit}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsDowngradeModalOpen(false)}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveActiveReminders}
                isLoading={savingSelection}
              >
                Simpan Pilihan
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
