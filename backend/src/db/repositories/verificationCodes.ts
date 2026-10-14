import { db } from '../index'
import { normalizePhoneNumber } from '../../lib/auth'

export interface VerificationCode {
  id: number
  whatsapp_number: string
  code_hash: string
  expires_at: string
  attempts: number
  consumed_at: string | null
  created_at: string
}

export interface CreateVerificationCodeInput {
  whatsappNumber: string
  codeHash: string
  expiresAt: string
}

export const verificationCodesRepository = {
  create(input: CreateVerificationCodeInput): VerificationCode {
    const stmt = db.prepare(`
      INSERT INTO verification_codes (whatsapp_number, code_hash, expires_at)
      VALUES (?, ?, ?)
      RETURNING *
    `)
    return stmt.get(normalizePhoneNumber(input.whatsappNumber), input.codeHash, input.expiresAt) as unknown as VerificationCode
  },

  findByWhatsAppNumber(whatsappNumber: string): VerificationCode | null {
    const row = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE whatsapp_number = ? AND consumed_at IS NULL AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizePhoneNumber(whatsappNumber))
    return (row as unknown as VerificationCode) ?? null
  },

  findValidByWhatsAppNumber(whatsappNumber: string): VerificationCode | null {
    const row = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE whatsapp_number = ? AND consumed_at IS NULL AND expires_at > datetime('now') AND attempts < 3
      ORDER BY created_at DESC LIMIT 1
    `).get(normalizePhoneNumber(whatsappNumber))
    return (row as unknown as VerificationCode) ?? null
  },

  incrementAttempts(id: number): VerificationCode | null {
    const stmt = db.prepare(`
      UPDATE verification_codes SET attempts = attempts + 1
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as VerificationCode) ?? null
  },

  consume(id: number): VerificationCode | null {
    const stmt = db.prepare(`
      UPDATE verification_codes SET consumed_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as VerificationCode) ?? null
  },

  deleteExpired(): number {
    const result = db.prepare("DELETE FROM verification_codes WHERE expires_at < datetime('now')").run()
    return Number(result.changes)
  },

  deleteByWhatsAppNumber(whatsappNumber: string): number {
    const result = db.prepare('DELETE FROM verification_codes WHERE whatsapp_number = ?').run(normalizePhoneNumber(whatsappNumber))
    return Number(result.changes)
  }
}