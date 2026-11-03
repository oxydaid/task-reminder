"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  CreditCard,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Clock,
  Upload,
  ExternalLink,
  Image as ImageIcon,
  X,
  FileCheck2,
} from "lucide-react";
import { api, paymentMethodsApi, transactionsApi, uploadsApi } from "@/lib/api";
import { PaymentMethod, Plan, Transaction } from "@/types";
import { formatRupiah, formatDateWIB } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

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

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const txParam = searchParams.get("tx");
  const { user, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planParam || "");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Active Transaction state (if checkout is created or resuming)
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [activeTxLoading, setActiveTxLoading] = useState<boolean>(false);

  // Copy indicator state
  const [copiedKey, setCopiedKey] = useState<string>("");

  // Proof upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofNotes, setProofNotes] = useState<string>("");
  const [uploadingProof, setUploadingProof] = useState<boolean>(false);
  const [proofSuccess, setProofSuccess] = useState<string>("");
  const [proofError, setProofError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/checkout${planParam ? `?plan=${planParam}` : ""}`);
    }
  }, [user, authLoading, router, planParam]);

  // Load existing tx if tx param is present
  useEffect(() => {
    if (txParam && user) {
      setActiveTxLoading(true);
      transactionsApi
        .getById(txParam)
        .then((tx) => {
          if (tx) {
            setActiveTx(tx);
          }
        })
        .catch(() => {})
        .finally(() => setActiveTxLoading(false));
    }
  }, [txParam, user]);

  useEffect(() => {
    async function loadData() {
      try {
        const [plansData, pmData] = await Promise.all([
          api.getCached<Plan[]>("/plans", 5 * 60 * 1000),
          paymentMethodsApi.listPublic(),
        ]);

        const paidPlans = (plansData || []).filter((p) => p.price > 0 && p.is_active);
        setPlans(paidPlans);

        if (paidPlans.length > 0) {
          if (planParam && paidPlans.some((p) => p.id === planParam)) {
            setSelectedPlanId(planParam);
          } else {
            setSelectedPlanId(paidPlans[0].id);
          }
        }

        const activePMs = (pmData || []).filter((pm) => pm.is_active);
        setPaymentMethods(activePMs);
        if (activePMs.length > 0) {
          setSelectedMethodId(activePMs[0].id);
        }
      } catch (err: any) {
        setError(err.message || "Gagal memuat data paket & metode pembayaran");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, planParam]);

  // Manage file preview cleanup
  useEffect(() => {
    if (!proofFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(proofFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [proofFile]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const selectedMethod = paymentMethods.find((m) => m.id === selectedMethodId);

  // Fee Calculation
  const subtotal = selectedPlan ? selectedPlan.price : 0;
  let feeAmount = 0;
  if (selectedMethod && subtotal > 0) {
    if (selectedMethod.fee_type === "fixed") {
      feeAmount = selectedMethod.fee_fixed;
    } else if (selectedMethod.fee_type === "percentage") {
      feeAmount = Math.round((subtotal * selectedMethod.fee_percentage) / 100);
    } else if (selectedMethod.fee_type === "mixed") {
      feeAmount = Math.round((subtotal * selectedMethod.fee_percentage) / 100) + selectedMethod.fee_fixed;
    }
  }
  const totalAmount = subtotal + feeAmount;

  const handleCopyText = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  const handleCreateCheckout = async () => {
    if (!selectedPlanId || !selectedMethodId) {
      setError("Silakan pilih paket dan metode pembayaran");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const idempotencyKey = `chk_${user?.id}_${selectedPlanId}_${Date.now()}`;
      const res = await transactionsApi.checkout({
        plan_id: selectedPlanId,
        payment_method_id: selectedMethodId,
        idempotency_key: idempotencyKey,
      });

      if (res && res.id) {
        // Fetch full transaction to ensure all fields are up-to-date
        const fullTx = await transactionsApi.getById(res.id);
        setActiveTx(fullTx || res);
        window.history.replaceState(null, "", `/checkout?tx=${res.id}`);
      } else {
        router.push("/dashboard/transactions");
      }
    } catch (err: any) {
      setError(err.message || "Gagal membuat transaksi checkout");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadProof = async () => {
    if (!activeTx || !proofFile) {
      setProofError("Silakan pilih file foto bukti transfer terlebih dahulu");
      return;
    }

    setUploadingProof(true);
    setProofError("");
    setProofSuccess("");

    try {
      // 1. Upload image file
      const upRes = await uploadsApi.uploadProof(proofFile);
      if (!upRes || !upRes.url) {
        throw new Error("Gagal mengunggah file bukti pembayaran");
      }

      // 2. Submit payment proof
      await transactionsApi.uploadProof(activeTx.id, {
        file_path: upRes.url,
        file_name: upRes.file_name || proofFile.name,
        file_size: upRes.file_size || proofFile.size,
        mime_type: proofFile.type,
        notes: proofNotes,
      });

      // 3. Refresh active transaction data
      const updated = await transactionsApi.getById(activeTx.id);
      setActiveTx(updated);
      setProofFile(null);
      setProofNotes("");
      setProofSuccess("Bukti pembayaran berhasil dikirim! Menunggu verifikasi admin.");
    } catch (err: any) {
      setProofError(err.message || "Gagal mengirim bukti pembayaran");
    } finally {
      setUploadingProof(false);
    }
  };

  if (authLoading || (loading && !plans.length) || activeTxLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-sm text-[#9C9C9C]">
        Menyiapkan halaman pembayaran...
      </div>
    );
  }

  // ==========================================
  // VIEW A: ACTIVE TRANSACTION / INVOICE VIEW
  // ==========================================
  if (activeTx) {
    const isBank = activeTx.payment_method_type === "bank_transfer";
    const paymentInfo = getTxPaymentInfo(activeTx);
    const isPaid = activeTx.status === "paid";
    const isWaitingVerification = activeTx.status === "waiting_verification";
    const isPending = activeTx.status === "pending_payment";
    const isRejected = activeTx.status === "rejected";

    return (
      <div className="min-h-screen bg-[#FAFAFA] py-8 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          {/* Top navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTx(null);
                window.history.replaceState(null, "", "/checkout");
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ganti Paket atau Metode Lain</span>
            </button>

            <Link
              href={`/dashboard/transactions?id=${activeTx.id}`}
              className="inline-flex items-center gap-1 text-xs text-[#6366F1] font-semibold hover:underline"
            >
              <span>Buka di Riwayat Transaksi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
                  Instruksi & Bukti Pembayaran
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
                Kode Transaksi: <strong className="font-mono text-[#0A0A0A]">#{activeTx.code}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isPaid ? (
                <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Pembayaran Terverifikasi (Lunas)
                </Badge>
              ) : isWaitingVerification ? (
                <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Menunggu Verifikasi Admin
                </Badge>
              ) : isRejected ? (
                <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                  Bukti Ditolak (Harap Unggah Ulang)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                  <Clock className="w-3.5 h-3.5 mr-1" />
                  Menunggu Pembayaran
                </Badge>
              )}
            </div>
          </div>

          {/* Rejection Notice Banner */}
          {isRejected && activeTx.rejection_reason ? (
            <div className="mb-6 p-4 rounded-[10px] bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-red-900">
                <AlertCircle className="w-4 h-4" />
                <span>Alasan Penolakan dari Admin:</span>
              </div>
              <p className="leading-relaxed pl-5">{activeTx.rejection_reason}</p>
              <p className="text-[11px] text-red-700 pl-5 pt-1">
                Silakan lakukan transfer sesuai rincian rekening di bawah ini dan unggah foto bukti transfer yang jelas.
              </p>
            </div>
          ) : null}

          {/* Success Proof Banner */}
          {proofSuccess ? (
            <div className="mb-6 p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <span className="font-bold block">{proofSuccess}</span>
                <span className="text-[11px] text-emerald-700 mt-0.5 block">
                  Admin kami akan segera memverifikasi pembayaran Anda. Anda juga akan menerima konfirmasi via WhatsApp.
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Payment Details + Proof Upload Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Payment Account Details Card */}
              <Card className="p-0 overflow-hidden border-[#E8E8EC] shadow-sm">
                <CardHeader className="px-5 py-4 border-b border-[#E8E8EC] bg-white">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      {isBank ? (
                        <CreditCard className="w-4 h-4 text-[#6366F1]" />
                      ) : (
                        <QrCode className="w-4 h-4 text-[#6366F1]" />
                      )}
                      <span>Tujuan Pembayaran: {activeTx.payment_method_name}</span>
                    </CardTitle>
                    <span className="text-[11px] font-mono text-[#9C9C9C]">
                      Batas: {formatDateWIB(activeTx.expires_at)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {isBank ? (
                    <div className="p-4 rounded-[10px] bg-indigo-50/30 border border-indigo-100 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#6B6B6B] block">
                          Bank Tujuan
                        </span>
                        <span className="font-bold text-sm text-[#0A0A0A]">
                          {paymentInfo.bankName || activeTx.payment_method_name}
                        </span>
                      </div>

                      <div className="bg-white p-3.5 rounded-[8px] border border-indigo-100 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] text-[#9C9C9C] uppercase font-semibold block">
                            Nomor Rekening
                          </span>
                          <span className="font-mono font-extrabold text-base sm:text-lg text-[#0A0A0A] tracking-wider block mt-0.5">
                            {paymentInfo.accountNumber || "-"}
                          </span>
                          <span className="text-xs text-[#6B6B6B] block mt-0.5">
                            Atas Nama: <strong>{paymentInfo.accountName || "-"}</strong>
                          </span>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyText("account", paymentInfo.accountNumber)}
                          className="shrink-0 flex items-center gap-1.5 font-medium"
                        >
                          {copiedKey === "account" ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Rekening</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* QRIS Display */
                    <div className="p-5 rounded-[10px] bg-purple-50/30 border border-purple-100 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-bold text-[#0A0A0A] mb-2">
                        Pindai QRIS untuk Pembayaran
                      </span>
                      {paymentInfo.qrisUrl ? (
                        <div className="bg-white p-2.5 rounded-[10px] border border-purple-100 shadow-xs mb-3">
                          <img
                            src={paymentInfo.qrisUrl}
                            alt="QRIS Barcode"
                            className="w-56 h-56 object-contain rounded-[6px]"
                          />
                        </div>
                      ) : (
                        <div className="w-48 h-48 bg-zinc-100 rounded-[10px] flex items-center justify-center text-zinc-400 mb-3">
                          <QrCode className="w-16 h-16" />
                        </div>
                      )}
                      <div className="font-semibold text-xs text-[#0A0A0A]">
                        {paymentInfo.accountName || "Task Reminder Official"}
                      </div>
                      <div className="text-[11px] text-[#6B6B6B] mt-1 max-w-sm">
                        Buka aplikasi GoPay, OVO, Dana, BCA Mobile, atau e-wallet lainnya, lalu pindai kode QRIS di atas.
                      </div>
                    </div>
                  )}

                  {/* Transfer Amount Highlight with copy */}
                  <div className="p-3.5 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-[#9C9C9C] uppercase font-semibold block">
                        Total Jumlah Transfer
                      </span>
                      <span className="font-extrabold text-lg text-[#6366F1] block mt-0.5">
                        {formatRupiah(activeTx.total_amount)}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyText("amount", String(activeTx.total_amount))}
                      className="shrink-0 flex items-center gap-1.5 font-medium"
                    >
                      {copiedKey === "amount" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Nominal</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* KOLOM BUKTI PEMBAYARAN */}
              <Card className="p-0 overflow-hidden border-[#E8E8EC] shadow-sm">
                <CardHeader className="px-5 py-4 border-b border-[#E8E8EC] bg-white">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Upload className="w-4 h-4 text-[#6366F1]" />
                      <span>Kolom Bukti Pembayaran</span>
                    </CardTitle>
                    {activeTx.proofs && activeTx.proofs.length > 0 ? (
                      <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        {activeTx.proofs.length} Bukti Terlampir
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="text-xs">
                    Lampirkan foto atau screenshot bukti transfer Anda untuk diverifikasi oleh admin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {/* Previously uploaded proofs */}
                  {activeTx.proofs && activeTx.proofs.length > 0 ? (
                    <div className="space-y-2.5">
                      <span className="text-xs font-semibold text-[#0A0A0A] block">
                        Bukti Transfer yang Telah Diunggah:
                      </span>
                      {activeTx.proofs.map((proof) => (
                        <div
                          key={proof.id}
                          className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <a
                              href={proof.file_path}
                              target="_blank"
                              rel="noreferrer"
                              className="w-12 h-12 rounded-[6px] bg-zinc-200 overflow-hidden shrink-0 border block hover:opacity-85 transition-opacity"
                            >
                              <img
                                src={proof.file_path}
                                alt="Bukti Transfer"
                                className="w-full h-full object-cover"
                              />
                            </a>
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-[#0A0A0A] truncate block">
                                {proof.file_name}
                              </span>
                              <span className="text-[10px] text-[#9C9C9C] block mt-0.5">
                                Diunggah {formatDateWIB(proof.created_at)}
                              </span>
                              {proof.notes ? (
                                <span className="text-[11px] text-[#6B6B6B] italic block mt-0.5 truncate">
                                  "{proof.notes}"
                                </span>
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
                  ) : null}

                  {/* Upload Form (if pending, waiting, or rejected) */}
                  {!isPaid ? (
                    <div className="p-4 rounded-[10px] border border-dashed border-zinc-300 bg-white space-y-3.5">
                      <div className="text-xs font-semibold text-[#0A0A0A] flex items-center justify-between">
                        <span>
                          {activeTx.proofs && activeTx.proofs.length > 0
                            ? "Unggah Bukti Revisi / Tambahan:"
                            : "Unggah Foto Struk Transfer:"}
                        </span>
                        <span className="text-[10px] text-[#9C9C9C]">JPG, PNG, WEBP (Maks. 5 MB)</span>
                      </div>

                      {/* Hidden File Input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProofFile(file);
                            setProofError("");
                          }
                        }}
                        className="hidden"
                      />

                      {/* Dropzone / Preview Area */}
                      {previewUrl ? (
                        <div className="p-3 rounded-[8px] bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-14 h-14 rounded-[6px] overflow-hidden border border-zinc-300 bg-zinc-200 shrink-0">
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
                              <span className="text-[10px] text-[#9C9C9C] block mt-0.5">
                                {proofFile ? `${(proofFile.size / 1024 / 1024).toFixed(2)} MB` : ""}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                                Foto siap dikirim
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
                          className="py-6 px-4 rounded-[8px] border-2 border-dashed border-zinc-200 hover:border-[#6366F1] bg-zinc-50/50 hover:bg-indigo-50/20 transition-all cursor-pointer text-center"
                        >
                          <ImageIcon className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                          <span className="text-xs font-semibold text-[#0A0A0A] block">
                            Klik untuk memilih foto bukti transfer
                          </span>
                          <span className="text-[11px] text-[#9C9C9C] block mt-1">
                            Ambil foto struk ATM, bukti transfer m-banking, atau tangkapan layar pembayaran
                          </span>
                        </div>
                      )}

                      {/* Notes Input */}
                      <input
                        type="text"
                        value={proofNotes}
                        onChange={(e) => setProofNotes(e.target.value)}
                        placeholder="Catatan transfer (opsional, contoh: Transfer via BCA an Budi)"
                        className="w-full text-xs px-3.5 py-2.5 rounded-[8px] border border-[#E8E8EC] outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] transition-all bg-white"
                      />

                      {proofError ? (
                        <div className="text-xs text-red-600 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{proofError}</span>
                        </div>
                      ) : null}

                      <Button
                        type="button"
                        onClick={handleUploadProof}
                        isLoading={uploadingProof}
                        disabled={!proofFile || uploadingProof}
                        className="w-full h-10 text-xs font-bold"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Kirim Bukti Pembayaran
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-[8px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                      <span className="font-bold block">Paket Anda Telah Aktif!</span>
                      <span className="text-[11px] text-emerald-700 block">
                        Pembayaran telah diverifikasi oleh admin. Batas kuota dan pengingat WhatsApp pada akun Anda telah diperbarui.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right 5 Cols: Order Summary & Navigation */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
              <Card className="p-0 overflow-hidden border-[#E8E8EC] shadow-sm">
                <CardHeader className="px-5 py-4 border-b border-[#E8E8EC]">
                  <CardTitle className="text-base font-bold">Ringkasan Pesanan</CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="p-3.5 rounded-[8px] bg-zinc-50 border border-zinc-200/60">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#0A0A0A]">
                        Paket {activeTx.plan_name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        1 Bulan
                      </Badge>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-[11px] text-[#6B6B6B]">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {activeTx.plan_course_limit} Mata Kuliah</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {activeTx.plan_task_limit} Tugas Aktif</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {activeTx.plan_notification_limit} Pengingat WhatsApp</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#6B6B6B]">
                      <span>Harga Paket</span>
                      <span className="font-medium text-[#0A0A0A]">
                        {formatRupiah(activeTx.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#6B6B6B]">
                      <span>Biaya Layanan ({activeTx.payment_method_name})</span>
                      <span className="font-medium text-[#0A0A0A]">
                        {activeTx.fee_amount === 0 ? "Gratis (Rp 0)" : formatRupiah(activeTx.fee_amount)}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-[#E8E8EC] flex justify-between items-baseline">
                      <span className="text-sm font-bold text-[#0A0A0A]">Total Pembayaran</span>
                      <span className="text-lg font-extrabold text-[#6366F1]">
                        {formatRupiah(activeTx.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <Link href={`/dashboard/transactions?id=${activeTx.id}`} className="block">
                      <Button variant="outline" className="w-full text-xs font-semibold">
                        Lihat di Riwayat Transaksi
                      </Button>
                    </Link>

                    <Link href="/dashboard" className="block">
                      <Button variant="ghost" className="w-full text-xs text-[#6B6B6B]">
                        Kembali ke Dashboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW B: PLAN SELECTION & CHECKOUT FORM
  // ==========================================
  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Back Link */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#0A0A0A] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Pilihan Paket</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
              Checkout Langganan
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6B6B] mt-1">
              Selesaikan pembayaran manual untuk mengaktifkan kuota paket Anda.
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-emerald-700 bg-emerald-50 border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            Pembayaran Aman Terverifikasi
          </Badge>
        </div>

        {error ? (
          <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Selections (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Pilih Paket */}
            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-[#E8E8EC]">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#6366F1] text-white text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span>Pilihan Paket</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {plans.map((p) => {
                    const isSelected = p.id === selectedPlanId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`text-left p-3.5 rounded-[10px] border transition-all cursor-pointer flex sm:flex-col justify-between items-center sm:items-stretch gap-3 ${
                          isSelected
                            ? "border-[#6366F1] bg-indigo-50/40 ring-1 ring-[#6366F1] shadow-xs"
                            : "border-[#E8E8EC] hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-xs sm:text-sm text-[#0A0A0A] block">{p.name}</span>
                          <div className="mt-1 font-extrabold text-sm sm:text-base text-[#0A0A0A]">
                            {formatRupiah(p.price)}
                          </div>
                          <div className="mt-1 text-[10px] sm:text-[11px] text-[#6B6B6B]">
                            {p.course_limit} Matkul • {p.task_limit} Tugas
                          </div>
                        </div>

                        {/* Perfectly centered radio/checkmark indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all sm:self-end ${
                            isSelected
                              ? "border-[#6366F1] bg-[#6366F1] text-white shadow-xs"
                              : "border-zinc-300 bg-white"
                          }`}
                        >
                          {isSelected ? <Check className="w-3 h-3 text-white stroke-[2.5]" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Pilih Metode Pembayaran */}
            <Card className="p-0 overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-[#E8E8EC]">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span>Metode Pembayaran</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Pilih transfer antar rekening bank atau pindai QRIS instan.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-3">
                {paymentMethods.map((pm) => {
                  const isSelected = pm.id === selectedMethodId;
                  const isBank = pm.type === "bank_transfer";

                  return (
                    <div
                      key={pm.id}
                      onClick={() => setSelectedMethodId(pm.id)}
                      className={`p-3.5 sm:p-4 rounded-[10px] border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#6366F1] bg-indigo-50/20 ring-1 ring-[#6366F1]"
                          : "border-[#E8E8EC] hover:border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${
                              isBank
                                ? "bg-blue-50 text-blue-600 border border-blue-100"
                                : "bg-purple-50 text-purple-600 border border-purple-100"
                            }`}
                          >
                            {isBank ? (
                              <CreditCard className="w-5 h-5" />
                            ) : (
                              <QrCode className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs sm:text-sm text-[#0A0A0A] truncate">
                              {pm.name}
                            </div>
                            <div className="text-[11px] text-[#6B6B6B] truncate">
                              {isBank
                                ? `${pm.bank_name || "Bank"} • a/n ${pm.account_name || "-"}`
                                : "Semua E-Wallet & Mobile Banking"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-[11px] font-medium text-[#6B6B6B] whitespace-nowrap">
                              {pm.fee_type === "fixed" && pm.fee_fixed === 0
                                ? "Bebas Biaya"
                                : pm.fee_type === "fixed"
                                ? `+${formatRupiah(pm.fee_fixed)}`
                                : `+${pm.fee_percentage}%`}
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                              isSelected
                                ? "border-[#6366F1] bg-[#6366F1] text-white shadow-xs"
                                : "border-zinc-300 bg-white"
                            }`}
                          >
                            {isSelected ? <Check className="w-3 h-3 text-white stroke-[2.5]" /> : null}
                          </div>
                        </div>
                      </div>

                      {/* Detail Rekening / QRIS ketika dipilih */}
                      {isSelected ? (
                        <div className="mt-3.5 pt-3.5 border-t border-indigo-100/70 text-xs">
                          {isBank ? (
                            <div className="bg-white p-3 rounded-[8px] border border-zinc-200 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-[10px] text-[#9C9C9C] uppercase font-semibold">
                                  Nomor Rekening {pm.bank_name}
                                </div>
                                <div className="font-mono font-bold text-sm text-[#0A0A0A] mt-0.5 tracking-wide">
                                  {pm.account_number}
                                </div>
                                <div className="text-[11px] text-[#6B6B6B]">
                                  Atas Nama: <strong>{pm.account_name}</strong>
                                </div>
                              </div>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText("pm_account", pm.account_number || "");
                                }}
                                className="flex items-center gap-1 shrink-0"
                              >
                                {copiedKey === "pm_account" ? (
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
                            </div>
                          ) : (
                            <div className="bg-white p-3 rounded-[8px] border border-zinc-200 flex flex-col items-center justify-center text-center">
                              {pm.qris_image_url ? (
                                <img
                                  src={pm.qris_image_url}
                                  alt="QRIS Barcode"
                                  className="w-44 h-44 object-contain rounded-[6px] border border-zinc-100 mb-2"
                                />
                              ) : (
                                <div className="w-36 h-36 bg-zinc-100 rounded-[6px] flex items-center justify-center text-zinc-400 mb-2">
                                  <QrCode className="w-12 h-12" />
                                </div>
                              )}
                              <div className="font-semibold text-xs text-[#0A0A0A]">
                                {pm.account_name || "Task Reminder Official"}
                              </div>
                              <div className="text-[11px] text-[#6B6B6B] mt-0.5">
                                Pindai QRIS ini melalui aplikasi m-banking atau e-wallet Anda.
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Order Summary (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            <Card className="p-0 overflow-hidden border-[#E8E8EC] shadow-sm">
              <CardHeader className="px-5 py-4 border-b border-[#E8E8EC]">
                <CardTitle className="text-base font-bold">Ringkasan Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {selectedPlan ? (
                  <div className="p-3.5 rounded-[8px] bg-zinc-50 border border-zinc-200/60">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#0A0A0A]">
                        Paket {selectedPlan.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        1 Bulan
                      </Badge>
                    </div>
                    <ul className="mt-2.5 space-y-1.5 text-[11px] text-[#6B6B6B]">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {selectedPlan.course_limit} Mata Kuliah</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {selectedPlan.task_limit} Tugas Aktif</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Maksimal {selectedPlan.notification_limit} Pengingat WhatsApp</span>
                      </li>
                    </ul>
                  </div>
                ) : null}

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Harga Paket</span>
                    <span className="font-medium text-[#0A0A0A]">{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Biaya Layanan</span>
                    <span className="font-medium text-[#0A0A0A]">
                      {feeAmount === 0 ? "Gratis (Rp 0)" : formatRupiah(feeAmount)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-[#E8E8EC] flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[#0A0A0A]">Total Pembayaran</span>
                    <span className="text-lg font-extrabold text-[#6366F1]">
                      {formatRupiah(totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleCreateCheckout}
                    isLoading={submitting}
                    disabled={!selectedPlanId || !selectedMethodId || submitting}
                    className="w-full h-11 text-sm font-bold"
                  >
                    Bayar Sekarang • {formatRupiah(totalAmount)}
                  </Button>
                </div>

                <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200/70 text-[11px] text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Batas Waktu: 24 Jam</span>
                  </div>
                  <p className="leading-relaxed">
                    Setelah klik bayar, instruksi nomor rekening / QRIS dan formulir unggah bukti transfer akan langsung ditampilkan di halaman ini.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-[#9C9C9C]">
          Menyiapkan checkout...
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}