# PRD — Task Reminder: Subscription & Manual Payment System

## 1. Overview

Pengembangan sistem monetisasi dan manajemen langganan pada Task Reminder.

Sistem memungkinkan pengguna membeli paket berlangganan, melakukan pembayaran manual melalui transfer bank atau QRIS, mengirim bukti pembayaran, dan mendapatkan akses paket setelah pembayaran diverifikasi admin.

Seluruh proses pembayaran dan subscription dikelola oleh backend Go menggunakan Fiber, SQLite, dan whatsmeow.

### Tujuan

- Menambahkan sistem paket berbayar.
- Menerapkan limitasi fitur berdasarkan paket.
- Mendukung trial service.
- Mengelola subscription dan masa aktif pengguna.
- Menyediakan transaksi pembayaran manual.
- Mengirim instruksi pembayaran melalui WhatsApp.
- Mempermudah admin memverifikasi pembayaran dan mengaktifkan langganan.
- Menyediakan verifikasi akun dan reset password melalui WhatsApp.
- Menjaga data pengguna ketika paket berubah atau berakhir.

## 2. Tech Stack

### Backend
- Go.
- Fiber.
- whatsmeow untuk koneksi WhatsApp.
- SQLite.
- Scheduler internal Go.
- Database migration.
- Argon2id atau bcrypt untuk password hashing.

### Frontend
- Next.js App Router.
- TypeScript.
- Tailwind CSS v4.
- shadcn/ui.
- Mobile-first dan responsive.

### Deployment
- Pterodactyl.
- Persistent storage untuk SQLite, file pembayaran, dan kredensial WhatsApp.
- Backend dan frontend berjalan dalam mode production.
- Scheduler berjalan sebagai bagian dari backend Go.

Tidak menggunakan payment gateway, Redis, atau message broker untuk tahap awal.

---

# 3. Plan Management

## 3.1 Paket Default

| Plan | Mata Kuliah | Task | Notifikasi | Harga |
|---|---:|---:|---:|---:|
| Free | 2 | 4 | 3 | Gratis |
| Basic | 4 | 6 | 5 | Rp5.000/bulan |
| Sibuk | 6 | 10 | 7 | Rp10.000/bulan |
| SuperSibuk | 15 | 30 | 10 | Rp15.000/bulan |

Nilai kuota harus dapat diubah oleh admin.

## 3.2 CRUD Plan

Admin dapat:
- Melihat daftar paket.
- Menambahkan paket.
- Mengubah paket.
- Menghapus paket.
- Mengaktifkan atau menonaktifkan paket.
- Mengatur nama, slug, deskripsi, harga, periode, dan kuota fitur.
- Mengatur harga serta kuota secara independen.

### Data Plan

- `id`
- `name`
- `slug`
- `description`
- `price`
- `billing_period`
- `course_limit`
- `task_limit`
- `notification_limit`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

### Ketentuan

- Plan Free wajib tersedia.
- Plan yang sudah digunakan oleh subscription tidak boleh dihapus secara sembarangan.
- Perubahan harga tidak mengubah harga transaksi lama.
- Perubahan kuota berlaku berdasarkan aturan entitlement yang ditentukan sistem.
- Plan nonaktif tidak tersedia untuk checkout baru, tetapi subscription lama tetap diproses sampai masa aktifnya berakhir.

---

# 4. Subscription Management

Subscription merupakan data hak akses pengguna terhadap suatu paket dalam periode tertentu.

## 4.1 Status Subscription

Status yang didukung:

| Status | Keterangan |
|---|---|
| `active` | Langganan sedang berlaku |
| `expired` | Masa aktif sudah berakhir |
| `cancelled` | Langganan dibatalkan |
| `pending` | Menunggu proses aktivasi |
| `trialing` | Sedang menggunakan trial |

Subscription tidak dihapus ketika masa aktif habis.

## 4.2 Data Subscription

- `id`
- `user_id`
- `plan_id`
- `status`
- `subscription_type` (paid/trial/free)
- `started_at`
- `expires_at`
- `activated_at`
- `cancelled_at`
- `created_at`
- `updated_at`

## 4.3 Aktivasi Subscription

Subscription berbayar hanya dapat diaktifkan setelah admin menyetujui pembayaran.

Proses aktivasi harus dilakukan melalui satu fungsi backend khusus, misalnya `ApproveTransaction()`.

Fungsi tersebut harus:
1. Memvalidasi transaksi.
2. Memastikan transaksi belum pernah disetujui.
3. Memastikan pembayaran telah diverifikasi admin.
4. Memperbarui status transaksi menjadi `paid`.
5. Membuat atau memperpanjang subscription.
6. Menyimpan riwayat perubahan subscription.
7. Menyimpan identitas admin yang menyetujui transaksi.
8. Menjalankan seluruh perubahan database dalam satu transaction.

Tidak boleh ada endpoint lain yang mengaktifkan subscription dengan melewati proses tersebut.

## 4.4 Masa Aktif

Paket berbayar menggunakan periode bulanan.

Aturan perhitungan:
- Simpan waktu menggunakan UTC.
- Gunakan zona waktu `Asia/Jakarta` untuk tampilan.
- Masa aktif dihitung menggunakan kalender bulanan, bukan sekadar 30 hari.
- Jika tanggal aktivasi berada di akhir bulan dan bulan berikutnya tidak memiliki tanggal yang sama, gunakan hari terakhir bulan tersebut.
- Tentukan batas kedaluwarsa secara konsisten dan gunakan `expires_at` sebagai sumber kebenaran.

## 4.5 Perpanjangan Paket Sama

Jika user membeli paket yang sama ketika subscription masih aktif:

Contoh:
- Subscription aktif sampai 30 November.
- User membeli paket Basic lagi pada 20 November.
- Pembayaran disetujui pada 20 November.
- Subscription baru diperpanjang setelah masa aktif lama berakhir.

Masa aktif yang tersisa tidak boleh hilang.

## 4.6 Upgrade dan Downgrade Paket

Aturan awal:

| Perubahan | Perilaku |
|---|---|
| Free → Basic | Aktif setelah pembayaran disetujui |
| Basic → Basic | Perpanjang setelah masa aktif lama |
| Basic → Sibuk | Upgrade langsung setelah pembayaran disetujui |
| Sibuk → Basic | Berlaku setelah masa aktif berakhir |
| Paket berakhir | Kembali ke Free |

Ketentuan:
- Tidak menerapkan prorata harga.
- Tidak ada pengembalian selisih harga otomatis.
- Upgrade langsung memerlukan pembayaran transaksi baru.
- Downgrade tidak boleh menghapus data pengguna.
- Admin dapat melakukan penyesuaian subscription secara manual dengan alasan dan audit log.

Jika upgrade dilakukan saat paket lama masih aktif, sistem harus menggunakan aturan tanggal aktivasi yang konsisten. Sisa nilai paket lama tidak dihitung sebagai saldo pembayaran.

---

# 5. Trial Service

Sistem mendukung pemberian trial kepada pengguna.

## 5.1 Fitur Trial

- Admin dapat memberikan trial secara manual.
- Admin dapat menentukan plan trial.
- Admin dapat menentukan durasi trial.
- Durasi default 7 hari, dapat diubah admin.
- Trial tidak membutuhkan transaksi.
- Trial berakhir otomatis berdasarkan `expires_at`.
- Setelah trial berakhir, pengguna kembali ke Free.

## 5.2 Ketentuan Trial

- Satu pengguna hanya boleh mendapatkan trial satu kali secara default.
- Simpan riwayat trial agar tidak dapat diulang dengan mengubah status akun.
- Admin dapat memberikan pengecualian melalui tindakan khusus.
- Trial harus dicatat dalam subscription history.
- Trial tidak boleh diaktifkan melalui manipulasi frontend.

---

# 6. Subscription Expiration dan Graceful Downgrade

Ketika subscription berakhir, pengguna otomatis kembali menggunakan paket Free.

**Data pengguna tidak boleh dihapus hanya karena langganan berakhir.**

## 6.1 Perilaku Expiration

Contoh:
- User sebelumnya berlangganan SuperSibuk.
- Memiliki 15 mata kuliah, 30 task, dan 10 notifikasi.
- Subscription berakhir.
- User kembali menggunakan Free dengan limit 2 mata kuliah, 4 task, dan 3 notifikasi.

Perilaku:
- Semua data tetap tersimpan.
- User masih dapat melihat data.
- User tetap dapat mengubah dan menghapus data lama.
- User tidak dapat menambah data baru jika telah melewati limit Free.
- User dapat berlangganan kembali kapan saja.

## 6.2 Graceful Downgrade untuk Notifikasi

Jika user memiliki 10 notifikasi ketika turun ke Free dengan limit 3:

- Jangan menghapus konfigurasi notifikasi.
- Jangan menonaktifkan semuanya secara otomatis.
- Pertahankan seluruh konfigurasi.
- Tampilkan halaman pemilihan notifikasi yang ingin dipertahankan.
- User memilih maksimal 3 notifikasi yang tetap aktif.
- Notifikasi lainnya berstatus suspended karena limit.
- Jika user belum memilih, sistem menggunakan tiga notifikasi tertua sebagai default.
- Notifikasi suspended tidak boleh dikirim oleh scheduler.
- Ketika user berlangganan kembali, konfigurasi lama dapat diaktifkan kembali sesuai kuota paket.

## 6.3 Graceful Downgrade untuk Data Lain

Untuk mata kuliah dan task:
- Data tetap tersimpan.
- Tidak menghapus data yang melebihi kuota.
- User dapat melihat, mengedit, dan menghapus data.
- Penambahan data baru diblokir selama kuota terlampaui.
- Jika jumlah data kembali di bawah limit, user dapat menambah data lagi.

Untuk data yang melebihi limit, jangan melakukan penghapusan atau penonaktifan otomatis.

## 6.4 Entitlement Check

Backend wajib memiliki mekanisme pengecekan hak akses berdasarkan subscription aktif.

Contoh:

```text
Request
   |
   v
Authentication
   |
   v
Load User Subscription
   |
   v
Check expires_at
   |
   +---- Expired
   |       |
   |       v
   |    Use Free Plan
   |
   +---- Active
           |
           v
       Use Active Plan
           |
           v
       Check Feature Limit
           |
           v
      Allow / Reject
```

Pengecekan entitlement harus dilakukan di backend.

Jangan hanya mengandalkan status subscription yang diperbarui scheduler.

---

# 7. Subscription Scheduler

Gunakan scheduler internal Go.

Tidak membutuhkan worker terpisah atau message broker pada tahap awal.

## 7.1 Tanggung Jawab Scheduler

- Memeriksa subscription yang telah kedaluwarsa.
- Memperbarui status menjadi `expired`.
- Menangani trial yang berakhir.
- Mengirim pengingat sebelum masa aktif habis.
- Mengirim notifikasi ketika masa aktif berakhir.
- Memproses pekerjaan pengingat yang tertunda setelah restart.

## 7.2 Interval

- Pemeriksaan expiration setiap 1–5 menit.
- Gunakan batch processing agar tidak memuat seluruh data sekaligus.
- Gunakan mekanisme idempotency untuk pekerjaan yang menghasilkan efek samping.
- Scheduler harus dapat melanjutkan pekerjaan setelah backend restart.

## 7.3 Aturan Penting

- `expires_at` menjadi sumber kebenaran.
- User tidak boleh memperoleh hak akses paket berbayar setelah masa aktif habis, meskipun scheduler terlambat.
- Jangan menjalankan beberapa scheduler aktif secara bersamaan.
- Semua notifikasi expiration harus memiliki deduplication key.

---

# 8. Transaction Management

Sistem menggunakan pembayaran manual tanpa payment gateway.

## 8.1 Alur Transaksi

```text
User memilih paket
       |
       v
Pilih metode pembayaran
       |
       v
Backend membuat transaksi
       |
       v
Status: pending_payment
       |
       v
Kirim instruksi pembayaran via WhatsApp
       |
       v
User melakukan pembayaran
       |
       v
User mengirim bukti pembayaran
       |
       v
Status: waiting_verification
       |
       v
Admin memeriksa pembayaran
       |
       +------ Ditolak
       |          |
       |          v
       |       rejected
       |
       +------ Disetujui
                  |
                  v
             status: paid
                  |
                  v
          Aktifkan subscription
                  |
                  v
           Kirim konfirmasi
```

## 8.2 Status Transaksi

| Status | Keterangan |
|---|---|
| `pending_payment` | Menunggu pembayaran |
| `waiting_verification` | Bukti pembayaran diterima |
| `paid` | Pembayaran disetujui |
| `rejected` | Bukti pembayaran ditolak |
| `cancelled` | Transaksi dibatalkan |
| `expired` | Batas pembayaran berakhir |
| `refunded` | Dana dikembalikan, jika fitur refund didukung |

Status transaksi tidak boleh berubah sembarangan. Semua transisi harus divalidasi backend.

## 8.3 CRUD Transaksi

Admin dapat:
- Melihat daftar transaksi.
- Mencari berdasarkan kode transaksi, nama user, atau nomor WhatsApp.
- Filter berdasarkan status, paket, metode pembayaran, dan tanggal.
- Melihat detail transaksi.
- Mengubah data transaksi tertentu dengan validasi.
- Menghapus transaksi dengan aturan khusus.
- Menyetujui pembayaran.
- Menolak pembayaran dengan alasan.
- Membatalkan transaksi pending.
- Melihat bukti pembayaran.
- Melihat riwayat perubahan transaksi.

Transaksi yang sudah dibayar tidak boleh dihapus secara fisik melalui operasi CRUD biasa.

Gunakan pembatalan atau koreksi yang memiliki audit log.

## 8.4 Detail Transaksi

Data transaksi:

- Kode transaksi unik.
- User.
- Plan yang dibeli.
- Snapshot harga plan.
- Snapshot nama plan.
- Snapshot kuota.
- Metode pembayaran.
- Snapshot detail rekening atau QRIS.
- Tipe dan nilai fee.
- Nominal fee.
- Subtotal.
- Total pembayaran.
- Status transaksi.
- Waktu checkout.
- Batas pembayaran.
- Waktu pembayaran.
- Admin yang memverifikasi.
- Catatan admin.
- Bukti pembayaran.
- Riwayat status.

## 8.5 Snapshot Transaksi

Ketika transaksi dibuat, simpan seluruh informasi yang relevan sebagai snapshot.

Perubahan harga paket, nama paket, kuota, metode pembayaran, atau fee tidak boleh mengubah transaksi yang telah dibuat.

## 8.6 Idempotency

Wajib diterapkan untuk:
- Checkout.
- Upload bukti pembayaran.
- Approval transaksi.
- Aktivasi subscription.
- Pengiriman notifikasi transaksi.

Ketentuan:
- Gunakan idempotency key untuk request checkout.
- Simpan key dan hasil request.
- Unique constraint pada kode transaksi.
- Transaksi yang sudah paid tidak boleh di-approve ulang.
- Satu transaksi hanya boleh mengaktifkan subscription satu kali.
- Proses approval dan aktivasi harus berada dalam satu database transaction.
- Jika proses gagal, seluruh perubahan database harus rollback.
- Pengiriman WhatsApp menggunakan outbox/log agar dapat diproses ulang tanpa membuat efek ganda.

---

# 9. Payment Method Management

Admin dapat mengelola metode pembayaran.

## 9.1 CRUD

- Tambah metode pembayaran.
- Lihat metode pembayaran.
- Ubah metode pembayaran.
- Hapus metode pembayaran.
- Aktifkan atau nonaktifkan metode.
- Mengatur urutan tampilan.
- Mengatur icon/logo metode pembayaran.

## 9.2 Tipe Metode Pembayaran

### Transfer Bank

Field:
- Nama metode.
- Nama bank.
- Atas nama.
- Nomor rekening.
- Icon/logo.
- Deskripsi.
- Fee.
- Status aktif.

### QRIS

Field:
- Nama metode.
- Nama penerima.
- Gambar QRIS.
- Icon/logo.
- Deskripsi.
- Fee.
- Status aktif.

Gambar QRIS harus disimpan sebagai file upload dengan validasi format dan ukuran.

## 9.3 Fee Management

Mendukung tiga tipe biaya admin:

| Tipe | Formula |
|---|---|
| Percentage | Subtotal × Persentase |
| Fixed | Nominal tetap |
| Mixed | (Subtotal × Persentase) + Nominal tetap |

Contoh:
- Harga paket: Rp10.000.
- Fee percentage: 2%.
- Fee fixed: Rp500.
- Fee mixed: 2% + Rp500.

Total pembayaran dihitung backend.

Simpan:
- `fee_type`
- `fee_percentage`
- `fee_fixed`
- `fee_amount`
- `subtotal`
- `total_amount`

Gunakan aturan pembulatan Rupiah yang konsisten.

## 9.4 Snapshot Metode Pembayaran

Detail metode pembayaran yang digunakan harus disimpan pada transaksi.

Jika admin mengubah nomor rekening atau gambar QRIS, transaksi lama tetap menampilkan informasi yang digunakan ketika checkout.

---

# 10. Checkout via WhatsApp

## 10.1 Flow

1. User memilih paket.
2. User memilih metode pembayaran.
3. User menekan Checkout.
4. Backend memvalidasi paket dan metode pembayaran.
5. Backend membuat transaksi.
6. Backend menghitung fee dan total.
7. Backend menyimpan snapshot transaksi.
8. Backend mengirim pesan WhatsApp ke user.
9. User melakukan pembayaran.
10. User mengirim bukti pembayaran.
11. Backend menghubungkan bukti dengan transaksi.
12. Backend mengirim notifikasi ke admin penerima.

## 10.2 Contoh Pesan WhatsApp

```text
Halo, pembayaran Task Reminder.

Kode: TRX-20261102-00001
Paket: Basic
Harga: Rp5.000
Biaya Admin: Rp500
Total: Rp5.500

Silakan lakukan pembayaran melalui QRIS
yang terlampir.

Setelah membayar, kirim bukti pembayaran
dengan membalas pesan ini.

Batas pembayaran: 24 jam.
```

Untuk QRIS, backend mengirim gambar QRIS sebagai media WhatsApp.

Untuk transfer, backend mengirim detail rekening.

## 10.3 Pengiriman Bukti Pembayaran

Dukung dua cara:
- User mengirim gambar bukti melalui WhatsApp.
- User mengunggah bukti melalui dashboard.

Jika melalui WhatsApp:
- Hubungkan pesan bukti dengan transaksi melalui kode transaksi.
- Jika tidak ada kode transaksi yang jelas, minta user memilih atau mengirim ulang kode transaksi.
- Simpan media secara persisten.
- Validasi tipe file dan ukuran.
- Jangan menganggap gambar yang diterima sebagai pembayaran valid sebelum diverifikasi admin.

---

# 11. Admin Payment Notification

Admin dapat menentukan siapa yang menerima notifikasi transaksi.

## 11.1 Pengaturan Penerima

Setiap admin memiliki pengaturan:

- `receive_transaction_notification`
- `receive_payment_proof_notification`

## 11.2 Perilaku

Ketika ada transaksi baru:
- Kirim notifikasi hanya kepada admin yang mengaktifkan notifikasi transaksi.

Ketika bukti pembayaran diterima:
- Kirim notifikasi hanya kepada admin yang mengaktifkan notifikasi bukti pembayaran.

Admin yang tidak mengaktifkan opsi tidak menerima pesan tersebut.

## 11.3 Ketentuan

- Minimal satu admin harus menjadi penerima notifikasi pembayaran.
- Tampilkan peringatan jika tidak ada penerima aktif.
- Jangan mengirim notifikasi ke seluruh akun admin secara default.
- Notifikasi memiliki deduplication key.
- Catat status pengiriman notifikasi.
- Kegagalan notifikasi tidak boleh membatalkan transaksi atau upload bukti.

---

# 12. Payment Verification

Admin memiliki halaman verifikasi pembayaran.

Fitur:
- Melihat transaksi yang menunggu verifikasi.
- Melihat detail transaksi.
- Melihat gambar bukti pembayaran.
- Memeriksa nominal.
- Memeriksa metode pembayaran.
- Menyetujui pembayaran.
- Menolak pembayaran dengan alasan.
- Melihat riwayat verifikasi.

Ketika admin menyetujui:
- Transaksi berubah menjadi `paid`.
- Subscription dibuat atau diperpanjang.
- Hak akses user diperbarui.
- Sistem mencatat admin yang melakukan approval.
- User menerima notifikasi WhatsApp.

Admin tidak boleh menyetujui transaksi yang sudah paid, cancelled, expired, atau rejected tanpa alur koreksi khusus.

---

# 13. User Management

Tambahkan manajemen pengguna lengkap di dashboard admin.

## 13.1 CRUD User

Admin dapat:
- Melihat daftar pengguna.
- Mencari berdasarkan nama atau nomor WhatsApp.
- Melihat detail pengguna.
- Menambah pengguna.
- Mengubah nama dan nomor WhatsApp.
- Mengubah role.
- Mengaktifkan atau menonaktifkan akun.
- Menghapus akun sesuai aturan keamanan.
- Melihat tanggal registrasi.
- Melihat status verifikasi.

## 13.2 Relasi Subscription

Detail user harus menampilkan:
- Paket aktif.
- Status subscription.
- Tanggal aktivasi.
- Tanggal kedaluwarsa.
- Riwayat subscription.
- Riwayat trial.
- Riwayat transaksi.

## 13.3 Manajemen Subscription User

Admin dapat:
- Melihat subscription pengguna.
- Memberikan trial.
- Mengaktifkan paket secara manual dengan alasan.
- Mengubah paket.
- Memperpanjang masa aktif.
- Mengubah tanggal kedaluwarsa.
- Membatalkan subscription.
- Mengembalikan user ke Free.

Setiap perubahan harus memiliki audit log berisi admin, waktu, perubahan sebelum/sesudah, dan alasan.

Admin tidak boleh mengubah status subscription tanpa melalui validasi backend.

## 13.4 Akun Nonaktif

Akun nonaktif:
- Tidak dapat login.
- Tidak dapat menggunakan API privat.
- Tidak menerima pengingat task.
- Riwayat transaksi dan subscription tetap tersimpan.

---

# 14. Authentication dan WhatsApp Verification

## 14.1 Registrasi

Field:
- Nama.
- Nomor WhatsApp.
- Password.
- Konfirmasi password.

Flow:
1. User mendaftar.
2. Backend menormalisasi nomor WhatsApp.
3. Backend membuat akun dengan status belum terverifikasi.
4. Backend membuat token verifikasi acak.
5. Token disimpan dalam bentuk hash.
6. Backend mengirim link verifikasi melalui WhatsApp.
7. User membuka link.
8. Backend memvalidasi token.
9. Akun menjadi verified.

## 14.2 WhatsApp Verification Link

Contoh:

```text
https://domain.com/verify?token=RANDOM_TOKEN
```

Ketentuan:
- Token acak yang aman secara kriptografis.
- Token hanya dapat digunakan satu kali.
- Masa berlaku default 15 menit.
- Token disimpan dalam bentuk hash.
- Rate limit pengiriman.
- Verifikasi harus memvalidasi nomor tujuan dan akun.
- Jangan mengirim link verifikasi ke nomor yang belum dinormalisasi dan divalidasi.

## 14.3 Forgot Password

Flow:
1. User memasukkan nomor WhatsApp.
2. Backend memberikan respons generik.
3. Jika akun tersedia dan memenuhi syarat, buat reset token.
4. Kirim link reset melalui WhatsApp.
5. User membuka halaman reset.
6. User memasukkan password baru.
7. Backend memvalidasi token.
8. Password diubah.
9. Token ditandai sudah digunakan.
10. Sesi lama dapat dicabut untuk keamanan.

Ketentuan:
- Token sekali pakai.
- Masa berlaku terbatas.
- Token disimpan dalam bentuk hash.
- Rate limit per nomor dan IP.
- Jangan membocorkan apakah nomor terdaftar.

## 14.4 Security

- Password menggunakan Argon2id atau bcrypt.
- Gunakan cookie HttpOnly dan Secure pada HTTPS.
- Terapkan CSRF protection sesuai metode autentikasi.
- Batasi percobaan login.
- Batasi permintaan verifikasi dan reset password.
- Jangan menyimpan token plaintext.
- Jangan mengekspos data sensitif pada URL, log, atau response API.

---

# 15. WhatsApp Integration

Gunakan satu sesi whatsmeow global untuk seluruh aplikasi.

Tanggung jawab:
- Mengirim link verifikasi.
- Mengirim link reset password.
- Mengirim instruksi pembayaran.
- Mengirim QRIS.
- Menerima bukti pembayaran.
- Mengirim notifikasi transaksi ke admin.
- Mengirim notifikasi aktivasi subscription.
- Mengirim pengingat expiration.
- Mengirim notifikasi subscription expired.

Sesi WhatsApp harus persisten dan hanya dapat dikelola admin.

Semua pengiriman pesan harus menggunakan mekanisme queue/outbox sederhana di SQLite agar dapat diproses ulang setelah restart.

Kegagalan pengiriman pesan tidak boleh merusak status transaksi atau subscription.

---

# 16. Database Design

Tabel minimal:

## Users
- `users`
- `sessions`

Tambahkan:
- `role`
- `is_active`
- `is_verified`
- `verified_at`

## Plans
- `plans`

## Subscription
- `subscriptions`
- `subscription_logs`

## Transaction
- `transactions`
- `transaction_items`
- `transaction_logs`
- `payment_proofs`

## Payment Method
- `payment_methods`

## Authentication
- `verification_tokens`
- `password_reset_tokens`

## Notification
- `admin_notification_settings`
- `notification_logs`
- `message_outbox`

## Idempotency
- `idempotency_keys`

### Ketentuan Database

- Foreign key wajib diaktifkan.
- Gunakan indeks pada kolom pencarian dan relasi.
- Gunakan unique constraint untuk kode transaksi dan idempotency key.
- Gunakan database transaction untuk proses kritis.
- Gunakan migrasi database.
- Gunakan soft delete jika data masih dibutuhkan untuk audit.
- Jangan menghapus riwayat pembayaran atau subscription secara sembarangan.
- File upload disimpan di persistent storage, bukan dalam database sebagai binary besar.
- Terapkan backup database dan file bukti pembayaran.

---

# 17. Backend Architecture

```text
Go Backend
│
├── cmd/
│   └── server/
│
├── internal/
│   ├── auth/
│   ├── users/
│   ├── plans/
│   ├── subscriptions/
│   ├── entitlements/
│   ├── transactions/
│   ├── payment_methods/
│   ├── payment_proofs/
│   ├── courses/
│   ├── tasks/
│   ├── reminders/
│   ├── whatsapp/
│   ├── notifications/
│   ├── scheduler/
│   ├── outbox/
│   ├── database/
│   ├── storage/
│   └── http/
│
├── migrations/
├── go.mod
└── go.sum
```

### Prinsip

- Pisahkan business logic dari HTTP handler.
- Gunakan repository/service sesuai kebutuhan.
- Semua entitlement divalidasi di backend.
- Semua operasi kritis menggunakan transaksi database.
- Hindari duplikasi logika aktivasi subscription.
- Gunakan satu mekanisme outbox untuk pesan WhatsApp.
- Jangan menambahkan abstraksi yang tidak diperlukan.

---

# 18. API Endpoint

Prefix: `/api/v1`

## Authentication
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/verify`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

## Plans
- `GET /plans`
- `GET /plans/:id`
- `POST /admin/plans`
- `PUT /admin/plans/:id`
- `DELETE /admin/plans/:id`

## Subscriptions
- `GET /subscriptions/current`
- `GET /subscriptions/history`
- `GET /admin/subscriptions`
- `GET /admin/users/:id/subscriptions`
- `POST /admin/users/:id/subscriptions/trial`
- `POST /admin/users/:id/subscriptions/activate`
- `POST /admin/users/:id/subscriptions/extend`
- `POST /admin/users/:id/subscriptions/cancel`

## Transactions
- `POST /transactions/checkout`
- `GET /transactions`
- `GET /transactions/:id`
- `POST /transactions/:id/proofs`
- `GET /admin/transactions`
- `GET /admin/transactions/:id`
- `PUT /admin/transactions/:id`
- `DELETE /admin/transactions/:id`
- `POST /admin/transactions/:id/approve`
- `POST /admin/transactions/:id/reject`
- `POST /admin/transactions/:id/cancel`

## Payment Methods
- `GET /payment-methods`
- `GET /admin/payment-methods`
- `POST /admin/payment-methods`
- `PUT /admin/payment-methods/:id`
- `DELETE /admin/payment-methods/:id`

## Users
- `GET /admin/users`
- `POST /admin/users`
- `GET /admin/users/:id`
- `PUT /admin/users/:id`
- `DELETE /admin/users/:id`

## Admin Notification Settings
- `GET /admin/notification-settings`
- `PUT /admin/notification-settings`

## WhatsApp
- `GET /admin/whatsapp/status`
- `POST /admin/whatsapp/pair`
- `POST /admin/whatsapp/logout`

Endpoint harus memiliki validasi autentikasi, role, ownership, input, dan status resource.

---

# 19. Frontend Pages

## Public
- `/` — Landing Page.
- `/pricing` — Pricing.
- `/login`
- `/register`
- `/verify`
- `/forgot-password`
- `/reset-password`

## User Dashboard
- `/dashboard`
- `/dashboard/tasks`
- `/dashboard/courses`
- `/dashboard/subscription`
- `/dashboard/subscription/history`
- `/dashboard/transactions`
- `/dashboard/transactions/[id]`
- `/dashboard/settings`

## Admin Dashboard
- `/admin`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/plans`
- `/admin/subscriptions`
- `/admin/transactions`
- `/admin/transactions/[id]`
- `/admin/payment-methods`
- `/admin/notification-settings`
- `/admin/whatsapp`

---

# 20. UI/UX Requirements

## Pricing
- Pricing card responsif.
- Tampilkan harga, kuota, dan periode.
- Tombol pilih paket.
- Tandai paket aktif user.
- Tampilkan status trial jika ada.

## Subscription Dashboard
Tampilkan:
- Nama paket aktif.
- Status langganan.
- Tanggal mulai.
- Tanggal berakhir.
- Sisa masa aktif.
- Penggunaan kuota.
- Tombol perpanjang atau upgrade.
- Riwayat subscription.

## Downgrade Page

Ketika user turun ke Free dan jumlah pengingat melebihi kuota:

- Tampilkan informasi downgrade.
- Tampilkan jumlah pengingat yang dimiliki dan kuota Free.
- Tampilkan seluruh pengingat.
- User memilih pengingat yang ingin dipertahankan.
- Batasi pilihan sesuai kuota.
- Tampilkan pengingat yang suspended.
- Sediakan tombol konfirmasi.

Contoh:

```text
Paket Free hanya mendukung 3 notifikasi.

Kamu memiliki 10 notifikasi aktif.
Pilih 3 notifikasi yang ingin tetap berjalan.

[ ] Tugas Matematika
[ ] Tugas Pemrograman
[ ] Tugas Basis Data
[ ] Tugas Jaringan
...
```

## Transaction
- Status transaksi terlihat jelas.
- Detail biaya transparan.
- QRIS dapat diperbesar.
- Bukti pembayaran dapat diunggah.
- Riwayat transaksi tersedia.
- Tampilkan instruksi pembayaran dan batas waktu.

## Admin
- Tabel transaksi dengan filter.
- Preview bukti pembayaran.
- Tombol approve/reject.
- Detail user dan subscription.
- Manajemen plan dan metode pembayaran.
- Toggle penerima notifikasi admin.

Gunakan `DESIGN.md` sebagai sumber pedoman desain yang konsisten.

---

# 21. Security and Business Rules

1. Semua harga dan fee dihitung backend.
2. Frontend tidak boleh menjadi sumber kebenaran kuota.
3. User tidak boleh mengubah subscription sendiri.
4. User tidak boleh menyetujui transaksi sendiri.
5. Admin-only endpoint wajib memvalidasi role di backend.
6. Pembayaran tidak dianggap sukses hanya karena user mengirim bukti.
7. Approval transaksi harus idempotent.
8. Aktivasi subscription harus atomik.
9. File bukti pembayaran harus privat dan hanya dapat diakses pihak berwenang.
10. Token verifikasi dan reset password harus sekali pakai.
11. Data tidak boleh dihapus ketika subscription expired.
12. Subscription expired harus kembali ke entitlement Free.
13. Perubahan plan dan kuota harus tercatat bila memengaruhi hak akses.
14. WhatsApp gagal mengirim pesan tidak boleh menyebabkan transaksi dibatalkan.
15. Perubahan status transaksi dan subscription harus memiliki audit log.

---

# 22. Deployment Production

## Persistent Storage

Minimal:
- SQLite database.
- WhatsApp session credentials.
- QRIS image.
- Payment proof.
- Uploaded assets.
- Application logs jika diperlukan.

## Production Requirements

- Konfigurasi port menggunakan environment variable.
- Backend Go menggunakan graceful shutdown.
- Frontend Next.js dijalankan dalam production mode.
- Gunakan HTTPS.
- Validasi ukuran dan jenis file.
- Batasi akses file privat.
- Backup database dan file upload.
- Jangan menyimpan secret di repository.
- Pastikan scheduler hanya berjalan satu kali.
- Pastikan WhatsApp session tidak digunakan oleh beberapa instance secara bersamaan.

## Environment Variables

Contoh:
- `APP_ENV`
- `PORT`
- `DATABASE_PATH`
- `FRONTEND_URL`
- `SESSION_SECRET`
- `WHATSAPP_STORE_PATH`
- `UPLOAD_PATH`
- `TIMEZONE`
- `ADMIN_PHONE`

---

# 23. Testing and Acceptance Criteria

## Subscription
- User dapat membeli paket.
- Subscription aktif setelah pembayaran disetujui.
- Perpanjangan paket sama tidak menghilangkan sisa masa aktif.
- Upgrade dan downgrade mengikuti aturan.
- Subscription expired kembali ke Free.
- Trial berakhir otomatis.
- Hak akses tetap benar meskipun scheduler terlambat.

## Graceful Downgrade
- Data tidak dihapus ketika paket expired.
- User tetap bisa melihat, mengubah, dan menghapus data lama.
- Penambahan data diblokir jika limit terlampaui.
- User dapat memilih notifikasi yang tetap berjalan.
- Notifikasi suspended tidak dikirim.
- Notifikasi dapat diaktifkan kembali setelah upgrade.

## Transaction
- Checkout menghasilkan transaksi unik.
- Checkout duplikat tidak menghasilkan transaksi ganda.
- Bukti pembayaran tersimpan dengan benar.
- Admin dapat approve dan reject.
- Approval tidak dapat dijalankan dua kali.
- Subscription hanya aktif satu kali per transaksi.
- Fee dihitung dengan benar.
- Snapshot transaksi tidak berubah ketika konfigurasi plan atau payment method berubah.

## WhatsApp
- Instruksi pembayaran terkirim.
- QRIS terkirim sebagai media.
- Bukti pembayaran dapat diterima.
- Notifikasi admin mengikuti pengaturan penerima.
- Verifikasi akun melalui link berhasil.
- Reset password melalui link berhasil.
- Pesan yang gagal dapat diproses ulang tanpa efek ganda.

## Security
- User tidak dapat mengakses data user lain.
- User tidak dapat mengakses endpoint admin.
- Token tidak dapat digunakan dua kali.
- File bukti pembayaran tidak dapat diakses publik.
- Rate limit berjalan.

## Deployment
- Build frontend berhasil.
- Build backend berhasil.
- Database persisten setelah restart.
- WhatsApp session persisten setelah restart.
- Scheduler berjalan satu kali.
- Graceful shutdown berjalan.

---

# 24. Implementation Order

Implementasikan secara bertahap:

### Phase 1 — Database & Subscription Foundation
- Migrasi database.
- Plan management.
- Subscription management.
- Entitlement service.
- Subscription scheduler.
- Trial.
- Expiration dan graceful downgrade.

### Phase 2 — Payment Method & Transaction
- CRUD metode pembayaran.
- Fee calculation.
- Checkout.
- Transaction snapshot.
- Idempotency.
- Upload bukti pembayaran.
- Transaction history.

### Phase 3 — WhatsApp Payment Flow
- Kirim instruksi pembayaran.
- Kirim QRIS.
- Terima bukti pembayaran via WhatsApp.
- Admin notification.
- Message outbox.
- Retry dan deduplication.

### Phase 4 — Admin Management
- CRUD user.
- User detail.
- Subscription management per user.
- Payment verification.
- Audit log.
- Admin notification settings.

### Phase 5 — Authentication
- Verifikasi WhatsApp.
- Resend verification.
- Forgot password.
- Reset password.
- Token expiration dan rate limiting.

### Phase 6 — Frontend
- Pricing.
- Subscription dashboard.
- Checkout.
- Transaction detail.
- Payment proof upload.
- Admin transaction management.
- Admin payment methods.
- Admin user management.
- Downgrade selection page.

### Phase 7 — Production Readiness
- Testing business logic.
- Idempotency testing.
- Concurrency testing.
- Security testing.
- Pterodactyl deployment.
- Backup dan recovery testing.

---

# 25. Instructions for AI Coding Agent

- Periksa repository dan implementasi yang sudah ada sebelum mengubah kode.
- Jangan menulis ulang fitur yang sudah berfungsi tanpa alasan.
- Pertahankan stack Go + Fiber + whatsmeow + SQLite dan Next.js.
- Gunakan database migration.
- Implementasikan business logic di backend.
- Jangan menaruh aturan subscription hanya di frontend.
- Pisahkan plan, transaction, dan subscription.
- Gunakan database transaction untuk proses approval dan aktivasi.
- Terapkan idempotency pada seluruh operasi kritis.
- Pastikan scheduler dan outbox tahan terhadap restart.
- Jangan menghapus data user saat downgrade.
- Jangan membuat payment gateway.
- Jangan menganggap bukti pembayaran sebagai pembayaran terverifikasi.
- Jangan membuat sistem prorata.
- Jangan menambahkan Redis atau microservices tanpa kebutuhan.
- Tambahkan unit test untuk subscription, entitlement, fee, checkout, approval, dan expiration.
- Jalankan formatter, test, dan build sebelum menyatakan implementasi selesai.
- Dokumentasikan konfigurasi deployment dan backup.

**Prinsip utama:** sistem harus sederhana tetapi konsisten, aman terhadap transaksi ganda, tahan restart, dan tidak merugikan pengguna ketika langganan berubah atau berakhir.