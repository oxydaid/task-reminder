"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, Sparkles, HelpCircle, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { Plan } from "@/types";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>(() => {
    return api.peekCache<Plan[]>("/plans") || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !api.peekCache<Plan[]>("/plans");
  });

  useEffect(() => {
    async function loadPlans() {
      try {
        const data = await api.getCached<Plan[]>("/plans", 5 * 60 * 1000);
        if (data && data.length > 0) {
          setPlans(data);
        } else if (!plans.length) {
          setPlans(defaultFallbackPlans);
        }
      } catch {
        if (!plans.length) {
          setPlans(defaultFallbackPlans);
        }
      } finally {
        setLoading(false);
      }
    }
    loadPlans();
  }, [plans.length]);

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
      notification_limit: 3,
      is_active: true,
      sort_order: 1,
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
      notification_limit: 5,
      is_active: true,
      sort_order: 2,
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
      notification_limit: 7,
      is_active: true,
      sort_order: 3,
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
      notification_limit: 10,
      is_active: true,
      sort_order: 4,
      created_at: "",
      updated_at: "",
    },
  ];

  const handleSelectPlan = (plan: Plan) => {
    if (plan.price === 0) {
      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/register");
      }
    } else {
      if (user) {
        router.push(`/checkout?plan=${plan.id}`);
      } else {
        router.push(`/login?redirect=/checkout?plan=${plan.id}`);
      }
    }
  };

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
            Pilih paket yang sesuai dengan jumlah mata kuliah dan intensitas tugas Anda di tiap semester. Bayar mudah via Transfer Bank & QRIS.
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
              const isPopular = p.slug === "sibuk" || p.slug === "basic";

              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col justify-between bg-white rounded-[12px] p-6 border transition-all ${
                    isPopular
                      ? "border-[#6366F1] shadow-md ring-1 ring-[#6366F1]/30"
                      : "border-[#E8E8EC] shadow-xs hover:border-zinc-300"
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
                        <span>Hingga <strong>{p.notification_limit || 3}</strong> Pengingat WhatsApp Aktif</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Notifikasi Tenggat H-2, H-1 & Hari H</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tersimpan Aman Tanpa Hapus Data</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8">
                    {isFree ? (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => handleSelectPlan(p)}
                      >
                        {user ? "Buka Dashboard" : "Mulai Gratis"}
                      </Button>
                    ) : (
                      <Button
                        variant={isPopular ? "primary" : "outline"}
                        className="w-full flex items-center justify-center gap-1.5"
                        onClick={() => handleSelectPlan(p)}
                      >
                        <span>Pilih Paket</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* FAQ & Manual Payment Notice */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <div className="p-5 rounded-[12px] bg-white border border-[#E8E8EC] shadow-xs">
            <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-[#0A0A0A]">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Metode Pembayaran Manual</span>
            </div>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Mendukung Transfer Bank (BCA, Mandiri) dan QRIS All Payment (GoPay, OVO, Dana, ShopeePay, Mobile Banking). Setelah transfer, cukup unggah bukti pembayaran dan Admin akan memverifikasi langganan Anda secara instan.
            </p>
          </div>

          <div className="p-5 rounded-[12px] bg-white border border-[#E8E8EC] shadow-xs">
            <div className="flex items-center gap-2 mb-2 font-semibold text-sm text-[#0A0A0A]">
              <HelpCircle className="w-4 h-4 text-[#6366F1]" />
              <span>Bagaimana jika paket berakhir?</span>
            </div>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              Jika masa aktif berakhir, akun Anda otomatis turun ke paket Free tanpa ada data mata kuliah maupun tugas yang dihapus! Anda tetap dapat melihat seluruh riwayat tugas Anda.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
