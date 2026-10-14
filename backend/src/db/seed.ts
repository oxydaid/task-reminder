import { db, initializeDatabase, closeDatabase } from './index'
import { hashPassword, normalizePhoneNumber } from '../lib/auth'
import { config } from '../config'

console.log('Seeding database...')

try {
  initializeDatabase()

  const adminPhone = normalizePhoneNumber('6281234567890')
  const userPhone = normalizePhoneNumber('6281234567891')

  const adminPasswordHash = hashPassword('admin123')
  const userPasswordHash = hashPassword('user123')

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (whatsapp_number, password_hash, whatsapp_verified_at, role, timezone, reminder_enabled, default_reminder_offset_minutes)
    VALUES (?, ?, datetime('now'), ?, ?, ?, ?)
  `)

  insertUser.run(adminPhone, adminPasswordHash, 'admin', 'Asia/Jakarta', 1, 2880)
  insertUser.run(userPhone, userPasswordHash, 'user', 'Asia/Jakarta', 1, 2880)

  console.log('Seed completed successfully')
  console.log('Admin:', adminPhone, '/ admin123')
  console.log('User:', userPhone, '/ user123')
} catch (error) {
  console.error('Seed failed:', error)
  process.exit(1)
} finally {
  closeDatabase()
}