import { Request, Response } from '../../http'
import { usersRepository } from '../../db/repositories/users'
import { appSettingsRepository } from '../../db/repositories/appSettings'
import { notificationsRepository } from '../../db/repositories/notifications'
import { initializeWhatsApp, getConnectionState, getQRCode, getPairingCode, requestPairingCode, logoutWhatsApp } from '../../lib/whatsapp'
import { logger } from '../../lib/logger'

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  const userCount = usersRepository.count()
  const whatsappState = getConnectionState()
  const schedulerEnabled = appSettingsRepository.isSchedulerEnabled()
  const lastSchedulerRun = appSettingsRepository.getLastSchedulerRun()
  
  res.json({
    success: true,
    data: {
      totalUsers: userCount,
      whatsappStatus: whatsappState,
      schedulerEnabled,
      lastSchedulerRun
    }
  })
}

export async function getWhatsAppStatus(req: Request, res: Response): Promise<void> {
  const state = getConnectionState()
  const qr = getQRCode()
  const pairingCode = getPairingCode()
  
  res.json({
    success: true,
    data: {
      status: state,
      qrCode: qr,
      pairingCode
    }
  })
}

export async function generatePairingCode(req: Request, res: Response): Promise<void> {
  const { phoneNumber } = req.body as { phoneNumber?: string }
  if (!phoneNumber) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nomor telepon wajib diisi' } })
    return
  }
  
  const code = await requestPairingCode(phoneNumber)
  
  if (!code) {
    res.status(500).json({ success: false, error: { code: 'FAILED', message: 'Gagal generate pairing code' } })
    return
  }
  
  res.json({ success: true, data: { pairingCode: code } })
}

export async function reconnectWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    await logoutWhatsApp()
    await initializeWhatsApp()
    res.json({ success: true, data: { message: 'WhatsApp reconnection initiated' } })
  } catch (error) {
    logger.error({ error }, 'Failed to reconnect WhatsApp')
    res.status(500).json({ success: false, error: { code: 'FAILED', message: 'Gagal reconnect WhatsApp' } })
  }
}

export async function getNotificationQueue(req: Request, res: Response): Promise<void> {
  const pending = notificationsRepository.findPendingForProcessing(100)
  res.json({ success: true, data: pending })
}

export async function getFailedNotifications(req: Request, res: Response): Promise<void> {
  const failed = notificationsRepository.getFailedNotifications(50)
  res.json({ success: true, data: failed })
}

export async function getAppSettings(req: Request, res: Response): Promise<void> {
  const settings = appSettingsRepository.list()
  res.json({ success: true, data: settings })
}

export async function updateAppSetting(req: Request, res: Response): Promise<void> {
  const { key, value, description } = req.body as { key: string; value: string; description?: string }
  
  if (!key || value === undefined) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Key dan value wajib diisi' } })
    return
  }
  
  const setting = appSettingsRepository.set(key, value, description)
  res.json({ success: true, data: setting })
}