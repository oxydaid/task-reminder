# PRD — Task Reminder

## 1. Overview

**Task Reminder** adalah aplikasi pengingat tugas mahasiswa yang mengirimkan notifikasi melalui WhatsApp agar pengguna tidak lupa terhadap tenggat tugas.

### Tujuan
- Mengelola mata kuliah dan tugas dalam satu dashboard.
- Mengirim pengingat otomatis melalui WhatsApp sebelum deadline.
- Menyediakan autentikasi sederhana dan data yang terpisah untuk setiap pengguna.
- Tetap ringan, mudah dipelihara, dan siap dijalankan di Pterodactyl.

## 2. Tech Stack

### Frontend
- **Next.js** dengan App Router.
- TypeScript.
- Tailwind CSS v4, konfigurasi CSS langsung di `app/globals.css`, tanpa `tailwind.config.js`.
- shadcn/ui.
- PWA untuk pengalaman seperti aplikasi mobile.

### Backend
- **Go** sebagai bahasa utama.
- **Fiber** sebagai HTTP framework.
- **whatsmeow** sebagai koneksi WhatsApp.
- SQLite sebagai database.
- Scheduler internal Go untuk memeriksa jadwal pengingat.

### Deployment
- Pterodactyl dengan Docker image/runtime yang sesuai.
- Backend dan frontend dapat dijalankan sebagai dua proses dalam satu container, atau sebagai dua server terpisah.
- Gunakan satu sesi WhatsApp global untuk seluruh aplikasi.

## 3. Fitur Utama

### 3.1 Autentikasi
- Registrasi menggunakan nama, nomor WhatsApp, dan password.
- Login menggunakan nomor WhatsApp dan password.
- Logout dan pengelolaan sesi.
- Password disimpan menggunakan Argon2id atau bcrypt.
- Gunakan cookie `HttpOnly`, `Secure` pada HTTPS, serta perlindungan CSRF yang sesuai.
- Normalisasi nomor WhatsApp dan validasi input.

**Catatan:** Nomor telepon yang dimasukkan saat registrasi belum membuktikan kepemilikan nomor tersebut. Verifikasi nomor dapat ditambahkan jika dibutuhkan.

### 3.2 Normalisasi Nomor WhatsApp
Terima format input:
- `+628123456789`
- `628123456789`
- `08123456789`
- `8123456789`

Normalisasikan ke format kanonis `62xxxxxxxxxx`, lalu validasi dan cegah duplikasi nomor pengguna.

### 3.3 Dashboard
Tampilkan:
- Jumlah tugas aktif.
- Tugas selesai.
- Tugas yang mendekati deadline.
- Tugas terlambat.
- Daftar tugas terdekat.

### 3.4 Mata Kuliah
- Tambah, lihat, ubah, dan hapus mata kuliah.
- Setiap mata kuliah dimiliki oleh pengguna terkait.
- Mata kuliah yang masih memiliki tugas harus ditangani dengan aturan penghapusan yang jelas.

### 3.5 Tugas
Setiap tugas memiliki:
- Judul.
- Deskripsi opsional.
- Mata kuliah.
- Deadline.
- Status: pending atau completed.
- Pengaturan pengingat opsional.

Fitur:
- CRUD tugas.
- Filter berdasarkan mata kuliah, status, dan deadline.
- Tandai tugas selesai.
- Tampilkan status terlambat secara otomatis.
- Validasi agar tugas hanya dapat terhubung dengan mata kuliah milik pengguna yang sama.

### 3.6 Pengingat WhatsApp
- Pengingat default dikirim **2 hari sebelum deadline**.
- Pengguna dapat mengatur waktu pengingat.
- Mendukung beberapa interval, misalnya 2 hari dan 1 hari sebelum deadline.
- Hanya tugas pending yang memiliki deadline valid yang boleh diingatkan.
- Tugas selesai tidak menerima pengingat berikutnya.
- Gunakan zona waktu `Asia/Jakarta`.
- Pengingat diproses oleh backend, sehingga frontend tidak harus selalu terbuka.

Contoh pesan:

> Halo! 👋 Pengingat tugas kamu:
>
> **Judul:** Makalah Pemrograman  
> **Mata Kuliah:** Pemrograman Web  
> **Deadline:** 22 Oktober 2026, 23.59 WIB
>
> Jangan lupa diselesaikan, ya!

### 3.7 Koneksi WhatsApp
- Gunakan `whatsmeow` untuk menghubungkan satu akun WhatsApp pengirim.
- Satu sesi WhatsApp dipakai bersama oleh seluruh pengguna aplikasi.
- Pengguna tidak perlu menghubungkan akun WhatsApp masing-masing.
- Sediakan halaman admin untuk melihat status koneksi dan memindai QR saat pairing.
- Simpan kredensial sesi secara persisten, bukan hanya di memori.
- Tangani reconnect, disconnect, kegagalan pengiriman, dan shutdown dengan aman.
- Batasi akses pairing dan informasi sesi hanya untuk admin.

**Penting:** `whatsmeow` menggunakan protokol WhatsApp Web tidak resmi. Perubahan protokol dapat menyebabkan gangguan, dan penggunaan otomatisasi memiliki risiko pembatasan akun. Gunakan secara bertanggung jawab.

## 4. Arsitektur

```text
Browser / PWA
     |
     v
Next.js Frontend
     |
     | HTTP API
     v
Go + Fiber Backend
     |
     +---- SQLite
     |
     +---- Reminder Scheduler
     |
     +---- whatsmeow
                 |
                 v
          WhatsApp Gateway
                 |
                 v
           Nomor Pengguna
```

### Aturan arsitektur
- Next.js bertanggung jawab atas UI dan pengalaman pengguna.
- Go + Fiber menangani API, autentikasi, logika bisnis, scheduler, dan pengiriman WhatsApp.
- SQLite menyimpan data aplikasi serta status pengingat.
- Scheduler berjalan di backend, bukan di browser.
- Jangan menambahkan microservices, Redis, atau message broker sebelum benar-benar diperlukan.
- Pisahkan modul berdasarkan tanggung jawab agar mudah diuji dan dikembangkan.

## 5. Database SQLite

Tabel minimal:

- `users` — akun dan nomor pengguna.
- `sessions` — sesi autentikasi.
- `courses` — mata kuliah.
- `tasks` — tugas dan deadline.
- `user_settings` — preferensi pengingat.
- `reminder_logs` — riwayat pengingat dan status pengiriman.
- `whatsapp_state` — metadata status koneksi WhatsApp jika diperlukan.

### Ketentuan database
- Setiap data bisnis harus memiliki `user_id`.
- Terapkan foreign key, indeks, dan migrasi database.
- Gunakan query parameterized atau ORM yang sesuai.
- Terapkan transaksi pada operasi yang membutuhkan konsistensi.
- Kredensial sesi WhatsApp harus disimpan dengan aman dan persisten.
- Hindari menyimpan password atau secret dalam bentuk plaintext.
- Buat mekanisme backup database.

## 6. Pencegahan Pengingat Ganda

- Setiap pengingat memiliki identitas unik berdasarkan tugas, jadwal, dan penerima.
- Simpan status pengingat sebelum atau selama proses pengiriman secara konsisten.
- Catat status seperti `pending`, `sent`, dan `failed`.
- Jangan mengirim ulang pengingat yang sudah sukses hanya karena backend restart.
- Terapkan retry terbatas untuk kegagalan sementara.
- Scheduler harus dapat melanjutkan pekerjaan setelah aplikasi restart.
- Gunakan satu instance scheduler aktif agar tidak terjadi pengiriman ganda.

## 7. REST API

Prefix: `/api/v1`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Courses
- `GET /courses`
- `POST /courses`
- `GET /courses/:id`
- `PUT /courses/:id`
- `DELETE /courses/:id`

### Tasks
- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PUT /tasks/:id`
- `DELETE /tasks/:id`
- `PATCH /tasks/:id/complete`

### Settings
- `GET /settings`
- `PUT /settings`

### Admin
- `GET /admin/whatsapp/status`
- `POST /admin/whatsapp/pair`
- `POST /admin/whatsapp/logout`

### Health
- `GET /health`

Semua endpoint harus memvalidasi autentikasi, otorisasi, dan kepemilikan data. Endpoint admin hanya dapat digunakan oleh akun dengan role admin.

## 8. Struktur Folder

```text
task-reminder/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   ├── public/
│   ├── app/globals.css
│   └── package.json
├── backend/
│   ├── cmd/
│   │   └── server/
│   ├── internal/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── courses/
│   │   ├── tasks/
│   │   ├── reminders/
│   │   ├── whatsapp/
│   │   ├── database/
│   │   └── http/
│   ├── migrations/
│   ├── go.mod
│   └── go.sum
├── data/
├── DESIGN.md
├── PRD.md
├── .env.example
├── .gitignore
└── README.md
```

Sesuaikan struktur bila diperlukan, tetapi hindari pemecahan modul yang tidak memberikan manfaat nyata.

## 9. UI/UX dan PWA

- Mobile-first dan responsif.
- Desain minimalis, rapi, dan tidak ramai.
- Gunakan shadcn/ui untuk komponen antarmuka.
- Jadikan `DESIGN.md` sebagai pedoman warna, tipografi, spacing, layout, dan komponen.
- Halaman: login, registrasi, dashboard, tugas, mata kuliah, pengaturan, dan status WhatsApp khusus admin.
- Sediakan loading, empty state, error state, dan konfirmasi tindakan penting.
- PWA menyediakan manifest, ikon, dan service worker untuk aset statis.
- Jangan menyimpan halaman privat atau respons API sensitif dalam cache publik.
- Fitur offline penuh bukan prioritas.

## 10. Keamanan

- Validasi semua input di backend.
- Gunakan hashing password yang kuat.
- Lindungi autentikasi dari brute-force.
- Gunakan HTTPS di production.
- Batasi CORS ke origin frontend yang diizinkan.
- Terapkan rate limiting dan security headers.
- Pastikan pengguna tidak bisa membaca atau mengubah data pengguna lain.
- Jangan mengekspos token, kredensial WhatsApp, secret, atau stack trace.
- Jangan memasukkan file database dan kredensial sesi ke Git.

## 11. Deployment Production

Target utama adalah Pterodactyl.

### Persyaratan
- Konfigurasi port melalui environment variable.
- Frontend Next.js dijalankan dalam mode production.
- Backend Go dikompilasi menjadi binary Linux yang sesuai dengan environment.
- Gunakan direktori persisten untuk SQLite dan kredensial sesi WhatsApp.
- Pastikan restart container tidak menghapus database maupun sesi WhatsApp.
- Tangani `SIGTERM` dan `SIGINT` agar server berhenti secara graceful.
- Sediakan health check dan log yang informatif.
- Pisahkan konfigurasi development dan production.

### Pilihan deployment
1. **Satu container:** menjalankan binary Go dan Next.js production melalui entrypoint/supervisor sederhana.
2. **Dua container/server:** Next.js dan Go dijalankan terpisah, dengan API URL dan CORS yang dikonfigurasi dengan benar.

Untuk setup Pterodactyl yang sederhana, satu container dapat digunakan, tetapi proses Go dan Next.js harus sama-sama dipantau agar kegagalan salah satunya tidak tersembunyi. Jangan menjalankan beberapa scheduler atau sesi WhatsApp aktif secara bersamaan.

### Environment variable

Contoh nama konfigurasi:

- `PORT`
- `APP_ENV`
- `DATABASE_PATH`
- `FRONTEND_URL`
- `SESSION_SECRET`
- `ADMIN_PHONE`
- `WHATSAPP_STORE_PATH`
- `TIMEZONE`

Secret harus dibuat secara aman dan tidak di-commit ke repository.

## 12. Testing dan Acceptance Criteria

Aplikasi dianggap siap jika:

- Pengguna dapat registrasi, login, dan logout.
- Format nomor Indonesia dinormalisasi dengan benar.
- Pengguna dapat mengelola mata kuliah dan tugas.
- Data setiap pengguna terisolasi.
- Pengingat default 2 hari sebelum deadline berjalan.
- Pengingat tidak dikirim berulang setelah sukses.
- Pengingat berhenti setelah tugas selesai.
- Sesi WhatsApp tetap tersimpan setelah restart.
- Kegagalan koneksi WhatsApp tercatat dan dapat dipulihkan.
- Frontend responsif dan dapat diinstal sebagai PWA.
- Build frontend dan backend berhasil.
- Aplikasi dapat dijalankan di Pterodactyl dengan penyimpanan persisten.

## 13. Instruksi Implementasi untuk AI Agent

1. Periksa repository dan lingkungan sebelum mengubah file.
2. Buat rencana implementasi singkat sebelum coding.
3. Inisialisasi Next.js dan modul Go dengan struktur yang rapi.
4. Implementasikan database dan migrasi terlebih dahulu.
5. Implementasikan autentikasi dan isolasi data.
6. Implementasikan CRUD mata kuliah dan tugas.
7. Implementasikan koneksi `whatsmeow` dan pairing admin.
8. Implementasikan scheduler serta pencegahan pengingat ganda.
9. Bangun frontend mengikuti `DESIGN.md`.
10. Tambahkan pengujian, konfigurasi production, dan dokumentasi deployment.
11. Jalankan formatter, test, dan build; perbaiki error sebelum menyatakan selesai.

**Prinsip utama:** simpel tetapi andal, aman, hemat resource, mudah dipahami, dan tidak menambahkan kompleksitas tanpa kebutuhan nyata.

# FROTEND — Landing Page, Pricing & Admin Management

## 1. Landing Page

Buat halaman publik sebagai halaman utama aplikasi Task Reminder.

### Konten
- **Hero section:** headline, deskripsi singkat, CTA `Mulai Sekarang` dan `Lihat Pricing`.
- **Fitur utama:** manajemen tugas, mata kuliah, dan pengingat WhatsApp otomatis.
- **Cara kerja:** buat tugas → atur deadline → terima pengingat WhatsApp.
- **Pricing preview:** tampilkan ringkasan paket yang tersedia.
- **CTA akhir:** ajakan untuk mulai menggunakan aplikasi.
- **Footer:** navigasi, pricing, login, registrasi, dan informasi aplikasi.

### Ketentuan
- Landing page dapat diakses tanpa login.
- Desain responsif, mobile-first, ringan, dan SEO-friendly.
- Gunakan Next.js untuk metadata, title, description, dan Open Graph.
- Hindari animasi berlebihan dan layout yang terlalu ramai.

## 2. Halaman Pricing

Buat halaman `/pricing` yang menampilkan empat paket dalam bentuk pricing card.

### Paket Default

| Plan | Mata Kuliah | Task | Harga |
|---|---:|---:|---:|
| Free | 2 | 4 | Gratis |
| Basic | 4 | 6 | Rp5.000/bulan |
| Sibuk | 6 | 10 | Rp10.000/bulan |
| SuperSibuk | 15 | 30 | Rp15.000/bulan |

### Konten Pricing Card
- Nama paket.
- Harga per bulan.
- Jumlah mata kuliah.
- Jumlah task.
- Tombol CTA, misalnya `Mulai Gratis` atau `Pilih Paket`.
- Badge `Gratis` untuk Free dan badge `Populer` pada Basic jika sesuai desain.

### Perilaku Sementara
- Tombol paket Free mengarah ke registrasi.
- Tombol paket berbayar cukup menampilkan UI atau mengarah ke halaman informasi paket.
- Jangan membuat checkout, payment gateway, atau transaksi palsu.
- Jangan membatasi jumlah mata kuliah maupun task berdasarkan paket.
- Tampilkan keterangan bahwa paket berbayar belum tersedia untuk pembelian jika diperlukan.

## 3. Manage Plan (Admin)

Tambahkan menu **Manage Plans** pada dashboard admin untuk melihat dan mengelola data paket.

### Fitur UI
- Melihat daftar paket.
- Menambah paket.
- Mengubah nama, harga, jumlah mata kuliah, jumlah task, dan deskripsi.
- Menghapus paket dengan konfirmasi.
- Menandai paket sebagai aktif/nonaktif untuk kebutuhan tampilan.
- Menampilkan status paket dan harga secara jelas.

### Data Plan
Setiap paket memiliki:
- `id`
- `name`
- `slug`
- `description`
- `price`
- `billing_period`
- `course_limit`
- `task_limit`
- `is_active`
- `created_at`
- `updated_at`

### Data Default
Saat aplikasi pertama kali diinisialisasi, sediakan empat paket berikut:

| Slug | Nama | Harga | Course Limit | Task Limit |
|---|---|---:|---:|---:|
| `free` | Free | Rp0 | 2 | 4 |
| `basic` | Basic | Rp5.000 | 4 | 6 |
| `sibuk` | Sibuk | Rp10.000 | 6 | 10 |
| `supersibuk` | SuperSibuk | Rp15.000 | 15 | 30 |

Seluruh paket menggunakan periode penagihan bulanan, kecuali Free yang ditampilkan sebagai paket gratis.

## 4. Manage User (Admin)

Tambahkan halaman `/admin/users` untuk mengelola pengguna aplikasi.

### Fitur
- Menampilkan daftar pengguna.
- Pencarian berdasarkan nama atau nomor WhatsApp.
- Melihat detail pengguna.
- Menambah pengguna secara manual.
- Mengubah nama, nomor WhatsApp, dan role.
- Mengaktifkan atau menonaktifkan akun.
- Menghapus pengguna dengan konfirmasi.
- Menampilkan tanggal registrasi dan status akun.

### Role
- `admin` — dapat mengakses dashboard admin.
- `user` — dapat menggunakan fitur aplikasi biasa.

### Ketentuan Keamanan
- Hanya admin yang dapat mengakses fitur manajemen pengguna.
- Semua otorisasi wajib divalidasi di backend Go, bukan hanya dengan menyembunyikan menu frontend.
- Password tidak boleh ditampilkan; jika admin membuat atau mereset akun, gunakan alur password yang aman.
- Cegah admin menghapus atau menonaktifkan dirinya sendiri secara tidak sengaja.
- Pastikan perubahan role tidak dapat dilakukan oleh pengguna biasa.

## 5. Perubahan Database

Tambahkan tabel `plans` untuk menyimpan data paket.

Tabel `users` perlu memiliki `role` dan `is_active` jika belum tersedia.

Untuk kebutuhan UI saat ini:
- Paket default disimpan di SQLite melalui seed atau migrasi yang idempotent.
- CRUD plan hanya mengubah metadata paket.
- Tidak perlu membuat sistem pembayaran, invoice, subscription, atau riwayat transaksi.
- Tidak perlu menerapkan pembatasan berdasarkan `course_limit` dan `task_limit`.
- Tidak perlu menetapkan plan aktif ke setiap user untuk mengaktifkan limitation.

## 6. Routing Frontend

### Public
- `/` — landing page.
- `/pricing` — daftar harga.
- `/login` — login.
- `/register` — registrasi.

### User
- `/dashboard`
- `/dashboard/tasks`
- `/dashboard/courses`
- `/dashboard/settings`

### Admin
- `/admin`
- `/admin/users`
- `/admin/plans`
- `/admin/whatsapp`

Lindungi halaman admin melalui autentikasi dan role-based authorization.

## 7. Update Acceptance Criteria

- Landing page dapat diakses tanpa login.
- Halaman pricing menampilkan empat paket default beserta harga dan kuotanya.
- Admin dapat melihat, menambah, mengubah, dan menghapus user.
- Admin dapat melihat dan mengelola data plan.
- Paket default tersedia setelah inisialisasi database.
- Harga ditampilkan dalam format Rupiah yang konsisten.
- Paket dan kuota hanya menjadi informasi UI; tidak ada enforcement limit.
- Tidak ada pembayaran atau subscription aktif.
- Semua operasi admin tetap dilindungi otorisasi backend.
- Tampilan konsisten dengan `DESIGN.md`, responsif, dan mobile-first.

**Batasan implementasi:** prioritaskan UI dan CRUD data yang diperlukan. Jangan membangun billing system atau limit enforcement sampai fitur tersebut memang diminta.
