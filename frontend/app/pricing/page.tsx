"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Info, ShieldCheck, Sparkles, HelpCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Plan } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Footer } from "@/components/Footer";

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaidPlan, setSelectedPaidPlan] = useState<Plan | null>(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await api.get<Plan[]>("/plans");
        if (data && data.length > 0) {
          setPlans(data);
        } else {
          // Fallback defaults
          setPlans(defaultFallbackPlans);
        }
      } catch {
        setPlans(defaultFallbackPlans);
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, []);

  const defaultFallbackPlans: Plan[] = [
    {
      id: "1",
      name: "Free",
      slug: "free",
      description: "Paket gratis untuk mencoba Task Reminder",
      price: 0,
      billing_period: "monthly",
      course_limit: 2,
      task_limit: 4,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: "2",
      name: "Basic",
      slug: "basic",
      description: "Paket hemat untuk mahasiswa santai",
      price: 5000,
      billing_period: "monthly",
      course_limit: 4,
      task_limit: 6,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: "3",
      name: "Sibuk",
      slug: "sibuk",
      description: "Paket pas untuk mahasiswa dengan aktivitas padat",
      price: 10000,
      billing_period: "monthly",
      course_limit: 6,
      task_limit: 10,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
    {
      id: "4",
      name: "SuperSibuk",
      slug: "supersibuk",
      description: "Paket maksimal tanpa batas untuk mahasiswa aktif & organisasi",
      price: 15000,
      billing_period: "monthly",
      course_limit: 15,
      task_limit: 30,
      is_active: true,
      created_at: "",
      updated_at: "",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 w-full">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Badge variant="outline" className="mb-3 text-[#6366F1] border-indigo-200 bg-indigo-50/50">
            Pilihan Paket Transparan
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0A0A0A] tracking-tight">
            Harga Terjangkau untuk Mahasiswa
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#6B6B6B]">
            Pilih paket yang sesuai dengan jumlah mata kuliah dan intensitas tugas Anda di tiap semester.
          </p>
        </div>

        {/* Pricing Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-24 text-sm text-[#9C9C9C]">
            Memuat daftar paket...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const isFree = p.price === 0;
              const isPopular = p.slug === "basic";

              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col justify-between bg-white rounded-[12px] p-6 border transition-all ${
                    isPopular
                      ? "border-[#6366F1] shadow-md ring-1 ring-[#6366F1]/30"
                      : "border-[#E8E8EC] shadow-xs"
                  }`}
                >
                  {isPopular ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-[#6366F1] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                        Paling Populer
                      </span>
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-[#0A0A0A]">{p.name}</h2>
                      {isFree ? (
                        <Badge variant="success">Gratis</Badge>
                      ) : null}
                    </div>

                    <p className="text-xs text-[#6B6B6B] mt-2 min-h-[36px]">{p.description}</p>

                    <div className="mt-5 pb-5 border-b border-[#E8E8EC]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-[#0A0A0A]">
                          {formatRupiah(p.price)}
                        </span>
                        {!isFree ? (
                          <span className="text-xs text-[#6B6B6B]">/bulan</span>
                        ) : null}
                      </div>
                    </div>

                    <ul className="mt-5 space-y-3 text-xs text-[#0A0A0A]">
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hingga <strong>{p.course_limit}</strong> Mata Kuliah</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Hingga <strong>{p.task_limit}</strong> Tugas Aktif</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Pengingat WhatsApp H-2 Otomatis</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Status Overdue Real-time</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8">
                    {isFree ? (
                      <Link href="/register" className="block w-full">
                        <Button variant="secondary" className="w-full">
                          Mulai Gratis
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant={isPopular ? "primary" : "outline"}
                        className="w-full"
                        onClick={() => setSelectedPaidPlan(p)}
                      >
                        Pilih Paket
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature Notice */}
        <div className="mt-14 p-5 rounded-[12px] bg-white border border-[#E8E8EC] max-w-2xl mx-auto flex items-start gap-3">
          <Info className="w-5 h-5 text-[#6366F1] shrink-0 mt-0.5" />
          <div className="text-xs text-[#6B6B6B] leading-relaxed">
            <strong className="text-[#0A0A0A]">Informasi Pembelian:</strong> Selama masa pengembangan, seluruh pengguna baru dapat menikmati aplikasi secara gratis tanpa batasan kuota. Fitur langganan berbayar akan dibuka ketika gerbang pembayaran resmi diaktifkan.
          </div>
        </div>
      </div>

      {/* Paid Plan Info Dialog */}
      <Dialog
        open={Boolean(selectedPaidPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPaidPlan(null);
        }}
        title={`Paket ${selectedPaidPlan?.name || ""}`}
        description="Informasi ketersediaan paket"
      >
        <div className="space-y-4 text-xs text-[#6B6B6B]">
          <div className="p-4 rounded-[8px] bg-indigo-50/60 border border-indigo-100 text-[#0A0A0A]">
            <p className="font-semibold text-sm text-[#6366F1] mb-1">
              Harga: {selectedPaidPlan ? formatRupiah(selectedPaidPlan.price) : 0} / bulan
            </p>
            <p>
              Paket ini mencakup kuota hingga <strong>{selectedPaidPlan?.course_limit} mata kuliah</strong> dan <strong>{selectedPaidPlan?.task_limit} tugas aktif</strong>.
            </p>
          </div>

          <p className="leading-relaxed">
            Sistem pembayaran mandiri untuk paket berbayar saat ini belum dibuka untuk umum. Anda dapat mendaftar akun sekarang dan menikmati seluruh fitur Task Reminder secara gratis!
          </p>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelectedPaidPlan(null)}>
              Tutup
            </Button>
            <Link href="/register" onClick={() => setSelectedPaidPlan(null)}>
              <Button size="sm">
                Daftar Akun Gratis Sekarang
              </Button>
            </Link>
          </div>
        </div>
      </Dialog>

      <Footer />
    </div>
  );
}
