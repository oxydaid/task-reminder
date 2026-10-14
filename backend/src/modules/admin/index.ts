import { Request, Response } from '../../http'
import { usersRepository } from '../../db/repositories/users'
import { appSettingsRepository } from '../../db/repositories/appSettings'
import { notificationsRepository } from '../../db/repositories/notifications'
import { tasksRepository } from '../../db/repositories/tasks'
import {
  getConnectionState,
  getQRCode,
  getBotNumber,
  hasSavedSession,
  requestQRCode,
  logoutWhatsApp,
  sendMessage
} from '../../lib/whatsapp'
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
  const botNum = getBotNumber()

  res.json({
    success: true,
    data: {
      status: state,
      qrCode: qr,
      botNumber: botNum,
      hasSession: hasSavedSession()
    }
  })
}

export async function generateQRCode(req: Request, res: Response): Promise<void> {
  try {
    const result = await requestQRCode()
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    logger.error({ error }, 'Failed to generate QR code')
    res.status(500).json({
      success: false,
      error: { code: 'FAILED', message: 'Gagal men-generate QR Code' }
    })
  }
}

export async function reconnectWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    const result = await requestQRCode()
    res.json({
      success: true,
      data: {
        message: 'QR Code baru berhasil dibuat',
        ...result
      }
    })
  } catch (error) {
    logger.error({ error }, 'Failed to reconnect WhatsApp')
    res.status(500).json({ success: false, error: { code: 'FAILED', message: 'Gagal reconnect WhatsApp' } })
  }
}

export async function disconnectWhatsApp(req: Request, res: Response): Promise<void> {
  try {
    await logoutWhatsApp()
    res.json({ success: true, data: { message: 'WhatsApp diputus dan sesi dibersihkan' } })
  } catch (error) {
    logger.error({ error }, 'Failed to disconnect WhatsApp')
    res.status(500).json({ success: false, error: { code: 'FAILED', message: 'Gagal disconnect WhatsApp' } })
  }
}

export async function testWhatsAppMessage(req: Request, res: Response): Promise<void> {
  const { phoneNumber, message } = req.body as { phoneNumber?: string; message?: string }
  if (!phoneNumber) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nomor WhatsApp tujuan wajib diisi' } })
    return
  }

  if (getConnectionState() !== 'connected') {
    res.status(400).json({ success: false, error: { code: 'NOT_CONNECTED', message: 'WhatsApp bot belum terhubung. Silakan scan QR code terlebih dahulu.' } })
    return
  }

  let textToSend = message && message.trim() ? message.trim() : ''

  if (!textToSend) {
    let subjectName = 'Pemrograman Web'
    let taskTitle = 'Praktikum Integrasi API & Bot WhatsApp'
    let deadlineStr = 'Besok, 23:59 WIB'
    let timeRemaining = '1 hari lagi'

    if (req.user?.id) {
      try {
        const userTasks = tasksRepository.findByUserId(req.user.id, {
          status: 'pending',
          limit: 1,
          sort: 'deadline_asc'
        })
        if (userTasks.tasks && userTasks.tasks.length > 0) {
          const t = userTasks.tasks[0]
          taskTitle = t.title
          subjectName = t.subject_name || 'Tugas Kuliah'
          const d = new Date(t.deadline_at)
          const day = String(d.getDate()).padStart(2, '0')
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
          const month = months[d.getMonth()]
          const hours = String(d.getHours()).padStart(2, '0')
          const minutes = String(d.getMinutes()).padStart(2, '0')
          deadlineStr = `${day} ${month} ${d.getFullYear()} ${hours}:${minutes} WIB`

          const diffMs = d.getTime() - Date.now()
          if (diffMs > 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDays = Math.floor(diffHours / 24)
            const remHours = diffHours % 24
            timeRemaining = diffDays > 0 ? `${diffDays} hari${remHours > 0 ? ` ${remHours} jam` : ''}` : `${diffHours} jam`
          } else {
            timeRemaining = 'Sudah lewat deadline'
          }
        }
      } catch (err) {
        logger.debug({ err }, 'Could not fetch sample task for test message')
      }
    }

    textToSend = `Halo kak! 👋

Jangan lupa, ada tugas yang sebentar lagi deadline.

📚 Mata kuliah: ${subjectName}
📝 Tugas: ${taskTitle}
⏰ Deadline: ${deadlineStr}
📌 Sisa waktu: ${timeRemaining}

⚡ *[Tes Notifikasi Otomatis - Scheduler Aktif]*
Pesan ini dikirimkan langsung untuk menunjukkan bahwa background scheduler dan bot WhatsApp aktif serta siap mengirim pengingat deadline.

Semangat mengerjakan tugasnya! 💪`
  }

  try {
    const success = await sendMessage(phoneNumber, textToSend)
    if (success) {
      res.json({
        success: true,
        data: {
          message: 'Pesan pengingat tugas berhasil dikirim ke WhatsApp tujuan',
          recipient: phoneNumber,
          content: textToSend
        }
      })
    } else {
      res.status(500).json({
        success: false,
        error: { code: 'SEND_FAILED', message: 'Gagal mengirim pesan via Baileys. Pastikan nomor valid dan bot terhubung.' }
      })
    }
  } catch (err: any) {
    logger.error({ err }, 'Error during WhatsApp test message')
    res.status(500).json({
      success: false,
      error: { code: 'SEND_FAILED', message: err?.message || 'Gagal mengirim pesan tes' }
    })
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
  const { key, value } = req.body as { key?: string; value?: string }
  if (!key || value === undefined) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Key dan value wajib diisi' } })
    return
  }

  appSettingsRepository.set(key, value)
  res.json({ success: true, data: { message: 'Pengaturan berhasil diperbarui' } })
}
