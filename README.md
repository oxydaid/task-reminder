# Task Reminder

Aplikasi web untuk pengelolaan tugas kuliah dengan notifikasi WhatsApp otomatis. Dibangun dengan React + TypeScript (frontend) dan Node.js + TypeScript (backend), siap deploy ke Pterodactyl Panel.

## 🚀 Fitur Utama

- **Manajemen Tugas**: CRUD tugas dengan deadline, prioritas, dan status
- **Mata Kuliah**: Kelola mata kuliah dengan kode, dosen, dan warna
- **Dashboard**: Ringkasan tugas, terlambat, mendekati deadline
- **Notifikasi WhatsApp**: Pengingat otomatis via WhatsApp (Baileys)
- **PWA**: Installable sebagai aplikasi mobile
- **Multi-user**: Isolasi data per pengguna
- **Admin Panel**: Monitoring WhatsApp, scheduler, notifikasi

## 🛠 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite 5
- Tailwind CSS v4
- shadcn/ui (Radix UI)
- TanStack Query v5
- React Router v6
- React Hook Form + Zod
- date-fns + date-fns-tz

### Backend
- Node.js 20 + TypeScript
- Native HTTP server (no Express)
- Better-SQLite3
- Baileys (WhatsApp Web API)
- node-cron (scheduler)
- Argon2id/Bcrypt (password hashing)
- Cookie-based sessions

### Deployment
- Docker multi-stage build
- Pterodactyl Panel ready
- SQLite dengan WAL mode
- Persistent volumes untuk data & WhatsApp session

## 📦 Quick Start (Development)

```bash
# Clone repository
git clone https://github.com/oxydaid/task-reminder.git
cd task-reminder

# Install dependencies
pnpm install

# Setup database
pnpm db:migrate
pnpm db:seed  # Optional: creates admin/user test accounts

# Start development servers
pnpm dev
```

Akses:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Test Accounts (after seed)
- Admin: `6281234567890` / `admin123`
- User: `6281234567891` / `user123`

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t task-reminder .
```

### Run with Docker Compose
```bash
# Copy env file
cp .env.example .env
# Edit .env with your values

docker-compose up -d
```

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` or `development` | Yes |
| `PORT` | Server port (default: 3000) | Yes |
| `DATABASE_PATH` | Path to SQLite file (persistent volume) | Yes |
| `SESSION_SECRET` | **Secure random string (min 32 chars)** | Yes |
| `APP_BASE_URL` | Full URL including protocol | Yes |
| `APP_TIMEZONE` | Default timezone (e.g., Asia/Jakarta) | Yes |
| `WHATSAPP_AUTH_DIR` | WhatsApp session directory (persistent) | Yes |
| `CORS_ORIGIN` | Frontend origin for CORS | Yes |
| `SCHEDULER_INTERVAL` | Cron expression for notifications | No (default: every minute) |

## 🎮 Pterodactyl Panel Deployment

### 1. Create Egg
Import `pterodactyl-egg.json` ke Pterodactyl Panel:
- Panel Admin → Nests → Create Nest → Import Egg
- Atau buat manual menggunakan konfigurasi di `pterodactyl-egg.json`

### 2. Setup Server
1. Buat server baru menggunakan egg "Task Reminder"
2. Konfigurasi variabel environment:
   - `SESSION_SECRET`: Generate secure random string (32+ chars)
   - `APP_BASE_URL`: Domain/server URL dengan HTTPS
   - `CORS_ORIGIN`: Sama dengan APP_BASE_URL
   - `DATABASE_PATH`: `/app/data/task-reminder.sqlite`
   - `WHATSAPP_AUTH_DIR`: `/app/data/whatsapp-auth`
3. Pastikan mount `/app/data` ke volume persisten (min 1GB)

### 3. First Run & WhatsApp Pairing
1. Start server
2. Akses admin panel: `https://your-domain.com` → login admin → `/admin`
3. Buka tab "WhatsApp Status"
4. Masukkan nomor WhatsApp bot → Generate Pairing Code
5. Di HP bot: WhatsApp → Linked Devices → Link a Device → Masukkan pairing code
6. Tunggu hingga status "Connected"

### 4. SSL/HTTPS (Required for Production)
- Pterodactyl通常使用nginx反向代理
- Pastikan HTTPS dikonfigurasi dengan benar
- `SESSION_SECRET` dan cookie `Secure` flag memerlukan HTTPS

## 📁 Project Structure

```
task-reminder/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration
│   │   ├── db/              # Database & migrations
│   │   │   ├── repositories/ # Data access layer
│   │   ├── http.ts          # HTTP helpers
│   │   ├── router.ts        # Routing
│   │   ├── lib/             # Utilities (auth, validation, whatsapp, logger)
│   │   ├── modules/         # Feature modules
│   │   │   ├── auth/
│   │   │   ├── subjects/
│   │   │   ├── tasks/
│   │   │   ├── dashboard/
│   │   │   ├── settings/
│   │   │   ├── notifications/
│   │   │   ├── admin/
│   │   │   └── scheduler/
│   │   └── index.ts         # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   └── layout.tsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── tasks/
│   │   │   ├── subjects/
│   │   │   ├── settings/
│   │   │   └── notifications/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   │   ├── icons/
│   │   └── manifest.webmanifest
│   └── package.json
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh
├── pterodactyl-egg.json
├── .env.example
└── package.json (workspace root)
```

## 🔐 Security Features

- Password hashing dengan Bcrypt (12 rounds)
- HttpOnly, Secure, SameSite cookies
- Session regeneration after login
- Rate limiting pada auth endpoints
- Input validation dengan Zod (client & server)
- Prepared statements (SQL injection prevention)
- CORS restriction
- Security headers (CSP, HSTS, etc.)
- Redacted logging (no passwords, tokens, PII)

## 📱 PWA Support

- Web App Manifest
- Service Worker (via Vite PWA)
- Offline caching untuk assets
- Install prompt di mobile
- Standalone display mode

## 🔧 Admin Features

Akses `/admin` setelah login sebagai admin:
- Statistik pengguna
- Status koneksi WhatsApp (QR/Pairing code)
- Status scheduler
- Antrean notifikasi
- Notifikasi gagal
- Pengaturan aplikasi
- Reconnect WhatsApp

## 📝 API Endpoints

### Auth
- `POST /api/auth/register` - Registrasi
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `POST /api/auth/verify-whatsapp` - Request verification
- `POST /api/auth/confirm-whatsapp` - Verify code
- `POST /api/auth/change-password` - Change password

### Subjects
- `GET /api/subjects` - List
- `POST /api/subjects` - Create
- `GET /api/subjects/:id` - Get
- `PATCH /api/subjects/:id` - Update
- `DELETE /api/subjects/:id` - Delete

### Tasks
- `GET /api/tasks` - List (with filters)
- `POST /api/tasks` - Create
- `GET /api/tasks/:id` - Get
- `PATCH /api/tasks/:id` - Update
- `DELETE /api/tasks/:id` - Delete
- `PATCH /api/tasks/:id/complete` - Toggle complete

### Dashboard
- `GET /api/dashboard/summary` - Stats
- `GET /api/dashboard/upcoming` - Upcoming tasks
- `GET /api/dashboard/overdue` - Overdue tasks
- `GET /api/dashboard/due-soon` - Due soon tasks

### Settings
- `GET /api/settings` - Get settings
- `PATCH /api/settings` - Update settings

### Notifications
- `GET /api/notifications` - History
- `GET /api/notifications/:id` - Detail

### Admin (require admin role)
- `GET /api/admin/stats` - System stats
- `GET /api/admin/whatsapp/status` - WhatsApp status
- `POST /api/admin/whatsapp/pairing-code` - Generate pairing code
- `POST /api/admin/whatsapp/reconnect` - Reconnect WhatsApp
- `GET /api/admin/notifications/queue` - Notification queue
- `GET /api/admin/notifications/failed` - Failed notifications
- `GET /api/admin/settings` - App settings
- `PATCH /api/admin/settings` - Update app setting

## 🔄 WhatsApp Notifications

### How it works
1. Scheduler runs every minute (configurable)
2. Checks tasks with upcoming deadlines
3. Calculates reminder time based on user/task settings
4. Creates notification records (anti-duplicate)
5. Queue processor sends via Baileys
6. Retry with exponential backoff on failure

### Configuration
- **Global** (per user): Enabled, default offset (default: H-2)
- **Per task**: Override enabled, custom offset
- **Timezone**: Per user (default: Asia/Jakarta)

### Message Format
```
Halo kak! 👋

Jangan lupa, ada tugas yang sebentar lagi deadline.

📚 Mata kuliah: Pemrograman Web
📝 Tugas: Membuat halaman login
⏰ Deadline: 16 Oktober 2026, 23.59
📌 Sisa waktu: 2 hari

Semangat mengerjakan tugasnya! 💪
```

## 🛡 Production Checklist

- [ ] Generate strong `SESSION_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure HTTPS/SSL
- [ ] Set correct `APP_BASE_URL` dan `CORS_ORIGIN`
- [ ] Mount persistent volume di `/app/data`
- [ ] Pair WhatsApp bot account
- [ ] Test notification delivery
- [ ] Configure backup untuk database
- [ ] Setup monitoring/logging
- [ ] Rate limiting di reverse proxy

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request

## 📞 Support

Untuk pertanyaan atau issue, buka GitHub Issues di repository ini.