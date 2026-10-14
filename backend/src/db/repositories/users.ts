import { db } from '../index'
import { normalizePhoneNumber } from '../../lib/auth'

export interface User {
  id: number
  whatsapp_number: string
  password_hash: string
  whatsapp_verified_at: string | null
  role: 'user' | 'admin'
  timezone: string
  reminder_enabled: number
  default_reminder_offset_minutes: number
  created_at: string
  updated_at: string
}

export interface CreateUserInput {
  whatsappNumber: string
  passwordHash: string
  timezone?: string
  reminderEnabled?: boolean
  defaultReminderOffsetMinutes?: number
}

export interface UpdateUserInput {
  whatsappNumber?: string
  passwordHash?: string
  whatsappVerifiedAt?: string | null
  role?: 'user' | 'admin'
  timezone?: string
  reminderEnabled?: boolean
  defaultReminderOffsetMinutes?: number
}

export const usersRepository = {
  create(input: CreateUserInput): User {
    const stmt = db.prepare(`
      INSERT INTO users (whatsapp_number, password_hash, timezone, reminder_enabled, default_reminder_offset_minutes)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `)
    return stmt.get(
      normalizePhoneNumber(input.whatsappNumber),
      input.passwordHash,
      input.timezone ?? 'Asia/Jakarta',
      input.reminderEnabled ? 1 : 0,
      input.defaultReminderOffsetMinutes ?? 2880
    ) as unknown as User
  },

  findById(id: number): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    return (row as unknown as User) ?? null
  },

  findByWhatsAppNumber(whatsappNumber: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE whatsapp_number = ?')
      .get(normalizePhoneNumber(whatsappNumber))
    return (row as unknown as User) ?? null
  },

  findByWhatsAppNumberUnsafe(whatsappNumber: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE whatsapp_number = ?')
      .get(whatsappNumber)
    return (row as unknown as User) ?? null
  },

  update(id: number, input: UpdateUserInput): User | null {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (input.whatsappNumber !== undefined) {
      fields.push('whatsapp_number = ?')
      values.push(normalizePhoneNumber(input.whatsappNumber))
    }
    if (input.passwordHash !== undefined) {
      fields.push('password_hash = ?')
      values.push(input.passwordHash)
    }
    if (input.whatsappVerifiedAt !== undefined) {
      fields.push('whatsapp_verified_at = ?')
      values.push(input.whatsappVerifiedAt)
    }
    if (input.role !== undefined) {
      fields.push('role = ?')
      values.push(input.role)
    }
    if (input.timezone !== undefined) {
      fields.push('timezone = ?')
      values.push(input.timezone)
    }
    if (input.reminderEnabled !== undefined) {
      fields.push('reminder_enabled = ?')
      values.push(input.reminderEnabled ? 1 : 0)
    }
    if (input.defaultReminderOffsetMinutes !== undefined) {
      fields.push('default_reminder_offset_minutes = ?')
      values.push(input.defaultReminderOffsetMinutes)
    }

    if (fields.length === 0) return this.findById(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? RETURNING *`)
    const row = stmt.get(...(values as any))
    return (row as unknown as User) ?? null
  },

  delete(id: number): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return Number(result.changes) > 0
  },

  list(limit = 50, offset = 0): User[] {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as unknown as User[]
  },

  count(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number | bigint } | undefined
    return Number(row?.count ?? 0)
  },

  verifyWhatsApp(id: number): User | null {
    const stmt = db.prepare(`
      UPDATE users SET whatsapp_verified_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as User) ?? null
  }
}