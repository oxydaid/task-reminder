import { Request, Response } from '../../http'
import { usersRepository } from '../../db/repositories/users'
import { settingsSchema } from '../../lib/validation'

export async function getSettings(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const dbUser = usersRepository.findById(user.id)
  
  if (!dbUser) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' } })
    return
  }
  
  res.json({
    success: true,
    data: {
      whatsappNumber: dbUser.whatsapp_number,
      whatsappVerifiedAt: dbUser.whatsapp_verified_at,
      timezone: dbUser.timezone,
      reminderEnabled: dbUser.reminder_enabled === 1,
      defaultReminderOffsetMinutes: dbUser.default_reminder_offset_minutes
    }
  })
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const parseResult = settingsSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const input = parseResult.data
  
  const updatedUser = usersRepository.update(user.id, {
    timezone: input.timezone,
    reminderEnabled: input.reminderEnabled,
    defaultReminderOffsetMinutes: input.defaultReminderOffsetMinutes
  })
  
  if (!updatedUser) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pengguna tidak ditemukan' } })
    return
  }
  
  res.json({
    success: true,
    data: {
      whatsappNumber: updatedUser.whatsapp_number,
      whatsappVerifiedAt: updatedUser.whatsapp_verified_at,
      timezone: updatedUser.timezone,
      reminderEnabled: updatedUser.reminder_enabled === 1,
      defaultReminderOffsetMinutes: updatedUser.default_reminder_offset_minutes
    }
  })
}