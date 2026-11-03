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
  Image as ImageIcon,
  X,
  FileCheck2,
} from "lucide-react";
import { transactionsApi, uploadsApi } from "@/lib/api";
import { Transaction } from "@/types";
import { formatDateWIB, formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

function getTxPaymentInfo(tx: Transaction) {
  let bankName = tx.bank_name || "";
  let accountNumber = tx.account_number || "";
  let accountName = tx.account_name || "";
  let qrisUrl = tx.qris_image_url || "";

  if ((!bankName || !accountNumber) && tx.payment_method_details) {
    const details = tx.payment_method_details;
    if (details.includes("Bank:")) {
      const parts = details.split("|").map((p) => p.trim());
      parts.forEach((p) => {
        if (p.startsWith("Bank:")) bankName = bankName || p.replace("Bank:", "").trim();
        if (p.startsWith("No. Rekening:")) accountNumber = accountNumber || p.replace("No. Rekening:", "").trim();
        if (p.startsWith("Atas Nama:")) accountName = accountName || p.replace("Atas Nama:", "").trim();
      });
    } else if (details.includes("QRIS:")) {
      const parts = details.split("|").map((p) => p.trim());
      parts.forEach((p) => {
        if (p.startsWith("QRIS:")) qrisUrl = qrisUrl || p.replace("QRIS:", "").trim();
        if (p.startsWith("Penerima:")) accountName = accountName || p.replace("Penerima:", "").trim();
      });
    }
  }

  return { bankName, accountNumber, accountName, qrisUrl };
}

function UserTransactionsPageContent() {
  const searchParams = useSearchParams();
  const highlightedId = searchParams.get("id");
  const isNewTx = searchParams.get("new") === "1";

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string>("");

  // Proof upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofNotes, setProofNotes] = useState<string>("");
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [uploadSuccess, setUploadSuccess] = useState<string>("");
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

  // Preview URL management
  useEffect(() => {
    if (!proofFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(proofFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [proofFile]);

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setUploadError("");
      setUploadSuccess("");
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

  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const handleUploadProof = async () => {
    if (!selectedTx || !proofFile) {
      setUploadError("Silakan pilih file foto bukti transfer terlebih dahulu");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

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
      setUploadSuccess("Bukti pembayaran berhasil diunggah! Menunggu verifikasi admin.");
    } catch (err: any) {
      setUploadError(err.message || "Gagal mengirim bukti transfer");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelTx = async () => {
    if (!selectedTx) return;
    if (!confirm(`Apakah Anda yakin ingin membatalkan transaksi #${selectedTx.code}?`)) {
      return;
    }

    setCancelling(true);
    try {
      await transactionsApi.cancel(selectedTx.id);
      setSelectedTx(null);
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
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Pembayaran
          </Badge>
        );
      case "waiting_verification":
        return (
          <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            Menunggu Verifikasi Admin
          </Badge>
        );
      case "paid":
        return (
          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Lunas / Aktif
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Bukti Ditolak
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-zinc-600 bg-zinc-100 border-zinc-200">
            <XCircle className="w-3 h-3 mr-1" />
            Dibatalkan
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="text-zinc-600 bg-zinc-100 border-zinc-200">
            <Clock className="w-3 h-3 mr-1" />
            Kedaluwarsa
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">Riwayat Transaksi</h1>
          <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">
            Daftar transaksi langganan dan status verifikasi bukti pembayaran manual Anda.
          </p>
        </div>
        <Link href="/pricing" className="shrink-0">
          <Button size="sm" className="w-full sm:w-auto font-semibold shadow-xs">
            Upgrade / Perpanjang Paket
          </Button>
        </Link>
      </div>

      {isNewTx && (
        <div className="p-4 rounded-[8px] bg-indigo-50 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#6366F1] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Pesanan Langganan Berhasil Dibuat!</div>
            <div className="text-indigo-700 mt-0.5 leading-relaxed">
              Silakan lakukan transfer sesuai rincian rekening di bawah ini dan unggah foto bukti transfer agar akun Anda segera diverifikasi oleh admin.
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table Card (Full-bleed Card, Responsive) */}
      <Card className="p-0 overflow-hidden border-[#E8E8EC] shadow-xs">
        {loading ? (
          <div className="text-center py-16 text-xs text-[#9C9C9C]">
            Memuat data transaksi...
          </div>
        ) : !transactions.length ? (
          <div className="text-center py-16 space-y-3">
            <ReceiptText className="w-10 h-10 text-zinc-300 mx-auto" />
            <div className="text-xs text-[#6B6B6B]">Belum ada riwayat transaksi pembayaran.</div>
            <Link href="/pricing">
              <Button size="sm" variant="outline">
                Lihat Pilihan Paket
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-zinc-50 border-b border-[#E8E8EC] text-[#6B6B6B] font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Kode Transaksi</th>
                    <th className="py-3 px-4">Paket</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4">Total Tagihan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Waktu Dibuat</th>
                    <th className="py-3 px-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8EC]">
                  {transactions.map((tx) => {
                    const needsProof = tx.status === "pending_payment" || tx.status === "rejected";
                    return (
                      <tr
                        key={tx.id}
                        className={`hover:bg-zinc-50/70 transition-colors ${
                          highlightedId === tx.id ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <td className="py-3.5 px-5 font-mono font-bold text-[#0A0A0A]">
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
                        <td className="py-3.5 px-4 text-[#9C9C9C] font-mono">{formatDateWIB(tx.created_at)}</td>
                        <td className="py-3.5 px-5 text-right">
                          {needsProof ? (
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => openDetail(tx.id)}
                              className="font-medium inline-flex items-center gap-1"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Unggah Bukti</span>
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => openDetail(tx.id)}
                              className="font-medium"
                            >
                              Detail & Bukti
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (block on mobile screens, no horizontal scroll needed) */}
            <div className="md:hidden divide-y divide-[#E8E8EC]">
              {transactions.map((tx) => {
                const needsProof = tx.status === "pending_payment" || tx.status === "rejected";
                return (
                  <div
                    key={tx.id}
                    className={`p-4 space-y-3 transition-colors ${
                      highlightedId === tx.id ? "bg-indigo-50/40" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#0A0A0A]">
                        #{tx.code}
                      </span>
                      <div>{getStatusBadge(tx.status)}</div>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <div className="font-bold text-sm text-[#0A0A0A]">
                          Paket {tx.plan_name}
                        </div>
                        <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                          {tx.payment_method_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-base text-[#6366F1]">
                          {formatRupiah(tx.total_amount)}
                        </div>
                        <div className="text-[10px] text-[#9C9C9C] font-mono mt-0.5">
                          {formatDateWIB(tx.created_at)}
                        </div>
                      </div>
                    </div>

                    <div className="pt-1">
                      {needsProof ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openDetail(tx.id)}
                          className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 h-9 shadow-xs"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Bukti Pembayaran</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(tx.id)}
                          className="w-full text-xs font-medium h-9"
                        >
                          Detail Transaksi & Bukti
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Transaction Detail Dialog */}
      <Dialog open={Boolean(selectedTx)} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedTx ? (
            <>
              {(() => {
                const paymentInfo = getTxPaymentInfo(selectedTx);
                const isBank = selectedTx.payment_method_type === "bank_transfer";
                const canUpload =
                  selectedTx.status === "pending_payment" ||
                  selectedTx.status === "waiting_verification" ||
                  selectedTx.status === "rejected";

                return (
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

                      {/* Upload Success Alert */}
                      {uploadSuccess ? (
                        <div className="p-3 rounded-[8px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{uploadSuccess}</span>
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
                          <div className="flex items-center gap-2">
                            <span className="text-lg text-[#6366F1]">
                              {formatRupiah(selectedTx.total_amount)}
                            </span>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleCopyText("dialog_amount", String(selectedTx.total_amount))}
                              className="h-6 text-[10px] px-2 flex items-center gap-1 font-medium"
                            >
                              {copiedKey === "dialog_amount" ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Payment Instruction Card (if pending or rejected) */}
                      {(selectedTx.status === "pending_payment" || selectedTx.status === "rejected") ? (
                        <div className="p-3.5 rounded-[8px] bg-indigo-50/40 border border-indigo-100 text-xs space-y-2.5">
                          <div className="font-bold text-xs text-indigo-950 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              {isBank ? (
                                <CreditCard className="w-3.5 h-3.5 text-[#6366F1]" />
                              ) : (
                                <QrCode className="w-3.5 h-3.5 text-[#6366F1]" />
                              )}
                              <span>Rekening Tujuan Transfer ({selectedTx.payment_method_name}):</span>
                            </span>
                          </div>

                          {isBank ? (
                            <div className="bg-white p-3 rounded-[6px] border border-indigo-100 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-[10px] text-[#9C9C9C] uppercase font-semibold block">
                                    {paymentInfo.bankName || "Bank Tujuan"}
                                  </span>
                                  <span className="font-mono font-bold text-base text-[#0A0A0A] block">
                                    {paymentInfo.accountNumber || selectedTx.payment_method_details}
                                  </span>
                                  <span className="text-[11px] text-[#6B6B6B] block mt-0.5">
                                    Atas Nama: <strong>{paymentInfo.accountName || "-"}</strong>
                                  </span>
                                </div>

                                {paymentInfo.accountNumber ? (
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => handleCopyText("dialog_account", paymentInfo.accountNumber)}
                                    className="flex items-center gap-1 shrink-0 font-medium"
                                  >
                                    {copiedKey === "dialog_account" ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Tersalin</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Salin</span>
                                      </>
                                    )}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-white p-3 rounded-[6px] border border-indigo-100 flex flex-col items-center justify-center text-center">
                              {paymentInfo.qrisUrl ? (
                                <img
                                  src={paymentInfo.qrisUrl}
                                  alt="QRIS Barcode"
                                  className="w-44 h-44 object-contain rounded-[6px] mb-2 border border-zinc-100"
                                />
                              ) : (
                                <div className="w-32 h-32 bg-zinc-100 rounded-[6px] flex items-center justify-center text-zinc-400 mb-2">
                                  <QrCode className="w-12 h-12" />
                                </div>
                              )}
                              <span className="font-bold text-xs text-[#0A0A0A]">
                                {paymentInfo.accountName || "Task Reminder Official"}
                              </span>
                              <span className="text-[11px] text-[#6B6B6B] mt-0.5">
                                Pindai barcode QRIS di atas via aplikasi m-banking atau e-wallet Anda.
                              </span>
                            </div>
                          )}

                          <div className="text-[11px] text-[#6B6B6B]">
                            Batas waktu pembayaran berlaku hingga:{" "}
                            <strong>{formatDateWIB(selectedTx.expires_at)}</strong>
                          </div>
                        </div>
                      ) : null}

                      {/* Proof Section */}
                      <div className="space-y-3 pt-2">
                        <div className="font-bold text-xs text-[#0A0A0A] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span>Bukti Pembayaran</span>
                          </span>
                          {selectedTx.proofs?.length ? (
                            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                              <FileCheck2 className="w-3.5 h-3.5" />
                              {selectedTx.proofs.length} Bukti Terlampir
                            </span>
                          ) : null}
                        </div>

                        {/* Uploaded proofs */}
                        {selectedTx.proofs && selectedTx.proofs.length > 0 ? (
                          <div className="space-y-2">
                            {selectedTx.proofs.map((proof) => (
                              <div
                                key={proof.id}
                                className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-[#0A0A0A] truncate">
                                      {proof.file_name}
                                    </div>
                                    <div className="text-[10px] text-[#9C9C9C]">
                                      {formatDateWIB(proof.created_at)}
                                    </div>
                                    {proof.notes ? (
                                      <div className="text-[11px] text-[#6B6B6B] italic mt-0.5 truncate">
                                        "{proof.notes}"
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <a
                                  href={proof.file_path}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-[#6366F1] font-semibold hover:underline flex items-center gap-1 shrink-0 ml-2"
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
                        {canUpload ? (
                          <div className="p-3.5 rounded-[8px] border border-dashed border-zinc-300 bg-white space-y-3">
                            <div className="text-xs font-semibold text-[#0A0A0A] flex items-center justify-between">
                              <span>
                                {selectedTx.proofs?.length
                                  ? "Unggah Bukti Tambahan / Revisi:"
                                  : "Unggah Foto Bukti Transfer:"}
                              </span>
                              <span className="text-[10px] text-[#9C9C9C]">JPG, PNG, WEBP (Maks. 5 MB)</span>
                            </div>

                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setProofFile(file);
                                  setUploadError("");
                                }
                              }}
                              className="hidden"
                            />

                            {/* Preview or Selector */}
                            {previewUrl ? (
                              <div className="p-2.5 rounded-[6px] bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-12 h-12 rounded-[4px] overflow-hidden border border-zinc-300 bg-zinc-200 shrink-0">
                                    <img
                                      src={previewUrl}
                                      alt="Preview Bukti"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-xs text-[#0A0A0A] truncate block">
                                      {proofFile?.name}
                                    </span>
                                    <span className="text-[10px] text-[#9C9C9C] block">
                                      {proofFile ? `${(proofFile.size / 1024 / 1024).toFixed(2)} MB` : ""}
                                    </span>
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => {
                                    setProofFile(null);
                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                  }}
                                  className="text-zinc-500 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div
                                onClick={() => fileInputRef.current?.click()}
                                className="py-4 px-3 rounded-[6px] border border-dashed border-zinc-300 hover:border-[#6366F1] bg-zinc-50/50 hover:bg-indigo-50/20 transition-all cursor-pointer text-center"
                              >
                                <ImageIcon className="w-6 h-6 text-zinc-400 mx-auto mb-1" />
                                <span className="text-xs font-semibold text-[#0A0A0A] block">
                                  Pilih Foto / Tangkapan Layar Struk Transfer
                                </span>
                              </div>
                            )}

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
                );
              })()}
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
        <div className="p-8 text-center text-xs text-[#9C9C9C]">
          Memuat halaman transaksi...
        </div>
      }
    >
      <UserTransactionsPageContent />
    </Suspense>
  );
}