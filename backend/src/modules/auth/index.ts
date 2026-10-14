import { config } from '../../config'
import { logger } from '../../lib/logger'
import { usersRepository } from '../../db/repositories/users'
import { sessionsRepository } from '../../db/repositories/sessions'
import { verificationCodesRepository } from '../../db/repositories/verificationCodes'
import { hashPassword, verifyPassword, normalizePhoneNumber, generateVerificationCode, hashToken, createSessionToken, createSessionHash, calculateExpiryDate } from '../../lib/auth'
import { registerSchema, loginSchema, verifyWhatsAppSchema, changePasswordSchema } from '../../lib/validation'
import type { Request, Response } from '../../http'

export async function register(req: Request, res: Response): Promise<void> {
  const parseResult = registerSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const { whatsappNumber, password } = parseResult.data
  const normalizedPhone = normalizePhoneNumber(whatsappNumber)

  const existingUser = usersRepository.findByWhatsAppNumber(normalizedPhone)
  if (existingUser) {
    res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'Nomor WhatsApp sudah terdaftar' } })
    return
  }

  const passwordHash = hashPassword(password)
  const user = usersRepository.create({
    whatsappNumber: normalizedPhone,
    passwordHash,
    timezone: config.appTimezone,
    reminderEnabled: true,
    defaultReminderOffsetMinutes: config.defaultReminderOffsetMinutes
  })

  const code = generateVerificationCode()
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + config.verificationCodeExpiry).toISOString()

  verificationCodesRepository.create({
    whatsappNumber: normalizedPhone,
    codeHash,
    expiresAt
  })

  logger.info({ userId: user.id, phone: normalizedPhone }, 'User registered, verification code generated')

  res.status(201).json({
    success: true,
    data: {
      user: { id: user.id, whatsappNumber: user.whatsapp_number },
      verificationCode: config.nodeEnv === 'development' ? code : undefined
    }
  })
}

export async function verifyWhatsApp(req: Request, res: Response): Promise<void> {
  const parseResult = verifyWhatsAppSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const { whatsappNumber, code } = parseResult.data
  const normalizedPhone = normalizePhoneNumber(whatsappNumber)

  const codeHash = hashToken(code)
  const verification = verificationCodesRepository.findValidByWhatsAppNumber(normalizedPhone)

  if (!verification) {
    res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Kode verifikasi tidak valid atau sudah kadaluwarsa' } })
    return
  }

  if (verification.code_hash !== codeHash) {
    verificationCodesRepository.incrementAttempts(verification.id)
    res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: 'Kode verifikasi salah' } })
    return
  }

  verificationCodesRepository.consume(verification.id)
  const user = usersRepository.findByWhatsAppNumber(normalizedPhone)
  
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan' } })
    return
  }

  usersRepository.verifyWhatsApp(user.id)
  logger.info({ userId: user.id }, 'WhatsApp verified')

  res.json({ success: true, data: { message: 'Verifikasi berhasil' } })
}

export async function requestVerificationCode(req: Request, res: Response): Promise<void> {
  const { whatsappNumber } = req.body as { whatsappNumber?: string }
  if (!whatsappNumber) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nomor WhatsApp wajib diisi' } })
    return
  }

  const normalizedPhone = normalizePhoneNumber(whatsappNumber)
  const user = usersRepository.findByWhatsAppNumber(normalizedPhone)
  
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan' } })
    return
  }

  if (user.whatsapp_verified_at) {
    res.status(400).json({ success: false, error: { code: 'ALREADY_VERIFIED', message: 'Nomor sudah diverifikasi' } })
    return
  }

  verificationCodesRepository.deleteByWhatsAppNumber(normalizedPhone)

  const code = generateVerificationCode()
  const codeHash = hashToken(code)
  const expiresAt = new Date(Date.now() + config.verificationCodeExpiry).toISOString()

  verificationCodesRepository.create({
    whatsappNumber: normalizedPhone,
    codeHash,
    expiresAt
  })

  logger.info({ userId: user.id }, 'New verification code requested')

  res.json({
    success: true,
    data: {
      message: 'Kode verifikasi baru telah dikirim',
      verificationCode: config.nodeEnv === 'development' ? code : undefined
    }
  })
}

export async function login(req: Request, res: Response): Promise<void> {
  const parseResult = loginSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const { whatsappNumber, password } = parseResult.data
  const normalizedPhone = normalizePhoneNumber(whatsappNumber)

  const user = usersRepository.findByWhatsAppNumber(normalizedPhone)
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Nomor WhatsApp atau password salah' } })
    return
  }

  if (!verifyPassword(password, user.password_hash)) {
    res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Nomor WhatsApp atau password salah' } })
    return
  }

  if (!user.whatsapp_verified_at) {
    res.status(403).json({ success: false, error: { code: 'NOT_VERIFIED', message: 'Nomor WhatsApp belum diverifikasi' } })
    return
  }

  const sessionToken = createSessionToken()
  const sessionHash = createSessionHash(sessionToken)
  const expiresAt = calculateExpiryDate(30)

  sessionsRepository.create({
    userId: user.id,
    sessionHash,
    expiresAt
  })

  res.setHeader('Set-Cookie', `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${config.sessionMaxAge / 1000}`)

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        whatsappNumber: user.whatsapp_number,
        role: user.role,
        timezone: user.timezone,
        reminderEnabled: user.reminder_enabled === 1,
        defaultReminderOffsetMinutes: user.default_reminder_offset_minutes
      }
    }
  })
}

export async function logout(req: Request, res: Response): Promise<void> {
  const sessionToken = req.cookies?.session
  if (sessionToken) {
    const sessionHash = createSessionHash(sessionToken)
    sessionsRepository.delete(sessionHash)
  }

  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
  res.json({ success: true, data: { message: 'Logged out successfully' } })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = req.user
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Tidak terautentikasi' } })
    return
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        whatsappNumber: user.whatsapp_number,
        role: user.role,
        timezone: user.timezone,
        reminderEnabled: user.reminder_enabled === 1,
        defaultReminderOffsetMinutes: user.default_reminder_offset_minutes,
        whatsappVerifiedAt: user.whatsapp_verified_at
      }
    }
  })
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const parseResult = changePasswordSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const { currentPassword, newPassword } = parseResult.data
  const user = req.user!
  const dbUser = usersRepository.findById(user.id)
  
  if (!dbUser || !verifyPassword(currentPassword, dbUser.password_hash)) {
    res.status(400).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Password saat ini salah' } })
    return
  }

  const newPasswordHash = hashPassword(newPassword)
  usersRepository.update(user.id, { passwordHash: newPasswordHash })
  sessionsRepository.deleteByUserId(user.id)

  logger.info({ userId: user.id }, 'Password changed, all sessions invalidated')

  res.setHeader('Set-Cookie', 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
  res.json({ success: true, data: { message: 'Password berhasil diubah, silakan login kembali' } })
}