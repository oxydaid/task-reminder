import Link from "next/link";
import { CheckCircle2, Bell, BookOpen, Clock, ShieldCheck, ArrowRight, Zap, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  const steps = [
    {
      num: "01",
      title: "Catat Mata Kuliah & Tugas",
      desc: "Masukkan daftar mata kuliah semester ini dan tambahkan tugas beserta tanggal serta jam tenggat waktunya.",
      icon: BookOpen,
    },
    {
      num: "02",
      title: "Pilih Waktu Pengingat",
      desc: "Secara default pengingat dikirim 2 hari sebelum deadline (H-2). Anda juga bisa menyesuaikan offset sesuai kebutuhan.",
      icon: Clock,
    },
    {
      num: "03",
      title: "Terima Notifikasi WhatsApp",
      desc: "Bot WhatsApp kami akan mengirimkan pengingat otomatis ke nomor Anda tepat waktu, lengkap dengan rincian tugas.",
      icon: Bell,
    },
  ];

  const features = [
    {
      title: "Notifikasi Otomatis via WhatsApp",
      desc: "Tidak perlu install aplikasi tambahan yang berat. Pengingat masuk langsung ke chat WhatsApp yang Anda buka setiap hari.",
      icon: Smartphone,
    },
    {
      title: "Dashboard Terorganisir",
      desc: "Pantau tugas aktif, tugas mendekati tenggat, dan tugas yang sudah selesai dengan visualisasi status yang jelas.",
      icon: Zap,
    },
    {
      title: "Koneksi Aman & Privat",
      desc: "Data tugas dan mata kuliah terisolasi penuh untuk masing-masing mahasiswa dengan enkripsi password terstandar.",
      icon: ShieldCheck,
    },
  ];

  const pricingPreview = [
    { name: "Free", price: "Gratis", courses: 2, tasks: 4, badge: "Gratis", popular: false },
    { name: "Basic", price: "Rp5.000/bln", courses: 4, tasks: 6, badge: "Populer", popular: true },
    { name: "Sibuk", price: "Rp10.000/bln", courses: 6, tasks: 10, badge: null, popular: false },
    { name: "SuperSibuk", price: "Rp15.000/bln", courses: 15, tasks: 30, badge: null, popular: false },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative px-4 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-indigo-50 border border-indigo-100 text-[#6366F1] text-xs font-semibold">
          <span className="flex h-2 w-2 rounded-full bg-[#6366F1] animate-pulse" />
          Pengingat Tugas Mahasiswa Otomatis
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#0A0A0A] leading-[1.15]">
          Jangan Sampai Terlambat Kumpul <span className="text-[#6366F1]">Tugas Kuliah</span> Lagi.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#6B6B6B] max-w-2xl mx-auto leading-relaxed">
          Task Reminder membantu mahasiswa mengelola tugas kuliah dan menerima pengingat otomatis langsung melalui pesan WhatsApp sebelum deadline berakhir.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto text-base">
              Mulai Sekarang Gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
          <Link href="/pricing" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto text-base">
              Lihat Pilihan Pricing
            </Button>
          </Link>
        </div>

        {/* Preview Message mockup */}
        <div className="mt-14 max-w-md mx-auto text-left bg-white border border-[#E8E8EC] rounded-[16px] p-5 shadow-lg relative">
          <div className="flex items-center gap-3 pb-3 border-b border-[#E8E8EC]">
            <div className="w-9 h-9 rounded-full bg-[#20970B] text-white flex items-center justify-center font-bold text-xs">
              WA
            </div>
            <div>
              <div className="font-semibold text-xs text-[#0A0A0A]">Task Reminder Bot</div>
              <div className="text-[11px] text-emerald-600 font-medium">Online</div>
            </div>
          </div>
          <div className="mt-3.5 bg-emerald-50/70 border border-emerald-100 rounded-[10px] p-3.5 text-xs text-[#0A0A0A] leading-relaxed">
            <p className="font-medium">Halo! 👋 Pengingat tugas kamu:</p>
            <div className="mt-2 space-y-1 text-zinc-700">
              <p><strong className="text-zinc-900">Judul:</strong> Laporan Analisis Algoritma</p>
              <p><strong className="text-zinc-900">Mata Kuliah:</strong> Desain & Analisis Algoritma</p>
              <p><strong className="text-zinc-900">Deadline:</strong> Besok, 23.59 WIB</p>
            </div>
            <p className="mt-2.5 text-emerald-700 font-medium">Jangan lupa diselesaikan, ya! 💪</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-white py-20 border-y border-[#E8E8EC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
              Cara Kerja Sederhana
            </h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              Tiga langkah mudah untuk memastikan seluruh deadline tugas Anda terkawal dengan aman.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="relative flex flex-col p-6 rounded-[12px] border border-[#E8E8EC] bg-[#FAFAFA]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-[#6366F1] bg-indigo-50 px-2 py-1 rounded-[4px]">
                      Langkah {s.num}
                    </span>
                    <Icon className="w-5 h-5 text-[#6366F1]" />
                  </div>
                  <h3 className="font-semibold text-base text-[#0A0A0A] mb-2">{s.title}</h3>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
            Didesain Khusus untuk Mahasiswa
          </h2>
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Fokus pada esensi: mudah digunakan di smartphone, ringan, dan tidak berbelit-belit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="card-hover">
                <CardHeader>
                  <div className="w-10 h-10 rounded-[8px] bg-indigo-50 flex items-center justify-center text-[#6366F1] mb-2">
                    <Icon className="w-5 h-5" />
                  </div>
                  <CardTitle>{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-[#6B6B6B] leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="bg-white py-20 border-y border-[#E8E8EC]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A0A0A]">
              Pilihan Paket yang Fleksibel
            </h2>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              Mulai gratis tanpa biaya. Upgrade kapasitas mata kuliah & tugas kapan pun Anda butuhkan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPreview.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col justify-between p-5 rounded-[12px] border ${
                  plan.popular ? "border-[#6366F1] bg-indigo-50/20 shadow-sm" : "border-[#E8E8EC] bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base text-[#0A0A0A]">{plan.name}</h3>
                    {plan.badge ? (
                      <Badge variant={plan.popular ? "default" : "outline"} className={plan.popular ? "bg-[#6366F1] text-white border-transparent" : ""}>
                        {plan.badge}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 text-2xl font-bold text-[#0A0A0A]">{plan.price}</div>
                  <div className="mt-4 pt-4 border-t border-[#E8E8EC] space-y-2 text-xs text-[#6B6B6B]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Maksimal <strong>{plan.courses}</strong> Mata Kuliah</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Maksimal <strong>{plan.tasks}</strong> Tugas Aktif</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Pengingat WhatsApp H-2</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Link href="/pricing" className="block w-full">
                    <Button variant={plan.popular ? "primary" : "secondary"} size="sm" className="w-full">
                      Lihat Detail
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link href="/pricing" className="inline-flex items-center text-sm font-medium text-[#6366F1] hover:underline">
              Bandingkan semua fitur di halaman Pricing <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-center max-w-3xl mx-auto px-4">
        <h2 className="text-3xl font-extrabold text-[#0A0A0A] tracking-tight">
          Siap Mencapai IPK Maksimal Tanpa Tugas Terlewat?
        </h2>
        <p className="mt-3 text-sm text-[#6B6B6B]">
          Daftar akun sekarang hanya dengan nomor WhatsApp dan nama Anda. Tanpa kartu kredit.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/register">
            <Button size="lg" className="text-base px-8">
              Daftar Sekarang — Gratis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
