const path = require("path");
const fs = require("fs");

/**
 * Task Reminder - PM2 Ecosystem Configuration (Production Hardened)
 * ------------------------------------------------------------------
 * Menjalankan Backend Go Fiber dan Frontend Next.js secara optimal & aman
 * dalam 1 perintah: `pm2 start ecosystem.config.js`
 */

// Parser .env otomatis tanpa library eksternal
function parseEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return {};
  try {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    const result = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

const envFile = parseEnv();

// Custom Port (Fallback ke default jika tidak diisi)
const FRONTEND_PORT = process.env.PORT || envFile.PORT || "3000";
const BACKEND_PORT = process.env.BACKEND_PORT || envFile.BACKEND_PORT || "8080";
const BACKEND_URL = process.env.BACKEND_URL || envFile.BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;

// Deteksi binary Go (Windows .exe vs Linux/macOS)
const isWin = process.platform === "win32";
const backendBinary = path.join(__dirname, "bin", isWin ? "server.exe" : "server");

// Path executable Next.js
const nextBinary = path.join(__dirname, "frontend", "node_modules", "next", "dist", "bin", "next");

module.exports = {
  apps: [
    // -------------------------------------------------------------------------
    // 1. Backend Service (Go Fiber + whatsmeow WhatsApp Gateway + SQLite)
    // -------------------------------------------------------------------------
    {
      name: "task-reminder-backend",
      cwd: __dirname,
      script: backendBinary,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      watch: false,
      max_memory_restart: "250M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: "production",
        PORT: BACKEND_PORT,
        BACKEND_PORT: BACKEND_PORT,
        DATABASE_PATH: process.env.DATABASE_PATH || envFile.DATABASE_PATH || "./data/task-reminder.sqlite",
        WHATSAPP_STORE_PATH: process.env.WHATSAPP_STORE_PATH || envFile.WHATSAPP_STORE_PATH || "./data/whatsapp.sqlite",
        APP_TIMEZONE: process.env.APP_TIMEZONE || envFile.APP_TIMEZONE || "Asia/Jakarta",
        CORS_ORIGIN: process.env.CORS_ORIGIN || envFile.CORS_ORIGIN || "*",
        ADMIN_PHONE: process.env.ADMIN_PHONE || envFile.ADMIN_PHONE || "6281234567890",
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || envFile.ADMIN_PASSWORD || "adminpassword123",
      },
    },

    // -------------------------------------------------------------------------
    // 2. Frontend Service (Next.js 16 Production Server)
    // Hardened with memory cap & security flags against memory exhaustion DoS
    // -------------------------------------------------------------------------
    {
      name: "task-reminder-frontend",
      cwd: path.join(__dirname, "frontend"),
      script: nextBinary,
      args: `start -p ${FRONTEND_PORT} -H 0.0.0.0`,
      node_args: "--max-old-space-size=512 --no-deprecation",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      exp_backoff_restart_delay: 100,
      kill_timeout: 5000,
      watch: false,
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=512 --no-deprecation",
        PORT: FRONTEND_PORT,
        BACKEND_PORT: BACKEND_PORT,
        BACKEND_URL: BACKEND_URL,
      },
    },
  ],
};
