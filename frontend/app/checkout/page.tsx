"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
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
  HelpCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { api, paymentMethodsApi, transactionsApi } from "@/lib/api";
import { PaymentMethod, Plan } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const { user, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planParam || "");
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/checkout${planParam ? `?plan=${planParam}` : ""}`);
    }
  }, [user, authLoading, router, planParam]);

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

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        // Redirect to user transactions page with newly created transaction highlighted
        router.push(`/dashboard/transactions?id=${res.id}&new=1`);
      } else {
        router.push("/dashboard/transactions");
      }
    } catch (err: any) {
      setError(err.message || "Gagal membuat transaksi checkout");
      setSubmitting(false);
    }
  };

  if (authLoading || (loading && !plans.length)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-sm text-[#9C9C9C]">
        Menyiapkan halaman pembayaran...
      </div>
    );
  }

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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#6366F1] text-white text-[11px] flex items-center justify-center">
                      1
                    </span>
                    <span>Pilihan Paket</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {plans.map((p) => {
                    const isSelected = p.id === selectedPlanId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`text-left p-3 rounded-[8px] border transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#6366F1] bg-indigo-50/40 ring-1 ring-[#6366F1]"
                            : "border-[#E8E8EC] hover:border-zinc-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#0A0A0A]">{p.name}</span>
                          {isSelected ? (
                            <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
                          ) : null}
                        </div>
                        <div className="mt-1 font-extrabold text-sm text-[#0A0A0A]">
                          {formatRupiah(p.price)}
                        </div>
                        <div className="mt-1 text-[10px] text-[#6B6B6B]">
                          {p.course_limit} Matkul • {p.task_limit} Tugas
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Pilih Metode Pembayaran */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#6366F1] text-white text-[11px] flex items-center justify-center">
                    2
                  </span>
                  <span>Metode Pembayaran</span>
                </CardTitle>
                <CardDescription>
                  Pilih transfer antar rekening bank atau pindai QRIS instan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {paymentMethods.map((pm) => {
                  const isSelected = pm.id === selectedMethodId;
                  const isBank = pm.type === "bank_transfer";

                  return (
                    <div
                      key={pm.id}
                      onClick={() => setSelectedMethodId(pm.id)}
                      className={`p-4 rounded-[10px] border cursor-pointer transition-all ${
                        isSelected
                          ? "border-[#6366F1] bg-indigo-50/20 ring-1 ring-[#6366F1]"
                          : "border-[#E8E8EC] hover:border-zinc-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
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
                          <div>
                            <div className="font-semibold text-xs sm:text-sm text-[#0A0A0A]">
                              {pm.name}
                            </div>
                            <div className="text-[11px] text-[#6B6B6B]">
                              {isBank
                                ? `${pm.bank_name || "Bank"} • a/n ${pm.account_name || "-"}`
                                : "Semua E-Wallet & Mobile Banking"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[11px] font-medium text-[#6B6B6B]">
                              {pm.fee_type === "fixed" && pm.fee_fixed === 0
                                ? "Bebas Biaya"
                                : pm.fee_type === "fixed"
                                ? `+${formatRupiah(pm.fee_fixed)}`
                                : `+${pm.fee_percentage}%`}
                            </span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-[#6366F1] bg-[#6366F1] text-white"
                                : "border-zinc-300"
                            }`}
                          >
                            {isSelected ? <div className="w-1.5 h-1.5 bg-white rounded-full" /> : null}
                          </div>
                        </div>
                      </div>

                      {/* Detail Rekening / QRIS ketika dipilih */}
                      {isSelected ? (
                        <div className="mt-3.5 pt-3.5 border-t border-indigo-100/70 text-xs">
                          {isBank ? (
                            <div className="bg-white p-3 rounded-[8px] border border-zinc-200 flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-[#9C9C9C] uppercase font-semibold">
                                  Nomor Rekening {pm.bank_name}
                                </div>
                                <div className="font-mono font-bold text-sm text-[#0A0A0A] mt-0.5">
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
                                  handleCopy(pm.account_number || "");
                                }}
                                className="flex items-center gap-1"
                              >
                                {copied ? (
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
                                  className="w-48 h-48 object-contain rounded-[6px] border border-zinc-100 mb-2"
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
            <Card className="border-[#E8E8EC] shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold">Ringkasan Pembayaran</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    Setelah transfer, silakan unggah foto bukti transfer di halaman transaksi. Instruksi lengkap juga otomatis kami kirimkan ke nomor WhatsApp Anda ({user?.whatsapp_number}).
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
