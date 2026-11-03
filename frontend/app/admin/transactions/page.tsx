"use client";

import { useEffect, useState } from "react";
import {
  ReceiptText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Eye,
  AlertCircle,
  Check,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";
import { adminTransactionsApi } from "@/lib/api";
import { Transaction } from "@/types";
import { formatDateWIB, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Detail Modal
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Approval / Rejection states
  const [approvalNotes, setApprovalNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>("");

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await adminTransactionsApi.list({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery || undefined,
      });
      setTransactions(res || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTransactions();
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setActionError("");
      setIsRejecting(false);
      setApprovalNotes("");
      setRejectionReason("");
      const tx = await adminTransactionsApi.getById(id);
      setSelectedTx(tx);
    } catch (err: any) {
      alert(err.message || "Gagal memuat detail transaksi");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTx) return;
    setProcessing(true);
    setActionError("");

    try {
      await adminTransactionsApi.approve(selectedTx.id, { notes: approvalNotes });
      await openDetail(selectedTx.id);
      await loadTransactions();
      alert(`Transaksi #${selectedTx.code} berhasil disetujui! Paket pengguna telah aktif.`);
    } catch (err: any) {
      setActionError(err.message || "Gagal menyetujui transaksi");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTx) return;
    if (!rejectionReason.trim()) {
      setActionError("Alasan penolakan pembayaran wajib diisi.");
      return;
    }

    setProcessing(true);
    setActionError("");

    try {
      await adminTransactionsApi.reject(selectedTx.id, { reason: rejectionReason });
      await openDetail(selectedTx.id);
      await loadTransactions();
      setIsRejecting(false);
      alert(`Transaksi #${selectedTx.code} ditolak. Notifikasi telah dikirim ke WhatsApp pengguna.`);
    } catch (err: any) {
      setActionError(err.message || "Gagal menolak transaksi");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_payment":
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Bayar
          </Badge>
        );
      case "waiting_verification":
        return (
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px] font-bold animate-pulse">
            <Clock className="w-3 h-3 mr-1" />
            Perlu Verifikasi
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Lunas (Disetujui)
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="w-3 h-3 mr-1" />
            Ditolak
          </Badge>
        );
      case "cancelled":
        return <Badge variant="secondary" className="text-[10px]">Dibatalkan</Badge>;
      case "expired":
        return <Badge variant="secondary" className="text-[10px]">Kedaluwarsa</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Kelola Transaksi</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Verifikasi bukti transfer manual dan pantau riwayat pembayaran pelanggan.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTransactions} className="flex items-center gap-1.5 self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Segarkan</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[10px] border border-[#E8E8EC] shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: "all", label: "Semua" },
            { id: "waiting_verification", label: "Perlu Verifikasi" },
            { id: "pending_payment", label: "Menunggu Bayar" },
            { id: "paid", label: "Lunas" },
            { id: "rejected", label: "Ditolak" },
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

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode / nama / WA..."
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1]"
          />
        </form>
      </div>

      {/* Transactions Table Card (Full-bleed Card) */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-xs text-[#9C9C9C]">
            Memuat data transaksi...
          </div>
        ) : !transactions.length ? (
          <div className="text-center py-16 text-xs text-[#9C9C9C]">
            Tidak ada data transaksi yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-zinc-50 border-b border-[#E8E8EC] text-[#6B6B6B] font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-5">Kode</th>
                  <th className="py-3 px-4">Pengguna & WA</th>
                  <th className="py-3 px-4">Paket</th>
                  <th className="py-3 px-4">Metode</th>
                  <th className="py-3 px-4">Total Tagihan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Waktu Dibuat</th>
                  <th className="py-3 px-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8EC]">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-zinc-50/70 transition-colors ${
                      tx.status === "waiting_verification" ? "bg-blue-50/20" : ""
                    }`}
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-[#0A0A0A]">
                      {tx.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[#0A0A0A]">{tx.user_name || "User"}</div>
                      <div className="text-[11px] text-[#9C9C9C] font-mono">+{tx.user_phone}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#0A0A0A]">{tx.plan_name}</td>
                    <td className="py-3.5 px-4 text-[#6B6B6B]">{tx.payment_method_name}</td>
                    <td className="py-3.5 px-4 font-bold text-[#6366F1]">
                      {formatRupiah(tx.total_amount)}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(tx.status)}</td>
                    <td className="py-3.5 px-4 text-[#9C9C9C] font-mono">{formatDateWIB(tx.created_at)}</td>
                    <td className="py-3.5 px-5 text-right">
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => openDetail(tx.id)}
                        className={
                          tx.status === "waiting_verification"
                            ? "bg-indigo-50 text-[#6366F1] border-indigo-200 hover:bg-indigo-100 font-bold"
                            : "font-medium"
                        }
                      >
                        Tinjau
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Review & Verification Dialog */}
      <Dialog open={Boolean(selectedTx)} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTx ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center justify-between">
                  <span>Tinjau Transaksi #{selectedTx.code}</span>
                  <div>{getStatusBadge(selectedTx.status)}</div>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Dibuat pada {formatDateWIB(selectedTx.created_at)} • Batas: {formatDateWIB(selectedTx.expires_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* User & Order Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] text-[#9C9C9C] uppercase font-bold">Data Pengguna</span>
                    <div className="font-semibold text-sm text-[#0A0A0A] mt-1">{selectedTx.user_name}</div>
                    <div className="text-[#6B6B6B] mt-0.5">WhatsApp: {selectedTx.user_phone}</div>
                    <div className="text-[#6B6B6B] text-[10px] mt-1 font-mono">ID: {selectedTx.user_id}</div>
                  </div>

                  <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] text-[#9C9C9C] uppercase font-bold">Ringkasan Biaya</span>
                    <div className="flex justify-between mt-1 text-[#6B6B6B]">
                      <span>Paket {selectedTx.plan_name}:</span>
                      <span className="text-[#0A0A0A] font-medium">{formatRupiah(selectedTx.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#6B6B6B]">
                      <span>Biaya Layanan:</span>
                      <span className="text-[#0A0A0A] font-medium">{formatRupiah(selectedTx.fee_amount)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold text-sm text-[#6366F1]">
                      <span>Total Tagihan:</span>
                      <span>{formatRupiah(selectedTx.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Proofs Review */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#0A0A0A] block">
                    Foto Bukti Pembayaran dari User:
                  </span>

                  {!selectedTx.proofs || selectedTx.proofs.length === 0 ? (
                    <div className="p-6 rounded-[8px] border border-dashed border-zinc-300 text-center text-xs text-[#9C9C9C]">
                      User belum mengunggah foto bukti pembayaran.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedTx.proofs.map((proof) => (
                        <div
                          key={proof.id}
                          className="p-3.5 rounded-[8px] border border-zinc-200 bg-white space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#0A0A0A]">{proof.file_name}</span>
                            <span className="text-[10px] text-[#9C9C9C]">
                              {formatDateWIB(proof.created_at)}
                            </span>
                          </div>

                          {proof.notes ? (
                            <div className="text-xs bg-zinc-50 p-2 rounded border border-zinc-100 text-[#6B6B6B]">
                              Catatan user: "{proof.notes}"
                            </div>
                          ) : null}

                          <div className="relative rounded-[8px] overflow-hidden border border-zinc-200 bg-zinc-950/5 flex items-center justify-center p-2">
                            <img
                              src={proof.file_path}
                              alt="Bukti Transfer"
                              className="max-h-72 object-contain rounded"
                            />
                          </div>

                          <div className="flex justify-end">
                            <a
                              href={proof.file_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1"
                            >
                              <span>Buka Ukuran Penuh</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejection / Note status if already decided */}
                {selectedTx.rejection_reason ? (
                  <div className="p-3 rounded-[8px] bg-red-50 border border-red-200 text-xs text-red-800">
                    <span className="font-bold">Alasan Ditolak Sebelumnya:</span>
                    <p className="mt-0.5">{selectedTx.rejection_reason}</p>
                  </div>
                ) : null}

                {selectedTx.admin_notes ? (
                  <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 text-xs text-[#6B6B6B]">
                    <span className="font-bold text-[#0A0A0A]">Catatan Admin:</span>
                    <p className="mt-0.5">{selectedTx.admin_notes}</p>
                  </div>
                ) : null}

                {/* Action Section (if not paid) */}
                {selectedTx.status !== "paid" ? (
                  <div className="pt-2 border-t border-[#E8E8EC] space-y-3">
                    <span className="text-xs font-bold text-[#0A0A0A] block">
                      Aksi Verifikasi Admin:
                    </span>

                    {actionError ? (
                      <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                        {actionError}
                      </div>
                    ) : null}

                    {isRejecting ? (
                      <div className="p-3.5 rounded-[8px] bg-red-50/50 border border-red-200 space-y-2 text-xs">
                        <label className="font-bold text-red-900 block">
                          Masukkan Alasan Penolakan Pembayaran:
                        </label>
                        <textarea
                          rows={2}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Misal: Nominal tidak sesuai, bukti transfer buram/tidak terbaca..."
                          className="w-full p-2 text-xs rounded border border-red-300 outline-none focus:border-red-500 bg-white"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setIsRejecting(false)}
                            disabled={processing}
                          >
                            Batal
                          </Button>
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={handleReject}
                            isLoading={processing}
                          >
                            Konfirmasi Tolak
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={approvalNotes}
                          onChange={(e) => setApprovalNotes(e.target.value)}
                          placeholder="Catatan persetujuan admin (opsional)"
                          className="w-full text-xs px-3 py-1.5 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1]"
                        />

                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsRejecting(true)}
                            disabled={processing}
                            className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Tolak Pembayaran
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleApprove}
                            isLoading={processing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold"
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Setujui & Aktifkan Paket
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-[8px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Transaksi ini telah diverifikasi dan disetujui. Paket telah aktif.</span>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4">
                <Button size="sm" variant="secondary" onClick={() => setSelectedTx(null)}>
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
