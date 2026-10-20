const path = require("path");
const fs = require("fs");

// Helper to parse .env file without external dependencies
function loadEnv() {
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

const fileEnv = loadEnv();

// Custom port configuration (supports custom ports to prevent conflicts with other services)
const FRONTEND_PORT = process.env.PORT || fileEnv.PORT || "3000";
const BACKEND_PORT = process.env.BACKEND_PORT || fileEnv.BACKEND_PORT || "8080";
const BACKEND_URL = process.env.BACKEND_URL || fileEnv.BACKEND_URL || `http://127.0.0.1:${BACKEND_PORT}`;

// Binary path detection for Windows vs Linux/macOS
const isWin = process.platform === "win32";
const backendBinary = isWin ? "./bin/server.exe" : "./bin/server";

module.exports = {
  apps: [
    {
      name: "task-reminder-backend",
      cwd: __dirname,
      script: backendBinary,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        PORT: BACKEND_PORT,
        BACKEND_PORT: BACKEND_PORT,
        DATABASE_PATH: process.env.DATABASE_PATH || fileEnv.DATABASE_PATH || "./data/task-reminder.sqlite",
        WHATSAPP_STORE_PATH: process.env.WHATSAPP_STORE_PATH || fileEnv.WHATSAPP_STORE_PATH || "./data/whatsapp.sqlite",
        APP_TIMEZONE: process.env.APP_TIMEZONE || fileEnv.APP_TIMEZONE || "Asia/Jakarta",
        CORS_ORIGIN: process.env.CORS_ORIGIN || fileEnv.CORS_ORIGIN || "*",
        ADMIN_PHONE: process.env.ADMIN_PHONE || fileEnv.ADMIN_PHONE || "6281234567890",
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || fileEnv.ADMIN_PASSWORD || "adminpassword123",
      },
    },
    {
      name: "task-reminder-frontend",
      cwd: path.join(__dirname, "frontend"),
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${FRONTEND_PORT} -H 0.0.0.0`,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: FRONTEND_PORT,
        BACKEND_PORT: BACKEND_PORT,
        BACKEND_URL: BACKEND_URL,
      },
    },
  ],
};
