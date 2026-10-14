import { Request, Response } from '../../http'
import { notificationsRepository } from '../../db/repositories/notifications'

export async function listNotifications(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const page = parseInt(req.query.page as string || '1', 10)
  const limit = parseInt(req.query.limit as string || '50', 10)
  const offset = (page - 1) * limit
  
  const notifications = notificationsRepository.findByUserId(user.id, limit, offset)
  const stats = notificationsRepository.getStats(user.id)
  
  res.json({
    success: true,
    data: notifications,
    meta: {
      ...stats,
      page,
      limit
    }
  })
}

export async function getNotification(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  
  const notification = notificationsRepository.findById(id)
  if (!notification || notification.user_id !== user.id) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notifikasi tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: notification })
}