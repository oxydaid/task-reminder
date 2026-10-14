import 'dotenv/config'
import { resolve } from 'path'

function getSafePath(envPath?: string, defaultRelative: string = './data/task-reminder.sqlite'): string {
  if (!envPath) return resolve(process.cwd(), defaultRelative)
  // If set to container root path like /app/data but running outside container without write permissions
  if (envPath.startsWith('/app/data')) {
    try {
      // Test if /app/data or root is writable
      return envPath
    } catch {
      return resolve(process.cwd(), defaultRelative)
    }
  }
  return envPath
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