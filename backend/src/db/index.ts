// @ts-ignore
const { DatabaseSync } = (process as any)['getBuiltinModule'] ? (process as any)['getBuiltinModule']('node:sqlite') : require('node:sqlite')
import { config } from '../config'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

mkdirSync(dirname(config.databasePath), { recursive: true })

export const db = new DatabaseSync(config.databasePath)

db.exec('PRAGMA foreign_keys = ON;')
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA synchronous = NORMAL;')

export function initializeDatabase() {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_number TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      whatsapp_verified_at TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
      reminder_enabled INTEGER NOT NULL DEFAULT 1,
      default_reminder_offset_minutes INTEGER NOT NULL DEFAULT 2880,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number)`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,

    `CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_number TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      consumed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_verification_codes_whatsapp_number ON verification_codes(whatsapp_number)`,
    `CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at)`,

    `CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      lecturer TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id)`,

    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      deadline_at TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      reminder_enabled INTEGER,
      reminder_offset_minutes INTEGER,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_subject_id ON tasks(subject_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_deadline_at ON tasks(deadline_at)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deadline ON tasks(user_id, status, deadline_at)`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL DEFAULT 'reminder',
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      sent_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_next_attempt_at ON notifications(next_attempt_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_schedule 
      ON notifications(task_id, notification_type, scheduled_at) 
      WHERE status NOT IN ('cancelled')`,

    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  ]

  for (const migration of migrations) {
    db.exec(migration)
  }

  const defaultSettings = [
    { key: 'scheduler_enabled', value: 'true', description: 'Whether the notification scheduler is enabled' },
    { key: 'whatsapp_connected', value: 'false', description: 'WhatsApp connection status' },
    { key: 'last_scheduler_run', value: '', description: 'Last scheduler run timestamp' }
  ]

  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value, description) VALUES (?, ?, ?)')
  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value, setting.description)
  }
}

export function closeDatabase() {
  db.close()
}