# ✨ Task Reminder ✨

> Aplikasi pengelolaan tugas kuliah dan pengingat deadline otomatis langsung ke WhatsApp, dibangun dengan arsitektur modern berkinerja tinggi: **Next.js (App Router) + Go (Fiber & whatsmeow) + SQLite**.

---

## 🚀 Gambaran Arsitektur

```text
Browser / PWA (Mobile & Desktop)
        │
        │ HTTP / JSON
        ▼
   Next.js 15 (App Router, Tailwind CSS v4, shadcn/ui)
        │
        │ API Reverse Proxy (/api/v1)
        ▼
   Go Fiber Backend
        ├──── SQLite Database (modernc.org/sqlite - Pure Go)
        ├──── Internal Go Deadline Scheduler (Asia/Jakarta)
        └──── WhatsApp Gateway (whatsmeow Multi-Device)
                    │
                    ▼
          Pesan Pengingat WhatsApp
```

### 1. Frontend
- **Framework:** Next.js 15 dengan App Router & Server Components
- **Styling:** Tailwind CSS v4 (konfigurasi CSS langsung di `app/globals.css`, tanpa `tailwind.config.js`)
- **Desain:** Mengikuti design tokens `DESIGN.md` (Indigo `#6366F1`, Surface `#FFFFFF`, Radius 6px/12px)
- **Komponen:** shadcn/ui & Radix UI primitives
- **PWA:** Dukungan Web App Manifest dan pengalaman instalasi di smartphone
- **Optimasi:** Mengikuti panduan performa Vercel React Best Practices (meniadakan waterfalls, derivasi state saat render, rendering ternary)

### 2. Backend
- **Bahasa:** Go (Golang)
- **Framework HTTP:** Fiber v2
- **Database:** SQLite dengan foreign keys aktif & WAL mode via driver pure-Go (`modernc.org/sqlite`), tanpa memerlukan compiler CGO/GCC
- **WhatsApp Gateway:** `go.mau.fi/whatsmeow` dengan penyimpanan multi-device SQLite persisten
- **Scheduler:** Goroutine scheduler internal yang memeriksa tenggat tugas secara akurat pada zona waktu `Asia/Jakarta`
- **Autentikasi & Keamanan:** Session berbasis cookie `HttpOnly`, `SameSite: Lax`, hashing password menggunakan `bcrypt`, serta isolasi data antarpengguna

---

## 🎯 Fitur-Fitur Utama

### 1. Halaman Publik & Pricing
- **Landing Page (`/`):** Hero section, fitur utama, cara kerja, ringkasan pilihan paket, dan footer lengkap.
- **Halaman Pricing (`/pricing`):** Menampilkan 4 paket default dalam format Rupiah:
  - **Free:** Rp0 / bulan (2 Mata Kuliah, 4 Tugas)
  - **Basic:** Rp5.000 / bulan (4 Mata Kuliah, 6 Tugas, badge Populer)
  - **Sibuk:** Rp10.000 / bulan (6 Mata Kuliah, 10 Tugas)
  - **SuperSibuk:** Rp15.000 / bulan (15 Mata Kuliah, 30 Tugas)

### 2. Autentikasi & Akun
- **Registrasi:** Nama lengkap, nomor WhatsApp, dan password.
- **Normalisasi Nomor WhatsApp:** Menerima format `08xxx`, `+62xxx`, `62xxx`, atau `8xxx` dan dinormalisasi menjadi `62xxxxxxxxxx`.
- **Login & Logout:** Keamanan cookie sesi `HttpOnly`.

### 3. Dashboard Mahasiswa
- **Ringkasan Metrik:** Jumlah tugas aktif, tugas selesai, mendekati deadline (48 jam), dan tugas terlambat.
- **Alert Terlambat:** Peringatan visual jika terdapat tugas yang melewati batas waktu.
- **Tugas Terdekat:** Daftar tugas mendatang dengan aksi cepat untuk menandai tugas selesai.

### 4. Manajemen Tugas Kuliah
- **CRUD Tugas:** Judul, mata kuliah, deskripsi, tanggal & jam deadline, prioritas (Low, Medium, High).
- **Pengingat WhatsApp:** Pilihan waktu pengingat (H-2, H-1, H-3, atau 12 jam sebelum deadline).
- **Filter & Pencarian:** Filter berdasarkan status, mata kuliah, dan prioritas.

### 5. Manajemen Mata Kuliah
- **CRUD Mata Kuliah:** Nama, kode kuliah, nama dosen, warna identitas, dan jumlah tugas terhubung.
- **Penghapusan Aman:** Memperingatkan pengguna jika mata kuliah masih memiliki tugas yang terhubung.

### 6. Pengaturan Mahasiswa
- Profil dan nomor WhatsApp penerima.
- Form ubah password.
- Preferensi pengingat global dan zona waktu.
- Riwayat notifikasi WhatsApp yang telah diproses oleh bot.

### 7. Panel Administrasi (Khusus Admin)
- **Ringkasan Admin (`/admin`):** Pantau jumlah pengguna, status gateway WhatsApp, dan paket aktif.
- **Kelola Pengguna (`/admin/users`):** Pencarian user, tambah user manual, ubah role admin/user, aktivasi akun, dan hapus user (dengan proteksi terhadap diri sendiri).
- **Manage Plans (`/admin/plans`):** Konfigurasi daftar paket penawaran, penetapan harga Rupiah, kuota kuliah, dan kuota tugas.
- **WhatsApp Gateway (`/admin/whatsapp`):** Memulai proses pairing dengan QR code real-time, melihat status login, dan memutus sesi bot.

---

## 🛠️ Menjalankan Proyek Secara Lokal

### Persyaratan
- Node.js >= 20 & pnpm 12
- Go >= 1.22

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/oxydaid/task-reminder.git
cd task-reminder
pnpm install
```

### 2. Menjalankan Backend Go
```bash
cd backend
go run ./cmd/server
```
Backend akan aktif di `http://127.0.0.1:8080` dan menginisialisasi database SQLite di `./data/task-reminder.sqlite` secara otomatis.

Akun admin bawaan (default seed):
- **Nomor WhatsApp:** `6281234567890`
- **Password:** `adminpassword123`

### 3. Menjalankan Frontend Next.js
Buka terminal baru:
```bash
pnpm dev:frontend
```
Buka browser di `http://localhost:3000`.

---

## 📦 Build Produksi

### Build Semua Komponen
```bash
# Build frontend Next.js dan backend Go
pnpm build
```

Binary Go akan dikompilasi ke `./bin/server` dan Next.js siap dijalankan via `pnpm start:frontend`.

---

## 🐳 Deployment (Docker & Pterodactyl)

### 1. Docker Compose
```bash
docker compose up -d --build
```
Aplikasi akan aktif di port `3000` dengan volume persisten `app_data:/app/data`.

### 2. Pterodactyl Panel
Gunakan konfigurasi egg yang tersedia di `pterodactyl-egg.json`:
- **Docker image:** `ghcr.io/parkervcp/yolks:node_20`
- **Startup script:** `./entrypoint.sh`
- Pastikan volume `/app/data` dipetakan ke penyimpanan persisten Pterodactyl server Anda.

### Environment Variables
| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Port publik aplikasi (Next.js) |
| `BACKEND_PORT` | `8080` | Port internal Go Fiber |
| `DATABASE_PATH` | `/app/data/task-reminder.sqlite` | Lokasi file SQLite utama |
| `WHATSAPP_STORE_PATH` | `/app/data/whatsapp.sqlite` | Lokasi penyimpanan sesi whatsmeow |
| `APP_TIMEZONE` | `Asia/Jakarta` | Zona waktu aplikasi |
| `ADMIN_PHONE` | `6281234567890` | Nomor admin awal |
| `ADMIN_PASSWORD` | `adminpassword123` | Password admin awal |

---

## 📄 Lisensi
Hak Cipta © 2026 Task Reminder Team. Dibuat untuk mahasiswa Indonesia 🇮🇩.
