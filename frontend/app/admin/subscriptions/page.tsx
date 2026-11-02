"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Search,
  RefreshCw,
  Gift,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Layers,
  Calendar,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { adminSubscriptionsApi, api } from "@/lib/api";
import { Plan, User } from "@/types";
import { formatDateOnly, formatDateWIB, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface SubItem {
  id: string;
  user_id: string;
  user_name: string;
  whatsapp_number: string;
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  plan_price: number;
  status: string;
  subscription_type: string;
  started_at: string;
  expires_at?: string | null;
  activated_at: string;
  created_at: string;
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubItem[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Modal: Grant Trial or Manual Activation
  const [modalMode, setModalMode] = useState<"trial" | "activate" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [duration, setDuration] = useState<number>(7); // days for trial, months for activate
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal: Cancel Subscription
  const [cancelSubItem, setCancelSubItem] = useState<SubItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelling, setCancelling] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subsRes, plansRes, usersRes] = await Promise.all([
        adminSubscriptionsApi.list({
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        api.get<Plan[]>("/admin/plans"),
        api.get<User[]>("/admin/users"),
      ]);
      setSubscriptions(subsRes || []);
      setPlans(plansRes || []);
      setUsers(usersRes || []);
    } catch {
      toast.error("Gagal memuat data langganan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const filteredSubscriptions = useMemo(() => {
    if (!search.trim()) return subscriptions;
    const q = search.toLowerCase();
    return subscriptions.filter(
      (s) =>
        s.user_name.toLowerCase().includes(q) ||
        s.whatsapp_number.includes(q) ||
        s.plan_name.toLowerCase().includes(q)
    );
  }, [subscriptions, search]);

  const openGrantTrial = (userId?: string) => {
    setModalMode("trial");
    setSelectedUserId(userId || (users.length > 0 ? users[0].id : ""));
    const paidPlans = plans.filter((p) => p.price > 0);
    setSelectedPlanId(paidPlans.length > 0 ? paidPlans[0].id : plans[0]?.id || "");
    setDuration(7);
    setReason("");
  };

  const openManualActivate = (userId?: string) => {
    setModalMode("activate");
    setSelectedUserId(userId || (users.length > 0 ? users[0].id : ""));
    const paidPlans = plans.filter((p) => p.price > 0);
    setSelectedPlanId(paidPlans.length > 0 ? paidPlans[0].id : plans[0]?.id || "");
    setDuration(1);
    setReason("");
  };

  const handleSubmitModal = async () => {
    if (!selectedUserId || !selectedPlanId) {
      toast.error("Pilih pengguna dan paket terlebih dahulu");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "trial") {
        await adminSubscriptionsApi.grantTrial(selectedUserId, {
          plan_id: selectedPlanId,
          duration_days: Number(duration),
          reason,
        });
        toast.success("Masa trial berhasil diberikan ke pengguna");
      } else {
        await adminSubscriptionsApi.activate(selectedUserId, {
          plan_id: selectedPlanId,
          duration_months: Number(duration),
          reason,
        });
        toast.success("Paket berhasil diaktifkan secara manual");
      }
      setModalMode(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses aksi langganan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelSubItem) return;
    setCancelling(true);
    try {
      await adminSubscriptionsApi.cancel(cancelSubItem.user_id, {
        reason: cancelReason || "Dibatalkan manual oleh admin",
      });
      toast.success("Langganan berhasil dibatalkan dan dikembalikan ke Free");
      setCancelSubItem(null);
      setCancelReason("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan langganan");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string, subType: string) => {
    if (status === "active") {
      return (
        <Badge variant="success" className="text-[10px]">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Aktif
        </Badge>
      );
    }
    if (status === "trialing") {
      return (
        <Badge variant="warning" className="text-[10px]">
          <Clock className="w-3 h-3 mr-1" />
          Trial
        </Badge>
      );
    }
    if (status === "cancelled") {
      return (
        <Badge variant="secondary" className="text-[10px]">
          Dibatalkan
        </Badge>
      );
    }
    if (status === "expired") {
      return (
        <Badge variant="destructive" className="text-[10px]">
          Kedaluwarsa
        </Badge>
      );
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">
            Kelola Langganan Pengguna
          </h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Pantau status paket aktif pengguna, berikan masa uji coba (trial), atau aktivasi manual.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openGrantTrial()}
            className="flex items-center gap-1.5 text-xs text-[#6366F1] border-indigo-200 hover:bg-indigo-50"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Beri Trial</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openManualActivate()}
            className="flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Aktivasi Manual</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[10px] border border-[#E8E8EC] shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: "all", label: "Semua" },
            { id: "active", label: "Aktif" },
            { id: "trialing", label: "Trial" },
            { id: "cancelled", label: "Dibatalkan" },
            { id: "expired", label: "Kedaluwarsa" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-[#6366F1] text-white font-semibold"
                  : "text-[#6B6B6B] hover:text-[#0A0A0A] hover:bg-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari user / nomor WA..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1]"
          />
        </div>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-16 text-xs text-[#9C9C9C]">
              Memuat data langganan...
            </div>
          ) : !filteredSubscriptions.length ? (
            <div className="text-center py-16 text-xs text-[#9C9C9C]">
              Tidak ada data langganan yang cocok.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8E8EC] text-[#6B6B6B] bg-zinc-50/50">
                    <th className="py-3 px-4 font-semibold">Pengguna</th>
                    <th className="py-3 px-4 font-semibold">Paket</th>
                    <th className="py-3 px-4 font-semibold">Tipe</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Masa Aktif</th>
                    <th className="py-3 px-4 font-semibold">Tanggal Mulai</th>
                    <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {filteredSubscriptions.map((sub) => {
                    const isRunning = sub.status === "active" || sub.status === "trialing";
                    return (
                      <tr key={sub.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#0A0A0A]">{sub.user_name}</div>
                          <div className="text-[11px] text-[#9C9C9C]">{sub.whatsapp_number}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#0A0A0A]">Paket {sub.plan_name}</div>
                          <div className="text-[11px] text-[#6B6B6B]">
                            {sub.plan_price === 0 ? "Gratis" : formatRupiah(sub.plan_price)}
                          </div>
                        </td>
                        <td className="py-3 px-4 capitalize text-[#6B6B6B]">
                          {sub.subscription_type}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(sub.status, sub.subscription_type)}</td>
                        <td className="py-3 px-4 text-[#6B6B6B]">
                          {sub.expires_at ? (
                            <span>Hingga {formatDateOnly(sub.expires_at)}</span>
                          ) : (
                            <span className="text-emerald-700 font-medium">Permanen (Free)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#9C9C9C]">{formatDateWIB(sub.started_at)}</td>
                        <td className="py-3 px-4 text-right">
                          {isRunning && sub.plan_price > 0 ? (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setCancelSubItem(sub)}
                              className="text-red-600 hover:bg-red-50 text-[11px]"
                            >
                              Cabut Paket
                            </Button>
                          ) : (
                            <span className="text-[11px] text-[#9C9C9C]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Grant Trial or Manual Activation */}
      <Dialog open={Boolean(modalMode)} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {modalMode === "trial" ? (
                <>
                  <Gift className="w-4 h-4 text-purple-600" />
                  <span>Beri Masa Uji Coba (Trial)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#6366F1]" />
                  <span>Aktivasi Paket Manual</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {modalMode === "trial"
                ? "Pengguna akan menerima notifikasi WhatsApp otomatis saat trial aktif."
                : "Aktifkan paket berbayar untuk pengguna tanpa melalui proses transfer manual."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* User Select */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">Pilih Pengguna:</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.whatsapp_number})
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Select */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">Pilih Paket:</label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - {formatRupiah(p.price)} ({p.course_limit} Matkul, {p.task_limit} Tugas)
                  </option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">
                {modalMode === "trial" ? "Durasi Trial (Hari):" : "Durasi Langganan (Bulan):"}
              </label>
              <input
                type="number"
                min="1"
                max={modalMode === "trial" ? "90" : "36"}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
              />
              <span className="text-[10px] text-[#9C9C9C]">
                {modalMode === "trial"
                  ? "Rekomendasi trial: 7 hari atau 14 hari."
                  : "Misal: 1 bulan, 3 bulan, atau 12 bulan (1 tahun)."}
              </span>
            </div>

            {/* Reason */}
            <div className="space-y-1">
              <label className="font-semibold text-[#0A0A0A]">Alasan / Catatan Admin:</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Misal: Promo pendaftaran awal semester / kompensasi"
                className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] bg-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalMode(null)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitModal}
              isLoading={submitting}
              className="font-bold text-xs"
            >
              {modalMode === "trial" ? "Beri Trial Sekarang" : "Aktifkan Paket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Cancel Subscription */}
      <Dialog open={Boolean(cancelSubItem)} onOpenChange={(open) => !open && setCancelSubItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Cabut Langganan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Apakah Anda yakin ingin mencabut paket{" "}
              <strong>{cancelSubItem?.plan_name}</strong> untuk pengguna{" "}
              <strong>{cancelSubItem?.user_name}</strong>? Akun pengguna akan otomatis dikembalikan ke paket Free.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs space-y-1">
            <label className="font-semibold text-[#0A0A0A]">Alasan Pencabutan (Opsional):</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Misal: Permintaan pembatalan / salah transfer"
              className="w-full px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-red-500 text-xs"
            />
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelSubItem(null)}
              disabled={cancelling}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              isLoading={cancelling}
              className="font-bold text-xs"
            >
              Konfirmasi Cabut
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
