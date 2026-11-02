"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ReceiptText,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Upload,
  Copy,
  Check,
  CreditCard,
  QrCode,
  Eye,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { transactionsApi, uploadsApi } from "@/lib/api";
import { Transaction } from "@/types";
import { formatDateWIB, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

function UserTransactionsPageContent() {
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get("id");
  const isNewTx = searchParams.get("new") === "1";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Proof upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNotes, setProofNotes] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [cancelling, setCancelling] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const data = await transactionsApi.list();
      setTransactions(data || []);

      if (highlightedId) {
        openDetail(highlightedId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [highlightedId]);

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setUploadError("");
      setProofFile(null);
      setProofNotes("");
      const tx = await transactionsApi.getById(id);
      setSelectedTx(tx);
    } catch (err: any) {
      alert(err.message || "Gagal memuat detail transaksi");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUploadProof = async () => {
    if (!selectedTx || !proofFile) {
      setUploadError("Silakan pilih file foto bukti transfer");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      // 1. Upload file
      const upRes = await uploadsApi.uploadProof(proofFile);
      if (!upRes || !upRes.url) {
        throw new Error("Gagal mengunggah file bukti pembayaran");
      }

      // 2. Submit proof to transaction
      await transactionsApi.uploadProof(selectedTx.id, {
        file_path: upRes.url,
        file_name: upRes.file_name || proofFile.name,
        file_size: upRes.file_size || proofFile.size,
        mime_type: proofFile.type,
        notes: proofNotes,
      });

      // Reload
      await openDetail(selectedTx.id);
      await loadTransactions();
      setProofFile(null);
      setProofNotes("");
    } catch (err: any) {
      setUploadError(err.message || "Gagal mengirim bukti transfer");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelTx = async () => {
    if (!selectedTx) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan transaksi ini?")) return;

    setCancelling(true);
    try {
      await transactionsApi.cancel(selectedTx.id);
      await openDetail(selectedTx.id);
      await loadTransactions();
    } catch (err: any) {
      alert(err.message || "Gagal membatalkan transaksi");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_payment":
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-[10px]">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Pembayaran
          </Badge>
        );
      case "waiting_verification":
        return (
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Verifikasi
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Berhasil (Lunas)
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="w-3 h-3 mr-1" />
            Bukti Ditolak
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-zinc-600 bg-zinc-100 border-zinc-200 text-[10px]">
            Dibatalkan
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="text-zinc-600 bg-zinc-100 border-zinc-200 text-[10px]">
            Kedaluwarsa
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A0A0A]">Riwayat Transaksi</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Daftar tagihan pembayaran paket langganan dan status verifikasi bukti transfer.
          </p>
        </div>
        <Link href="/pricing">
          <Button variant="primary" size="sm" className="font-semibold text-xs">
            Beli Paket Baru
          </Button>
        </Link>
      </div>

      {isNewTx ? (
        <div className="p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Transaksi baru berhasil dibuat!</span>
            <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
              Silakan lakukan pembayaran sesuai nominal dan unggah foto bukti transfer di bawah ini. Tim kami akan segera memverifikasi dan mengaktifkan paket Anda.
            </p>
          </div>
        </div>
      ) : null}

      {/* Transactions Table Card */}
      <Card>
        <CardContent className="p-0 sm:p-5">
          {loading ? (
            <div className="text-center py-12 text-xs text-[#9C9C9C]">
              Memuat data transaksi...
            </div>
          ) : !transactions.length ? (
            <div className="text-center py-12 space-y-3">
              <ReceiptText className="w-10 h-10 text-zinc-300 mx-auto" />
              <div className="text-xs text-[#6B6B6B]">Belum ada riwayat transaksi pembayaran.</div>
              <Link href="/pricing">
                <Button size="sm" variant="outline">
                  Lihat Pilihan Paket
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8E8EC] text-[#6B6B6B] bg-zinc-50/50">
                    <th className="py-3 px-4 font-semibold">Kode Transaksi</th>
                    <th className="py-3 px-4 font-semibold">Paket</th>
                    <th className="py-3 px-4 font-semibold">Metode Bayar</th>
                    <th className="py-3 px-4 font-semibold">Total Tagihan</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Waktu Dibuat</th>
                    <th className="py-3 px-4 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-zinc-50/80 transition-colors ${
                        highlightedId === tx.id ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0A0A0A]">
                        {tx.code}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0A0A0A]">
                        {tx.plan_name}
                      </td>
                      <td className="py-3.5 px-4 text-[#6B6B6B]">
                        {tx.payment_method_name}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#6366F1]">
                        {formatRupiah(tx.total_amount)}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(tx.status)}</td>
                      <td className="py-3.5 px-4 text-[#9C9C9C]">{formatDateWIB(tx.created_at)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => openDetail(tx.id)}
                          className="font-medium"
                        >
                          Detail & Bukti
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={Boolean(selectedTx)} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedTx ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-[#6366F1]" />
                    <span>Detail Transaksi #{selectedTx.code}</span>
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs">
                  Dibuat pada {formatDateWIB(selectedTx.created_at)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Status banner */}
                <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#6B6B6B]">Status Pembayaran:</span>
                  <div>{getStatusBadge(selectedTx.status)}</div>
                </div>

                {/* Rejection alert */}
                {selectedTx.status === "rejected" && selectedTx.rejection_reason ? (
                  <div className="p-3.5 rounded-[8px] bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-900">
                      <AlertCircle className="w-4 h-4" />
                      <span>Alasan Penolakan dari Admin:</span>
                    </div>
                    <p className="leading-relaxed pl-5">{selectedTx.rejection_reason}</p>
                    <p className="text-[11px] text-red-700 pl-5 pt-1">
                      Anda dapat mengunggah ulang bukti transfer yang benar di bawah ini.
                    </p>
                  </div>
                ) : null}

                {/* Price Breakdown */}
                <div className="p-3.5 rounded-[8px] border border-[#E8E8EC] space-y-2 text-xs">
                  <div className="font-bold text-sm text-[#0A0A0A] pb-1 border-b border-[#E8E8EC]">
                    Paket {selectedTx.plan_name} (1 Bulan)
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Harga Paket:</span>
                    <span className="font-medium text-[#0A0A0A]">
                      {formatRupiah(selectedTx.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Biaya Layanan ({selectedTx.payment_method_name}):</span>
                    <span className="font-medium text-[#0A0A0A]">
                      {selectedTx.fee_amount === 0 ? "Gratis" : formatRupiah(selectedTx.fee_amount)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#E8E8EC] flex justify-between items-baseline font-bold">
                    <span className="text-sm text-[#0A0A0A]">Total Transfer:</span>
                    <span className="text-lg text-[#6366F1]">
                      {formatRupiah(selectedTx.total_amount)}
                    </span>
                  </div>
                </div>

                {/* Payment Instruction Card (if pending or rejected) */}
                {(selectedTx.status === "pending_payment" || selectedTx.status === "rejected") ? (
                  <div className="p-3.5 rounded-[8px] bg-indigo-50/40 border border-indigo-100 text-xs space-y-2">
                    <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#6366F1]" />
                      <span>Rekening Tujuan Transfer:</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-[6px] border border-indigo-100 font-mono text-xs flex items-center justify-between">
                      <span className="text-[#0A0A0A] break-all">{selectedTx.payment_method_details}</span>
                    </div>
                    <div className="text-[11px] text-[#6B6B6B]">
                      Batas waktu pembayaran berlaku hingga:{" "}
                      <strong>{formatDateWIB(selectedTx.expires_at)}</strong>
                    </div>
                  </div>
                ) : null}

                {/* Proof Section */}
                <div className="space-y-3 pt-2">
                  <div className="font-bold text-xs text-[#0A0A0A] flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>Bukti Pembayaran</span>
                  </div>

                  {/* Uploaded proofs */}
                  {selectedTx.proofs && selectedTx.proofs.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTx.proofs.map((proof) => (
                        <div
                          key={proof.id}
                          className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <a
                              href={proof.file_path}
                              target="_blank"
                              rel="noreferrer"
                              className="w-12 h-12 rounded-[6px] bg-zinc-200 overflow-hidden shrink-0 border block hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={proof.file_path}
                                alt="Proof thumbnail"
                                className="w-full h-full object-cover"
                              />
                            </a>
                            <div>
                              <div className="font-semibold text-[#0A0A0A]">{proof.file_name}</div>
                              <div className="text-[10px] text-[#9C9C9C]">
                                {formatDateWIB(proof.created_at)}
                              </div>
                              {proof.notes ? (
                                <div className="text-[11px] text-[#6B6B6B] italic mt-0.5">
                                  "{proof.notes}"
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <a
                            href={proof.file_path}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>Lihat Foto</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#9C9C9C] italic">Belum ada bukti pembayaran diunggah.</div>
                  )}

                  {/* Upload Form if allowed */}
                  {(selectedTx.status === "pending_payment" ||
                    selectedTx.status === "waiting_verification" ||
                    selectedTx.status === "rejected") ? (
                    <div className="p-3.5 rounded-[8px] border border-dashed border-zinc-300 bg-white space-y-3">
                      <div className="text-xs font-semibold text-[#0A0A0A]">
                        {selectedTx.proofs?.length
                          ? "Unggah Bukti Tambahan / Revisi:"
                          : "Unggah Foto Bukti Transfer:"}
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setProofFile(e.target.files[0]);
                          }
                        }}
                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-[#6366F1] hover:file:bg-indigo-100 cursor-pointer"
                      />

                      <input
                        type="text"
                        value={proofNotes}
                        onChange={(e) => setProofNotes(e.target.value)}
                        placeholder="Catatan tambahan (opsional, misal: nama pengirim transfer)"
                        className="w-full text-xs px-3 py-2 rounded-[6px] border border-[#E8E8EC] outline-none focus:border-[#6366F1]"
                      />

                      {uploadError ? (
                        <div className="text-xs text-red-600">{uploadError}</div>
                      ) : null}

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleUploadProof}
                        isLoading={uploading}
                        disabled={!proofFile || uploading}
                        className="w-full text-xs font-bold"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Kirim Bukti Pembayaran
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
                {(selectedTx.status === "pending_payment" || selectedTx.status === "waiting_verification") ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleCancelTx}
                    isLoading={cancelling}
                    disabled={cancelling}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Batalkan Transaksi Ini
                  </Button>
                ) : (
                  <div />
                )}

                <Button size="sm" variant="outline" onClick={() => setSelectedTx(null)}>
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

export default function UserTransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh] text-sm text-[#9C9C9C]">
          Memuat riwayat transaksi...
        </div>
      }
    >
      <UserTransactionsPageContent />
    </Suspense>
  );
}
