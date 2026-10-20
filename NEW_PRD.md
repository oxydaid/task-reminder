# PRD Addendum — Landing Page, Pricing & Admin Management

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
