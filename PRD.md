\# PRD.md — Task Reminder



\## 1. Informasi Proyek



| Item | Detail |

|---|---|

| Nama aplikasi | Task Reminder |

| Jenis | Web App / PWA |

| Tujuan | Pengelolaan tugas kuliah dan pengingat deadline otomatis |

| Target pengguna | Mahasiswa |

| Model layanan | Multi-user / SaaS |

| Frontend | React + TypeScript |

| UI | shadcn/ui |

| Styling | Tailwind CSS v4 |

| Backend | Node.js + TypeScript |

| Database | SQLite |

| Notifikasi | WhatsApp melalui Baileys |

| Deployment | Pterodactyl |

| Repository | https://github.com/oxydaid/task-reminder.git |



\## 2. Latar Belakang



Mahasiswa sering kesulitan mengelola tugas dari berbagai mata kuliah, terutama ketika banyak deadline berdekatan. Task Reminder dibuat untuk membantu mahasiswa mencatat tugas, mengelola mata kuliah, memantau tenggat waktu, dan menerima pengingat otomatis melalui WhatsApp.



Aplikasi harus sederhana, ringan, mudah digunakan melalui smartphone, serta tidak membutuhkan infrastruktur yang berlebihan.



\### Tujuan Utama



1\. Memudahkan mahasiswa mencatat dan mengelola tugas.

2\. Menghubungkan tugas dengan mata kuliah.

3\. Menampilkan deadline secara jelas dan terstruktur.

4\. Mengirimkan pengingat WhatsApp secara otomatis.

5\. Menjamin privasi dan pemisahan data setiap pengguna.

6\. Menyediakan arsitektur yang mudah dikembangkan menjadi layanan SaaS.



\### Prinsip Pengembangan



\- Simple but detailed.

\- Mobile-first dan responsif.

\- Utamakan pengalaman pengguna, bukan banyaknya fitur.

\- Gunakan dependensi seminimal mungkin.

\- Terapkan keamanan dan validasi sejak awal.

\- Hindari overengineering.

\- Gunakan arsitektur modular yang mudah dipelihara.



\---



\## 3. Ruang Lingkup MVP



\### Fitur yang Wajib Ada



\- Registrasi dan login.

\- Verifikasi kepemilikan nomor WhatsApp.

\- Dashboard ringkasan tugas.

\- CRUD mata kuliah.

\- CRUD tugas kuliah.

\- Relasi tugas dengan mata kuliah.

\- Pengaturan pengingat deadline.

\- Pengiriman notifikasi WhatsApp otomatis.

\- Riwayat dan status notifikasi.

\- Pengaturan profil pengguna.

\- PWA dengan manifest dan dukungan instalasi.

\- Pengelolaan sesi WhatsApp oleh administrator.

\- Isolasi data antarpengguna.



\### Di Luar Ruang Lingkup MVP



\- Integrasi kalender Google.

\- Kolaborasi dan berbagi tugas antarpengguna.

\- Pembayaran dan langganan SaaS.

\- Aplikasi native Android/iOS.

\- Web Push sebagai kanal notifikasi.

\- Integrasi AI untuk membuat atau merangkum tugas.

\- Multi-account WhatsApp sender.



Fitur tambahan hanya boleh dikembangkan setelah kebutuhan MVP terpenuhi dan stabil.



\---



\## 4. Arsitektur Sistem



\### 4.1 Teknologi



| Komponen | Teknologi | Keterangan |

|---|---|---|

| Frontend | React + TypeScript | Antarmuka aplikasi |

| Build tool | Vite | Development dan production build |

| UI components | shadcn/ui | Komponen UI yang konsisten |

| Styling | Tailwind CSS v4 | Konfigurasi CSS langsung di `app.css` |

| Routing frontend | React Router | Navigasi halaman |

| Data fetching | TanStack Query | Pengelolaan request dan cache |

| Form | React Hook Form | Pengelolaan formulir |

| Validasi | Zod | Validasi input |

| Backend | Node.js + TypeScript | API dan proses bisnis |

| HTTP server | Node.js native HTTP atau router ringan | Hindari framework backend berat |

| Database | SQLite | Penyimpanan data |

| Database access | Library SQLite dengan prepared statements | Query aman dan terstruktur |

| WhatsApp | Baileys | Koneksi satu akun WhatsApp bot |

| Scheduler | node-cron atau scheduler ringan | Pemeriksaan deadline |

| Authentication | Session berbasis cookie | Autentikasi web |

| Password hashing | Argon2id atau bcrypt | Penyimpanan password secara aman |

| Deployment | Pterodactyl | Menjalankan aplikasi Node.js |



Versi dependensi harus saling kompatibel dan dikunci melalui lockfile. Pilih library yang aktif dipelihara dan hindari penambahan dependensi tanpa kebutuhan jelas.



\### 4.2 Diagram Arsitektur



```text

Browser / PWA

&#x20;     |

&#x20;     | HTTPS

&#x20;     v

Node.js Application

&#x20;     |

&#x20;     +---- Authentication \& Authorization

&#x20;     |

&#x20;     +---- REST API

&#x20;     |

&#x20;     +---- Deadline Scheduler

&#x20;     |           |

&#x20;     |           v

&#x20;     |      Notification Queue

&#x20;     |           |

&#x20;     |           v

&#x20;     |       Baileys Client

&#x20;     |           |

&#x20;     |           v

&#x20;     |      WhatsApp Service

&#x20;     |

&#x20;     v

SQLite Database

```



\### 4.3 Ketentuan Arsitektur



\- Frontend dan backend dipisahkan secara logis.

\- Backend menyediakan REST API untuk seluruh operasi data.

\- Database tidak boleh diakses langsung oleh frontend.

\- Scheduler berjalan bersama backend dalam satu proses pada versi MVP.

\- Baileys menggunakan satu akun WhatsApp pengirim untuk semua pengguna.

\- Sesi WhatsApp dan database harus disimpan pada storage persisten.

\- Gunakan satu instance aplikasi aktif untuk menghindari scheduler ganda.

\- Siapkan pemisahan worker dan API apabila kebutuhan skala meningkat.



\---



\## 5. Autentikasi dan Akun Pengguna



\### 5.1 Registrasi



Pengguna mendaftar menggunakan:



\- Nomor WhatsApp.

\- Password.

\- Konfirmasi password.



Nomor WhatsApp dinormalisasi ke format internasional, misalnya E.164, sebelum disimpan.



\### 5.2 Verifikasi Nomor WhatsApp



Nomor WhatsApp harus diverifikasi sebelum akun dapat digunakan secara penuh.



Alur yang disarankan:



1\. Pengguna memasukkan nomor WhatsApp dan password.

2\. Server membuat kode verifikasi acak dengan masa berlaku terbatas.

3\. Pengguna memulai percakapan dengan nomor WhatsApp bot.

4\. Pengguna mengirim perintah verifikasi beserta kode yang diberikan aplikasi.

5\. Server memastikan nomor pengirim sesuai dengan nomor yang didaftarkan.

6\. Kode hanya dapat digunakan sekali dan setelah berhasil, nomor ditandai terverifikasi.



Kode verifikasi harus memiliki masa berlaku, batas percobaan, dan mekanisme pembatasan request. Jangan mengandalkan password saja untuk membuktikan kepemilikan nomor.



\### 5.3 Login



Pengguna login menggunakan nomor WhatsApp dan password.



Ketentuan keamanan:



\- Password tidak boleh disimpan dalam bentuk plaintext.

\- Gunakan hash password Argon2id atau bcrypt dengan konfigurasi yang sesuai.

\- Gunakan session ID acak yang disimpan di server.

\- Simpan session ID di cookie `HttpOnly`, `Secure`, dan `SameSite`.

\- Regenerasi session setelah login.

\- Sediakan logout dan invalidasi sesi.

\- Terapkan pembatasan percobaan login.

\- Jangan menyimpan password dalam localStorage.

\- Jangan mengembalikan hash password melalui API.



\### 5.4 Pemulihan Akun



Pemulihan akun melalui WhatsApp hanya boleh tersedia setelah mekanisme verifikasi kepemilikan nomor dirancang dengan aman.



Untuk MVP, fitur reset password dapat menggunakan kode sekali pakai yang dikirim atau diverifikasi melalui alur WhatsApp. Jika akun tidak lagi memiliki akses ke nomor terdaftar, sediakan prosedur pemulihan administratif yang aman.



\### 5.5 Isolasi Data



Setiap data yang dimiliki pengguna harus terikat pada `user\_id`.



Backend wajib memeriksa kepemilikan data untuk setiap request. Mengetahui ID tugas atau mata kuliah pengguna lain tidak boleh memberikan akses terhadap data tersebut.



\---



\## 6. Dashboard



Dashboard merupakan halaman utama setelah pengguna login.



\### Informasi yang Ditampilkan



\- Jumlah seluruh tugas aktif.

\- Tugas yang harus segera dikerjakan.

\- Tugas yang mendekati deadline.

\- Tugas yang sudah terlambat.

\- Tugas yang telah selesai.

\- Daftar tugas berdasarkan deadline terdekat.

\- Ringkasan mata kuliah.



\### Perilaku



\- Tugas diurutkan berdasarkan deadline terdekat.

\- Tugas selesai tidak dicampur dengan tugas aktif tanpa penanda.

\- Tugas terlambat ditampilkan dengan indikator visual yang jelas.

\- Dashboard memiliki empty state untuk pengguna baru.

\- Setiap tugas dapat dibuka untuk melihat detail atau diedit.

\- Data dashboard hanya berasal dari pengguna yang sedang login.



\---



\## 7. Manajemen Mata Kuliah



\### 7.1 CRUD Mata Kuliah



Pengguna dapat membuat, membaca, mengubah, dan menghapus mata kuliah.



\### Data Mata Kuliah



| Field | Tipe | Ketentuan |

|---|---|---|

| id | Integer / UUID | Primary key |

| user\_id | Foreign key | Pemilik data |

| name | String | Wajib |

| code | String | Opsional |

| lecturer | String | Opsional |

| color | String | Opsional untuk identitas visual |

| created\_at | Datetime | Waktu pembuatan |

| updated\_at | Datetime | Waktu pembaruan |



\### Ketentuan



\- Nama mata kuliah wajib diisi.

\- Mata kuliah hanya dapat diakses oleh pemiliknya.

\- Nama mata kuliah dapat dibuat unik per pengguna jika diperlukan.

\- Pengguna dapat melihat seluruh tugas yang terhubung dengan mata kuliah.

\- Penghapusan mata kuliah tidak boleh secara diam-diam menghapus tugas.



\### Perilaku Penghapusan



Jika mata kuliah masih digunakan oleh tugas, aplikasi harus memberi peringatan.



Pilihan yang direkomendasikan adalah menolak penghapusan sampai pengguna memindahkan atau menghapus tugas terkait. Alternatifnya, aplikasi dapat mengizinkan penghapusan dengan mengubah relasi tugas menjadi tidak memiliki mata kuliah, setelah pengguna menyetujui dampaknya.



\---



\## 8. Manajemen Tugas Kuliah



\### 8.1 CRUD Tugas



Pengguna dapat membuat, melihat, mengubah, menyelesaikan, dan menghapus tugas kuliah.



\### Data Tugas



| Field | Tipe | Ketentuan |

|---|---|---|

| id | Integer / UUID | Primary key |

| user\_id | Foreign key | Pemilik data |

| subject\_id | Foreign key | Mata kuliah terkait |

| title | String | Wajib |

| description | Text | Opsional |

| deadline | Datetime | Wajib |

| priority | Enum | Low, medium, high |

| status | Enum | Pending, completed |

| reminder\_enabled | Boolean | Mengaktifkan pengingat tugas |

| reminder\_offset | Integer | Jarak pengingat sebelum deadline |

| created\_at | Datetime | Waktu pembuatan |

| updated\_at | Datetime | Waktu pembaruan |

| completed\_at | Datetime | Waktu penyelesaian, opsional |



\### 8.2 Form Tugas



Form tambah dan edit tugas harus memiliki:



\- Judul tugas.

\- Mata kuliah.

\- Deskripsi.

\- Tanggal deadline.

\- Jam deadline.

\- Prioritas.

\- Status.

\- Pengaturan pengingat.



\### 8.3 Validasi



\- Judul tugas wajib diisi.

\- Deadline wajib valid.

\- Mata kuliah harus dimiliki oleh pengguna yang sama.

\- Prioritas dan status harus menggunakan nilai yang diizinkan.

\- Deadline yang sudah lewat boleh disimpan, tetapi ditandai terlambat.

\- Perubahan deadline harus memperbarui jadwal pengingat.

\- Tugas selesai tidak menerima pengingat deadline baru.

\- Penghapusan tugas harus membatalkan pengingat yang belum dikirim.



\### 8.4 Status Tugas



\- `pending`: tugas belum selesai.

\- `completed`: tugas telah diselesaikan.



Status terlambat dihitung berdasarkan deadline dan status tugas, bukan disimpan sebagai status permanen yang berpotensi tidak sinkron.



Contoh: tugas berstatus `pending` dengan deadline yang sudah lewat akan ditampilkan sebagai terlambat.



\---



\## 9. Sistem Pengingat WhatsApp



\### 9.1 Model Pengiriman



Aplikasi menggunakan satu akun WhatsApp bot sebagai pengirim untuk seluruh pengguna.



Pengguna tidak perlu memindai QR atau menautkan akun WhatsApp masing-masing.



Baileys digunakan untuk mengelola koneksi WhatsApp Web dan pengiriman pesan. Library ini tidak resmi, sehingga koneksi dan akun pengirim dapat mengalami gangguan atau pembatasan.



\### 9.2 Pengaturan Pengingat



Pengaturan awal:



\- Pengingat aktif secara default.

\- Pengingat default: 2 hari sebelum deadline (H-2).

\- Pengguna dapat mengubah pengaturan default.

\- Pengguna dapat mengaktifkan atau menonaktifkan pengingat per tugas.

\- Pengguna dapat menentukan jarak pengingat untuk tugas tertentu.

\- Pengguna dapat mengatur zona waktu.



Gunakan dua tingkat konfigurasi:



1\. Pengaturan global pengguna sebagai nilai default.

2\. Pengaturan per tugas sebagai override.



Jika tugas memiliki konfigurasi sendiri, konfigurasi tersebut mengalahkan pengaturan global.



\### 9.3 Alur Pengiriman



1\. Scheduler memeriksa tugas yang deadline-nya mendekat.

2\. Server menentukan pengaturan pengingat efektif milik pengguna.

3\. Server memastikan tugas belum selesai dan pengingat masih aktif.

4\. Server memeriksa apakah notifikasi untuk jadwal tersebut sudah pernah diproses.

5\. Server membuat record notifikasi dan memasukkannya ke antrean.

6\. Worker mengambil notifikasi dan mengirim pesan melalui Baileys.

7\. Server mencatat hasil pengiriman.

8\. Jika terjadi kegagalan sementara, notifikasi dijadwalkan untuk dicoba kembali sesuai kebijakan retry.



\### 9.4 Contoh Pesan



```text

Halo kak! 👋



Jangan lupa, ada tugas yang sebentar lagi deadline.



📚 Mata kuliah: Pemrograman Web

📝 Tugas: Membuat halaman login

⏰ Deadline: 16 Oktober 2026, 23.59

📌 Sisa waktu: 2 hari



Semangat mengerjakan tugasnya! 💪

```



Isi pesan harus ringkas, mudah dibaca, dan tidak berlebihan.



\### 9.5 Ketentuan Anti-Duplikat



\- Setiap jadwal pengingat memiliki identitas unik.

\- Pengiriman yang sama tidak boleh diproses dua kali hanya karena scheduler berjalan kembali.

\- Perubahan deadline harus memperbarui jadwal pengingat.

\- Tugas selesai atau dihapus membatalkan pengingat yang belum dikirim.

\- Gunakan transaksi database saat membuat record notifikasi.

\- Status pengiriman harus dibedakan dari status tugas.



Status notifikasi yang direkomendasikan:



\- `pending`

\- `processing`

\- `sent`

\- `failed`

\- `cancelled`



Catatan: status `sent` berarti proses pengiriman telah diterima oleh library atau transport yang digunakan, bukan jaminan pesan telah dibaca penerima.



\### 9.6 Retry dan Kegagalan



\- Gunakan retry dengan exponential backoff dan batas percobaan.

\- Jangan mengulang pengiriman tanpa batas.

\- Bedakan kegagalan sementara dengan kegagalan permanen.

\- Catat waktu percobaan terakhir dan penyebab kegagalan.

\- Jika koneksi WhatsApp terputus, antrean tetap disimpan.

\- Setelah koneksi pulih, notifikasi yang masih relevan dapat diproses kembali.

\- Notifikasi yang sudah kedaluwarsa tidak boleh dikirim secara membabi buta.

\- Sediakan status koneksi untuk administrator.



\### 9.7 Privasi Pesan



\- Pesan dikirim hanya ke nomor WhatsApp pengguna yang telah diverifikasi.

\- Pengguna harus mengetahui bahwa pengingat dikirim melalui WhatsApp.

\- Jangan memasukkan password, token sesi, atau data sensitif ke pesan.

\- Jangan mengirim pesan promosi yang tidak relevan dengan fungsi pengingat.

\- Sediakan opsi menonaktifkan pengingat.



\### 9.8 Batasan Baileys



Baileys bukan WhatsApp Business Platform resmi. Perubahan protokol WhatsApp dapat mengakibatkan gangguan koneksi, kebutuhan pairing ulang, atau pembatasan akun.



Karena itu:



\- Sesi harus disimpan secara persisten dan dilindungi.

\- Jangan melakukan pengiriman massal yang tidak diperlukan.

\- Terapkan antrean dan pembatasan laju pengiriman.

\- Sediakan mekanisme pemulihan koneksi.

\- Jangan menjanjikan pengiriman 100% berhasil.

\- Evaluasi WhatsApp Business Platform resmi jika layanan berkembang secara komersial.



\---



\## 10. Pengaturan Pengguna



Setiap pengguna memiliki halaman pengaturan yang mencakup:



\- Nomor WhatsApp.

\- Status verifikasi nomor.

\- Ubah password.

\- Zona waktu.

\- Pengaturan pengingat default.

\- Status pengingat aktif/nonaktif.

\- Preferensi jarak pengingat.

\- Informasi sesi login.

\- Logout.



Perubahan nomor WhatsApp harus melalui proses verifikasi ulang sebelum nomor baru digunakan untuk menerima pengingat.



\---



\## 11. Panel Administrasi



Panel administrasi ditujukan untuk pemilik layanan, bukan pengguna biasa.



\### Fitur



\- Melihat jumlah pengguna terdaftar.

\- Melihat status koneksi WhatsApp.

\- Melihat status scheduler.

\- Melihat antrean notifikasi.

\- Melihat notifikasi yang gagal.

\- Melihat log error yang relevan.

\- Mengelola proses reconnect WhatsApp.

\- Memeriksa penggunaan database dan status aplikasi.



\### Keamanan



\- Akses administrator harus memiliki role terpisah.

\- Jangan membuat akun administrator default dengan password yang diketahui publik.

\- Lindungi endpoint administrasi melalui authorization.

\- QR pairing dan kredensial sesi tidak boleh ditampilkan ke pengguna biasa.

\- Jangan menyimpan isi pesan atau data pribadi lebih lama dari yang dibutuhkan.

\- Semua tindakan administratif yang sensitif harus dicatat.



\---



\## 12. Desain UI/UX



\### 12.1 Prinsip Desain



Aplikasi harus memiliki tampilan modern, bersih, minimalis, dan konsisten.



Prioritas desain:



\- Mobile-first.

\- Navigasi sederhana.

\- Tipografi yang mudah dibaca.

\- Kontras warna yang baik.

\- Ruang kosong yang cukup.

\- Form sederhana dan jelas.

\- Indikator deadline yang mudah dipahami.

\- Loading, error, empty state, dan success state yang konsisten.

\- Hindari dekorasi yang mengganggu produktivitas.



\### 12.2 Navigasi Utama



Halaman pengguna:



1\. Dashboard.

2\. Tugas.

3\. Mata Kuliah.

4\. Pengaturan.



Pada perangkat mobile, gunakan bottom navigation atau pola navigasi responsif yang paling sesuai dengan jumlah menu.



\### 12.3 Komponen UI



Gunakan shadcn/ui untuk komponen yang sesuai, seperti:



\- Button.

\- Input.

\- Textarea.

\- Select.

\- Dialog.

\- Alert Dialog.

\- Dropdown Menu.

\- Calendar / Date Picker.

\- Card.

\- Badge.

\- Tabs.

\- Table.

\- Toast atau Sonner.

\- Skeleton.

\- Tooltip.



Jangan membuat ulang komponen yang sudah tersedia tanpa alasan yang jelas.



\### 12.4 Design System



Buat file `DESIGN.md` sebagai sumber aturan desain yang mencakup:



\- Filosofi desain.

\- Palet warna.

\- Tipografi.

\- Spacing.

\- Border radius.

\- Elevation.

\- Komponen dan variasinya.

\- Aturan responsive.

\- State komponen.

\- Accessibility.

\- Pola layout halaman.



Gunakan CSS variables dan theme tokens agar perubahan desain dapat dilakukan secara terpusat.



\---



\## 13. Tailwind CSS v4



Tailwind CSS harus menggunakan pendekatan konfigurasi CSS-first.



\- Konfigurasi utama ditulis langsung di `app.css`.

\- Gunakan directive `@import "tailwindcss";`.

\- Gunakan `@theme` untuk token desain yang diperlukan.

\- Jangan membuat `tailwind.config.js` atau `tailwind.config.ts` tanpa kebutuhan kompatibilitas yang benar-benar mengharuskan.

\- Integrasikan theme tokens shadcn/ui dengan CSS variables.

\- Pastikan build production menghasilkan CSS yang benar.



Contoh awal `app.css`:



```css

@import "tailwindcss";



@theme {

&#x20; --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;



&#x20; --radius-sm: 0.375rem;

&#x20; --radius-md: 0.5rem;

&#x20; --radius-lg: 0.75rem;

}



:root {

&#x20; color-scheme: light;

}



html {

&#x20; font-family: var(--font-sans);

}



body {

&#x20; margin: 0;

&#x20; min-width: 320px;

&#x20; min-height: 100vh;

}

```



Sesuaikan konfigurasi tersebut dengan kebutuhan theme shadcn/ui dan versi dependensi yang dipilih.



\---



\## 14. PWA



Aplikasi harus dapat diinstal sebagai Progressive Web App.



\### Fitur



\- Web app manifest.

\- Nama aplikasi dan short name.

\- Ikon aplikasi.

\- Theme color.

\- Tampilan standalone jika didukung.

\- Layout responsif.

\- Halaman fallback ketika koneksi terputus, jika sesuai.



\### Batasan



PWA tidak berarti seluruh fitur aplikasi dapat berjalan offline.



Versi MVP tidak perlu menyediakan sinkronisasi offline yang kompleks. Pengelolaan tugas tetap membutuhkan koneksi ke server.



Web Push bukan persyaratan. Notifikasi deadline menggunakan WhatsApp sehingga Service Worker untuk push notification tidak dibutuhkan.



Jika Service Worker ditambahkan untuk kebutuhan caching atau offline, implementasinya harus terpisah dari sistem pengiriman WhatsApp.



\---



\## 15. Desain Database



Gunakan SQLite dengan foreign key aktif, migration terkontrol, indeks, dan transaksi untuk operasi yang memerlukan konsistensi.



\### 15.1 Tabel `users`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| whatsapp\_number | Nomor WhatsApp dalam format normalisasi |

| password\_hash | Hash password |

| whatsapp\_verified\_at | Waktu verifikasi |

| role | `user` atau `admin` |

| timezone | Zona waktu pengguna |

| reminder\_enabled | Status pengingat global |

| default\_reminder\_offset | Default pengingat dalam satuan yang ditentukan |

| created\_at | Waktu pembuatan |

| updated\_at | Waktu pembaruan |



Nomor WhatsApp harus memiliki unique constraint.



\### 15.2 Tabel `sessions`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| user\_id | Pemilik sesi |

| session\_hash | Identitas sesi yang disimpan secara aman |

| expires\_at | Waktu kedaluwarsa |

| created\_at | Waktu pembuatan |

| last\_seen\_at | Aktivitas terakhir |



Session ID mentah hanya disimpan di cookie browser. Database menyimpan representasi yang aman untuk validasi sesi.



\### 15.3 Tabel `verification\_codes`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| whatsapp\_number | Nomor yang akan diverifikasi |

| code\_hash | Hash kode verifikasi |

| expires\_at | Masa berlaku |

| attempts | Jumlah percobaan |

| consumed\_at | Waktu kode digunakan |

| created\_at | Waktu pembuatan |



Kode verifikasi harus sekali pakai dan tidak boleh disimpan dalam bentuk plaintext.



\### 15.4 Tabel `subjects`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| user\_id | Pemilik mata kuliah |

| name | Nama mata kuliah |

| code | Kode mata kuliah, opsional |

| lecturer | Nama dosen, opsional |

| color | Warna identitas, opsional |

| created\_at | Waktu pembuatan |

| updated\_at | Waktu pembaruan |



\### 15.5 Tabel `tasks`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| user\_id | Pemilik tugas |

| subject\_id | Mata kuliah terkait |

| title | Judul tugas |

| description | Deskripsi |

| deadline\_at | Deadline dalam format UTC |

| priority | Prioritas |

| status | Status tugas |

| reminder\_enabled | Override pengingat |

| reminder\_offset\_minutes | Override jarak pengingat |

| completed\_at | Waktu penyelesaian |

| created\_at | Waktu pembuatan |

| updated\_at | Waktu pembaruan |



Jika `reminder\_enabled` atau `reminder\_offset\_minutes` bernilai NULL, backend menggunakan konfigurasi global pengguna sesuai aturan yang telah ditentukan.



\### 15.6 Tabel `notifications`



| Kolom | Keterangan |

|---|---|

| id | Primary key |

| user\_id | Pemilik notifikasi |

| task\_id | Tugas terkait |

| notification\_type | Jenis pengingat |

| scheduled\_at | Waktu pengiriman terjadwal |

| status | Status notifikasi |

| attempt\_count | Jumlah percobaan |

| next\_attempt\_at | Jadwal retry |

| sent\_at | Waktu pengiriman berhasil diproses |

| last\_error | Ringkasan error |

| created\_at | Waktu pembuatan |

| updated\_at | Waktu pembaruan |



Tambahkan unique constraint yang sesuai agar jadwal pengingat untuk tugas dan jenis notifikasi yang sama tidak terduplikasi. Jika deadline atau konfigurasi pengingat berubah, sistem harus dapat membatalkan atau membuat ulang jadwal dengan identitas yang konsisten.



\### 15.7 Tabel `app\_settings`



Digunakan untuk konfigurasi layanan global yang bukan preferensi pengguna, seperti:



\- Versi konfigurasi.

\- Pengaturan scheduler.

\- Metadata koneksi layanan.

\- Pengaturan operasional yang aman untuk disimpan dalam database.



Jangan menyimpan secret WhatsApp atau kredensial penting secara plaintext dalam tabel pengaturan.



\### 15.8 Indeks



Buat indeks untuk kolom yang sering digunakan, terutama:



\- `users.whatsapp\_number`.

\- `subjects.user\_id`.

\- `tasks.user\_id`.

\- `tasks.subject\_id`.

\- `tasks.deadline\_at`.

\- `tasks.status`.

\- `notifications.status`.

\- `notifications.scheduled\_at`.

\- `notifications.next\_attempt\_at`.



Aktifkan foreign key SQLite dan tentukan kebijakan `ON DELETE` secara eksplisit. Jangan mengandalkan perilaku default yang tidak sesuai dengan kebutuhan bisnis.



\---



\## 16. API Specification



Gunakan REST API dengan format JSON yang konsisten.



\### Authentication



| Method | Endpoint | Fungsi |

|---|---|---|

| POST | `/api/auth/register` | Registrasi pengguna |

| POST | `/api/auth/verify-whatsapp` | Meminta atau memulai proses verifikasi |

| POST | `/api/auth/confirm-whatsapp` | Konfirmasi kode verifikasi |

| POST | `/api/auth/login` | Login |

| POST | `/api/auth/logout` | Logout |

| GET | `/api/auth/me` | Informasi pengguna aktif |

| POST | `/api/auth/change-password` | Mengubah password |



\### Subjects



| Method | Endpoint | Fungsi |

|---|---|---|

| GET | `/api/subjects` | Daftar mata kuliah |

| POST | `/api/subjects` | Membuat mata kuliah |

| GET | `/api/subjects/:id` | Detail mata kuliah |

| PATCH | `/api/subjects/:id` | Mengubah mata kuliah |

| DELETE | `/api/subjects/:id` | Menghapus mata kuliah |



\### Tasks



| Method | Endpoint | Fungsi |

|---|---|---|

| GET | `/api/tasks` | Daftar tugas |

| POST | `/api/tasks` | Membuat tugas |

| GET | `/api/tasks/:id` | Detail tugas |

| PATCH | `/api/tasks/:id` | Mengubah tugas |

| DELETE | `/api/tasks/:id` | Menghapus tugas |

| PATCH | `/api/tasks/:id/complete` | Menyelesaikan tugas |



Query parameter yang disarankan:



\- `status`

\- `subject\_id`

\- `priority`

\- `from`

\- `to`

\- `sort`

\- `page`

\- `limit`



\### Dashboard



| Method | Endpoint | Fungsi |

|---|---|---|

| GET | `/api/dashboard/summary` | Ringkasan dashboard |

| GET | `/api/dashboard/upcoming` | Tugas mendatang |



\### Settings



| Method | Endpoint | Fungsi |

|---|---|---|

| GET | `/api/settings` | Membaca pengaturan pengguna |

| PATCH | `/api/settings` | Memperbarui pengaturan pengguna |



\### Notifications



| Method | Endpoint | Fungsi |

|---|---|---|

| GET | `/api/notifications` | Riwayat notifikasi pengguna |

| GET | `/api/notifications/:id` | Detail status notifikasi |



\### Administration



Endpoint administrasi harus berada di namespace terpisah, misalnya `/api/admin/\*`, dengan autentikasi dan pemeriksaan role pada setiap request.



Endpoint untuk mengelola koneksi WhatsApp tidak boleh tersedia bagi pengguna biasa.



\### Standar Response



Respons sukses:



```json

{

&#x20; "success": true,

&#x20; "data": {},

&#x20; "meta": null

}

```



Respons error:



```json

{

&#x20; "success": false,

&#x20; "error": {

&#x20;   "code": "VALIDATION\_ERROR",

&#x20;   "message": "Data yang diberikan tidak valid.",

&#x20;   "details": {}

&#x20; }

}

```



Jangan mengirim stack trace, secret, SQL query, atau detail internal server ke frontend pada production.



\---



\## 17. Standar Keamanan



\### 17.1 Validasi dan Database



\- Validasi seluruh input di backend.

\- Gunakan prepared statements atau parameterized queries.

\- Hindari penyusunan SQL melalui interpolasi input pengguna.

\- Validasi ID dan relasi sebelum operasi database.

\- Terapkan batas ukuran request.

\- Gunakan transaksi untuk operasi yang membutuhkan konsistensi.



\### 17.2 Session dan Cookie



\- Gunakan cookie `HttpOnly`.

\- Gunakan `Secure` saat aplikasi berjalan melalui HTTPS.

\- Gunakan `SameSite` yang sesuai.

\- Terapkan proteksi CSRF untuk request yang mengubah data jika diperlukan oleh model autentikasi.

\- Batasi masa berlaku sesi.

\- Regenerasi session ID setelah login dan perubahan hak akses.



\### 17.3 Keamanan HTTP



\- Batasi CORS hanya ke origin frontend yang diizinkan.

\- Terapkan security headers.

\- Gunakan HTTPS melalui reverse proxy atau infrastruktur deployment.

\- Jangan mengekspos port internal database atau layanan administrasi.

\- Batasi request autentikasi dan verifikasi dengan rate limiting.



\### 17.4 Perlindungan Data



\- Jangan mencatat password, kode verifikasi, session cookie, atau kredensial Baileys ke log.

\- Jangan mengirim data pengguna lain melalui API.

\- Simpan kredensial WhatsApp di direktori privat dengan izin file yang ketat.

\- Jangan commit `.env`, database produksi, atau sesi WhatsApp ke Git.

\- Sediakan mekanisme backup dan pemulihan database.



\---



\## 18. Deployment Pterodactyl



\### 18.1 Persyaratan



\- Node.js dengan versi LTS yang kompatibel.

\- Storage persisten untuk SQLite dan sesi WhatsApp.

\- HTTPS pada domain produksi.

\- Resource CPU dan RAM sesuai kebutuhan.

\- Process monitoring dari Pterodactyl.

\- Environment variables yang dikonfigurasi secara aman.



\### 18.2 Proses Deployment



1\. Clone repository.

2\. Install dependensi menggunakan lockfile.

3\. Build frontend.

4\. Jalankan migration database.

5\. Konfigurasikan environment variables.

6\. Siapkan direktori data persisten.

7\. Jalankan backend.

8\. Lakukan pairing awal untuk akun WhatsApp bot.

9\. Pastikan sesi tersimpan dan dapat dipulihkan.

10\. Verifikasi API, database, scheduler, dan pengiriman pesan.

11\. Uji restart server dan pemulihan koneksi.



\### 18.3 Penyimpanan



Contoh direktori:



```text

data/

├── task-reminder.sqlite

├── sessions/

└── whatsapp-auth/

```



Direktori ini hanya contoh. Gunakan lokasi yang benar-benar persisten sesuai konfigurasi container Pterodactyl.



Jangan menyimpan data penting di direktori sementara yang akan hilang ketika container dibuat ulang.



\### 18.4 Environment Variables



Contoh variabel yang perlu disiapkan:



```dotenv

NODE\_ENV=production

PORT=3000

DATABASE\_PATH=/app/data/task-reminder.sqlite

SESSION\_SECRET=replace-with-a-secure-random-secret

APP\_BASE\_URL=https://example.com

APP\_TIMEZONE=Asia/Jakarta

WHATSAPP\_AUTH\_DIR=/app/data/whatsapp-auth

```



Nilai tersebut merupakan contoh. Secret harus dibuat secara acak dan aman. Jangan memasukkan secret sungguhan ke repository.



\### 18.5 Process Lifecycle



\- Tangani `SIGTERM` dan `SIGINT`.

\- Hentikan scheduler saat shutdown.

\- Tutup koneksi database dengan benar.

\- Simpan dan tutup resource secara teratur.

\- Pastikan reconnect WhatsApp menggunakan backoff.

\- Hindari memulai beberapa scheduler aktif untuk database yang sama.

\- Gunakan pemeriksaan kesehatan aplikasi.



\### 18.6 Catatan Penting



Satu proses Node.js cukup untuk MVP, tetapi restart aplikasi tetap dapat menyebabkan keterlambatan notifikasi.



Sistem harus dirancang agar jadwal yang terlewat dapat diperiksa kembali tanpa mengirim duplikat. Pastikan pula konfigurasi Pterodactyl tidak menghapus data persisten saat redeploy.



\---



\## 19. Struktur Folder



Gunakan struktur modular yang memisahkan frontend, backend, domain, database, dan integrasi eksternal.



```text

task-reminder/

├── docs/

│   └── API.md

├── frontend/

│   ├── public/

│   │   ├── icons/

│   │   └── manifest.webmanifest

│   ├── src/

│   │   ├── components/

│   │   ├── features/

│   │   │   ├── auth/

│   │   │   ├── dashboard/

│   │   │   ├── subjects/

│   │   │   ├── tasks/

│   │   │   ├── notifications/

│   │   │   └── settings/

│   │   ├── hooks/

│   │   ├── lib/

│   │   ├── routes/

│   │   ├── styles/

│   │   ├── types/

│   │   ├── app.tsx

│   │   └── main.tsx

│   └── app.css

├── backend/

│   └── src/

│       ├── config/

│       ├── db/

│       │   ├── migrations/

│       │   └── repositories/

│       ├── modules/

│       │   ├── auth/

│       │   ├── users/

│       │   ├── subjects/

│       │   ├── tasks/

│       │   ├── notifications/

│       │   └── admin/

│       ├── middleware/

│       ├── services/

│       ├── scheduler/

│       ├── integrations/

│       │   └── whatsapp/

│       ├── utils/

│       ├── app.ts

│       └── server.ts

├── tests/

├── data/

├── .env.example

├── .gitignore

├── DESIGN.md

├── README.md

├── package.json

└── PRD.md

```



Struktur tersebut adalah panduan logis. Jika menggunakan satu `package.json` di root atau workspace monorepo, sesuaikan lokasi konfigurasi tanpa mengubah pemisahan tanggung jawab.



Jangan membuat banyak lapisan abstraksi yang tidak diperlukan. Modul harus memiliki tanggung jawab jelas dan dapat diuji secara terpisah.



\---



\## 20. Testing



\### 20.1 Unit Test



Uji:



\- Validasi input.

\- Perhitungan status deadline.

\- Resolusi pengaturan pengingat.

\- Penghitungan jadwal pengingat.

\- Validasi kepemilikan data.

\- Pembuatan dan validasi kode verifikasi.

\- Pencegahan notifikasi duplikat.

\- Kebijakan retry.



\### 20.2 Integration Test



Uji:



\- Registrasi dan login.

\- Verifikasi nomor WhatsApp.

\- CRUD mata kuliah.

\- CRUD tugas.

\- Pengubahan dan penghapusan tugas.

\- Isolasi data dua pengguna.

\- Pembuatan jadwal pengingat.

\- Perubahan deadline setelah jadwal dibuat.

\- Pembatalan pengingat saat tugas selesai.

\- Pemulihan antrean setelah restart.



Integrasi WhatsApp harus dapat diuji menggunakan mock atau adapter pengujian tanpa memerlukan akun WhatsApp aktif pada setiap test.



\### 20.3 End-to-End Test



Skenario utama:



1\. Pengguna login.

2\. Pengguna membuat mata kuliah.

3\. Pengguna membuat tugas dengan deadline dua hari mendatang.

4\. Pengguna mengaktifkan pengingat.

5\. Scheduler membuat notifikasi.

6\. Worker memproses pengiriman.

7\. Sistem mencatat status notifikasi.

8\. Pengguna melihat riwayat notifikasi.



\### 20.4 Build dan Quality Gate



Sebelum dianggap selesai:



\- TypeScript tidak memiliki error.

\- Lint berhasil.

\- Unit test berhasil.

\- Integration test berhasil.

\- Production build berhasil.

\- Migration database berhasil pada instalasi baru.

\- Aplikasi berjalan pada environment production.

\- Tidak ada secret yang ter-commit.

\- Uji restart dan pemulihan scheduler berhasil.



\---



\## 21. Acceptance Criteria



MVP dinyatakan selesai jika:



\- \[ ] Pengguna dapat registrasi dan login dengan aman.

\- \[ ] Nomor WhatsApp diverifikasi sebelum digunakan untuk pengingat.

\- \[ ] Pengguna dapat membuat, mengubah, dan menghapus mata kuliah.

\- \[ ] Pengguna dapat membuat, mengubah, menyelesaikan, dan menghapus tugas.

\- \[ ] Tugas terhubung dengan mata kuliah milik pengguna.

\- \[ ] Dashboard menampilkan tugas mendatang dan tugas terlambat.

\- \[ ] Pengingat default H-2 berfungsi.

\- \[ ] Pengaturan global dan per tugas berfungsi.

\- \[ ] WhatsApp bot mengirim pengingat melalui satu akun pengirim.

\- \[ ] Status pengiriman tercatat.

\- \[ ] Retry tidak menyebabkan duplikasi yang tidak diinginkan.

\- \[ ] Pengguna tidak dapat mengakses data pengguna lain.

\- \[ ] PWA dapat diinstal pada browser yang mendukung.

\- \[ ] Database dan sesi WhatsApp bertahan setelah restart.

\- \[ ] Aplikasi berhasil di-build dan dijalankan di Pterodactyl.

\- \[ ] Dokumentasi instalasi, konfigurasi, dan deployment tersedia.



\---



\## 22. Tahapan Implementasi



\### Tahap 1 — Fondasi



\- Inisialisasi repository dan package management.

\- Konfigurasi TypeScript.

\- Setup React, Vite, shadcn/ui, dan Tailwind CSS v4.

\- Setup backend Node.js.

\- Konfigurasi SQLite dan migration.

\- Buat `DESIGN.md`.



\### Tahap 2 — Autentikasi



\- Implementasi registrasi.

\- Password hashing.

\- Verifikasi nomor WhatsApp.

\- Login, session, logout.

\- Middleware autentikasi dan authorization.

\- Pengujian isolasi data.



\### Tahap 3 — Fitur Inti



\- CRUD mata kuliah.

\- CRUD tugas.

\- Relasi data.

\- Dashboard.

\- Status deadline.

\- Pengaturan pengguna.



\### Tahap 4 — Notifikasi WhatsApp



\- Integrasi Baileys.

\- Penyimpanan sesi.

\- Scheduler.

\- Antrean notifikasi.

\- Retry dan idempotensi.

\- Riwayat pengiriman.

\- Panel status koneksi.



\### Tahap 5 — PWA dan UI



\- Responsive layout.

\- Mobile navigation.

\- Manifest dan ikon.

\- Loading, error, dan empty state.

\- Penyempurnaan aksesibilitas.



\### Tahap 6 — Hardening dan Deployment



\- Unit dan integration test.

\- Audit keamanan.

\- Production build.

\- Konfigurasi Pterodactyl.

\- Backup database.

\- Uji restart dan recovery.

\- Dokumentasi operasional.



\---



\## 23. Pengembangan Lanjutan



Fitur berikut dapat dipertimbangkan setelah MVP stabil:



\- Kalender mingguan dan bulanan.

\- Pengingat bertingkat, misalnya H-2 dan H-1.

\- Ekspor data tugas.

\- Statistik produktivitas.

\- Backup dan restore mandiri.

\- Integrasi kalender.

\- Pengaturan kuota pengguna.

\- Paket berlangganan.

\- Migrasi ke database server jika beban dan kebutuhan konkurensi meningkat.

\- Pemisahan scheduler dan worker.

\- Integrasi WhatsApp Business Platform resmi.



Pengembangan lanjutan tidak boleh mengorbankan keamanan, stabilitas, atau kesederhanaan fitur inti.



\---



\## 24. Instruksi untuk Coding Agent



Implementasikan proyek berdasarkan PRD ini dengan ketentuan:



1\. Pelajari repository dan kondisi awal sebelum mengubah file.

2\. Buat rencana implementasi singkat sebelum mulai menulis kode.

3\. Inisialisasi project secara benar dan konsisten.

4\. Implementasikan fitur secara bertahap dari fondasi hingga deployment.

5\. Gunakan TypeScript secara konsisten.

6\. Terapkan validasi, error handling, authorization, dan database migration.

7\. Jangan membuat endpoint palsu atau UI yang terlihat berfungsi tetapi belum terhubung ke backend.

8\. Jangan menggunakan mock data sebagai pengganti implementasi production.

9\. Gunakan mock hanya untuk kebutuhan pengujian.

10\. Hindari overengineering dan dependensi yang tidak diperlukan.

11\. Jangan menganggap pengiriman WhatsApp berhasil sebelum hasil pengiriman diproses dengan benar.

12\. Jangan mengirim notifikasi ganda ketika server restart.

13\. Jalankan lint, test, dan production build sebelum menyatakan pekerjaan selesai.

14\. Dokumentasikan seluruh environment variables dan langkah deployment.

15\. Jangan commit secret, database produksi, atau kredensial sesi WhatsApp.

16\. Pastikan setiap endpoint yang berhubungan dengan data menerapkan isolasi pengguna.

17\. Jika terdapat konflik antara implementasi dan PRD, jelaskan konsekuensinya sebelum mengambil keputusan arsitektur yang mengubah ruang lingkup.



\*\*Prioritas utama: keamanan data, ketepatan deadline, keandalan pengingat, kemudahan penggunaan, dan deployment yang stabil.\*\*



