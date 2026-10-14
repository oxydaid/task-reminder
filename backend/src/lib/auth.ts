import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { config } from '../config'
import type { User } from '../db/repositories/users'

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned
  }
  
  return cleaned
}

export function formatPhoneNumberForDisplay(phone: string): string {
  const normalized = normalizePhoneNumber(phone)
  if (normalized.startsWith('62')) {
    return '+62 ' + normalized.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')
  }
  return normalized
}

export function generateRandomString(length: number): string {
  return randomBytes(length).toString('hex')
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256').update(password + salt).digest('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [salt, hash] = passwordHash.split(':')
  if (!salt || !hash) return false
  const computedHash = createHash('sha256').update(password + salt).digest('hex')
  return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash))
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function createSessionHash(token: string): string {
  return hashToken(token)
}

export function calculateExpiryDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function getUserTimezone(user: User): string {
  return user.timezone || config.appTimezone
}

export function getEffectiveReminderSettings(task: { reminder_enabled: number | null; reminder_offset_minutes: number | null }, user: User): { enabled: boolean; offsetMinutes: number } {
  const enabled = task.reminder_enabled !== null ? task.reminder_enabled === 1 : user.reminder_enabled === 1
  const offsetMinutes = task.reminder_offset_minutes !== null ? task.reminder_offset_minutes : user.default_reminder_offset_minutes
  return { enabled, offsetMinutes }
}

export function calculateReminderTime(deadlineAt: string, offsetMinutes: number): string {
  const deadline = new Date(deadlineAt)
  const reminder = new Date(deadline.getTime() - offsetMinutes * 60 * 1000)
  return reminder.toISOString()
}

export function isPast(dateString: string): boolean {
  return new Date(dateString) < new Date()
}

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'password_hash', 'token', 'session', 'secret', 'code', 'code_hash', 'whatsapp_number']
  const sanitized: Record<string, unknown> = {}
  
  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}