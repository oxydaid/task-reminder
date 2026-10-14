import 'dotenv/config'
import { resolve, dirname } from 'path'
import { mkdirSync, accessSync, constants } from 'fs'

function getSafePath(envPath?: string, defaultRelative: string = './data/task-reminder.sqlite'): string {
  const fallback = resolve(process.cwd(), defaultRelative)
  if (!envPath) return fallback

  try {
    const targetDir = envPath.endsWith('.sqlite') || envPath.endsWith('.db')
      ? dirname(envPath)
      : envPath
    mkdirSync(targetDir, { recursive: true })
    accessSync(targetDir, constants.W_OK)
    return envPath
  } catch {
    try {
      const fallbackDir = fallback.endsWith('.sqlite') || fallback.endsWith('.db')
        ? dirname(fallback)
        : fallback
      mkdirSync(fallbackDir, { recursive: true })
    } catch {}
    return fallback
  }
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databasePath: getSafePath(process.env.DATABASE_PATH, './data/task-reminder.sqlite'),
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret-change-in-production',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  appTimezone: process.env.APP_TIMEZONE ?? 'Asia/Jakarta',
  whatsappAuthDir: getSafePath(process.env.WHATSAPP_AUTH_DIR, './data/whatsapp-auth'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  bcryptRounds: 12,
  sessionMaxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  verificationCodeExpiry: 1000 * 60 * 10, // 10 minutes
  verificationMaxAttempts: 3,
  schedulerInterval: process.env.SCHEDULER_INTERVAL ?? '* * * * *', // every minute
  notificationRetryDelays: [1000 * 60, 1000 * 60 * 5, 1000 * 60 * 15, 1000 * 60 * 60], // 1m, 5m, 15m, 1h
  maxNotificationRetries: 4,
  defaultReminderOffsetMinutes: 2 * 24 * 60, // 2 days
}
