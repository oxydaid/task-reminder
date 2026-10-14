import { db } from '../index'

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
export type NotificationType = 'reminder' | 'deadline' | 'overdue'

export interface Notification {
  id: number
  user_id: number
  task_id: number
  notification_type: NotificationType
  scheduled_at: string
  status: NotificationStatus
  attempt_count: number
  next_attempt_at: string | null
  sent_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface CreateNotificationInput {
  userId: number
  taskId: number
  notificationType: NotificationType
  scheduledAt: string
}

export const notificationsRepository = {
  create(input: CreateNotificationInput): Notification {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, task_id, notification_type, scheduled_at, status)
      VALUES (?, ?, ?, ?, 'pending')
      RETURNING *
    `)
    return stmt.get(input.userId, input.taskId, input.notificationType, input.scheduledAt) as unknown as Notification
  },

  findById(id: number): Notification | null {
    const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id)
    return (row as unknown as Notification) ?? null
  },

  findByUserId(userId: number, limit = 50, offset = 0): (Notification & { task_title: string; task_deadline: string })[] {
    return db.prepare(`
      SELECT n.*, t.title as task_title, t.deadline_at as task_deadline
      FROM notifications n
      JOIN tasks t ON n.task_id = t.id
      WHERE n.user_id = ?
      ORDER BY n.scheduled_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as unknown as (Notification & { task_title: string; task_deadline: string })[]
  },

  findPendingForProcessing(limit = 100): (Notification & { task_title: string; task_deadline: string; whatsapp_number: string })[] {
    return db.prepare(`
      SELECT n.*, t.title as task_title, t.deadline_at as task_deadline, u.whatsapp_number
      FROM notifications n
      JOIN tasks t ON n.task_id = t.id
      JOIN users u ON n.user_id = u.id
      WHERE n.status IN ('pending', 'failed') 
        AND n.scheduled_at <= datetime('now')
        AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= datetime('now'))
        AND n.attempt_count < 5
        AND t.status = 'pending'
      ORDER BY n.scheduled_at ASC
      LIMIT ?
    `).all(limit) as unknown as (Notification & { task_title: string; task_deadline: string; whatsapp_number: string })[]
  },

  findByTaskAndType(taskId: number, notificationType: NotificationType, scheduledAt: string): Notification | null {
    const row = db.prepare(`
      SELECT * FROM notifications 
      WHERE task_id = ? AND notification_type = ? AND scheduled_at = ? AND status != 'cancelled'
    `).get(taskId, notificationType, scheduledAt)
    return (row as unknown as Notification) ?? null
  },

  markProcessing(id: number): Notification | null {
    const stmt = db.prepare(`
      UPDATE notifications SET status = 'processing', updated_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as Notification) ?? null
  },

  markSent(id: number): Notification | null {
    const stmt = db.prepare(`
      UPDATE notifications SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as Notification) ?? null
  },

  markFailed(id: number, error: string, nextAttemptAt: string | null): Notification | null {
    const stmt = db.prepare(`
      UPDATE notifications 
      SET status = 'failed', attempt_count = attempt_count + 1, last_error = ?, next_attempt_at = ?, updated_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(error, nextAttemptAt, id)
    return (row as unknown as Notification) ?? null
  },

  cancel(id: number): Notification | null {
    const stmt = db.prepare(`
      UPDATE notifications SET status = 'cancelled', updated_at = datetime('now')
      WHERE id = ? RETURNING *
    `)
    const row = stmt.get(id)
    return (row as unknown as Notification) ?? null
  },

  cancelByTaskId(taskId: number): number {
    const result = db.prepare(`
      UPDATE notifications SET status = 'cancelled', updated_at = datetime('now')
      WHERE task_id = ? AND status IN ('pending', 'processing', 'failed')
    `).run(taskId)
    return Number(result.changes)
  },

  cancelByTaskIdAndType(taskId: number, notificationType: NotificationType): number {
    const result = db.prepare(`
      UPDATE notifications SET status = 'cancelled', updated_at = datetime('now')
      WHERE task_id = ? AND notification_type = ? AND status IN ('pending', 'processing', 'failed')
    `).run(taskId, notificationType)
    return Number(result.changes)
  },

  getFailedNotifications(limit = 50): (Notification & { task_title: string; whatsapp_number: string })[] {
    return db.prepare(`
      SELECT n.*, t.title as task_title, u.whatsapp_number
      FROM notifications n
      JOIN tasks t ON n.task_id = t.id
      JOIN users u ON n.user_id = u.id
      WHERE n.status = 'failed'
      ORDER BY n.updated_at DESC
      LIMIT ?
    `).all(limit) as unknown as (Notification & { task_title: string; whatsapp_number: string })[]
  },

  getStats(userId: number): { pending: number; sent: number; failed: number; cancelled: number } {
    const row = db.prepare(`
      SELECT 
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM notifications WHERE user_id = ?
    `).get(userId) as Record<string, number | bigint | null> | undefined

    return {
      pending: Number(row?.pending ?? 0),
      sent: Number(row?.sent ?? 0),
      failed: Number(row?.failed ?? 0),
      cancelled: Number(row?.cancelled ?? 0)
    }
  },

  deleteOld(olderThanDays = 30): number {
    const result = db.prepare(`
      DELETE FROM notifications 
      WHERE status IN ('sent', 'cancelled') AND created_at < datetime('now', '-' || ? || ' days')
    `).run(olderThanDays)
    return Number(result.changes)
  }
}