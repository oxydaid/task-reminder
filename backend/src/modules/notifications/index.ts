import { config } from '../../config'
import { logger } from '../../lib/logger'
import { notificationsRepository, type Notification } from '../../db/repositories/notifications'
import { tasksRepository, type TaskWithSubject } from '../../db/repositories/tasks'
import { usersRepository } from '../../db/repositories/users'
import { sendMessage } from '../../lib/whatsapp'
import { getUserTimezone, calculateReminderTime } from '../../lib/auth'
import { formatInTimeZone } from 'date-fns-tz'

export async function processNotificationQueue(): Promise<void> {
  if (config.nodeEnv !== 'test') {
    const pendingNotifications = notificationsRepository.findPendingForProcessing(50)
    
    for (const notification of pendingNotifications) {
      await processNotification(notification)
    }
  }
}

async function processNotification(notification: Notification & { task_title: string; task_deadline: string; whatsapp_number: string }): Promise<void> {
  const childLogger = logger.child({ notificationId: notification.id, taskId: notification.task_id })
  
  try {
    notificationsRepository.markProcessing(notification.id)
    
    const task = tasksRepository.findById(notification.task_id, notification.user_id)
    if (!task) {
      childLogger.warn('Task not found, cancelling notification')
      notificationsRepository.cancel(notification.id)
      return
    }

    if (task.status === 'completed') {
      childLogger.info('Task completed, cancelling notification')
      notificationsRepository.cancel(notification.id)
      return
    }

    const user = usersRepository.findById(notification.user_id)
    if (!user || !user.whatsapp_verified_at) {
      childLogger.warn('User not verified, cancelling notification')
      notificationsRepository.cancel(notification.id)
      return
    }

    const timezone = getUserTimezone(user)
    const deadlineFormatted = formatInTimeZone(notification.task_deadline, timezone, 'dd MMMM yyyy, HH:mm')
    const now = new Date()
    const deadline = new Date(notification.task_deadline)
    const diffMs = deadline.getTime() - now.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    const remainingHours = diffHours % 24

    let timeRemaining = ''
    if (diffDays > 0) {
      timeRemaining = `${diffDays} hari${remainingHours > 0 ? ` ${remainingHours} jam` : ''}`
    } else {
      timeRemaining = `${diffHours} jam`
    }

    const message = buildReminderMessage({
      subjectName: notification.task_title,
      taskTitle: notification.task_title,
      deadline: deadlineFormatted,
      timeRemaining
    })

    const success = await sendMessage(notification.whatsapp_number, message)
    
    if (success) {
      notificationsRepository.markSent(notification.id)
      childLogger.info('Notification sent successfully')
    } else {
      const nextAttemptIndex = notification.attempt_count
      const nextAttemptDelay = config.notificationRetryDelays[nextAttemptIndex] ?? config.notificationRetryDelays[config.notificationRetryDelays.length - 1]
      const nextAttemptAt = new Date(Date.now() + nextAttemptDelay).toISOString()
      
      if (notification.attempt_count + 1 >= config.maxNotificationRetries) {
        notificationsRepository.markFailed(notification.id, 'Max retries exceeded', null)
        childLogger.error('Notification failed after max retries')
      } else {
        notificationsRepository.markFailed(notification.id, 'Failed to send, will retry', nextAttemptAt)
        childLogger.warn({ nextAttemptAt }, 'Notification failed, scheduled for retry')
      }
    }
  } catch (error) {
    childLogger.error({ error }, 'Error processing notification')
    const nextAttemptIndex = notification.attempt_count
    const nextAttemptDelay = config.notificationRetryDelays[nextAttemptIndex] ?? config.notificationRetryDelays[config.notificationRetryDelays.length - 1]
    const nextAttemptAt = new Date(Date.now() + nextAttemptDelay).toISOString()
    notificationsRepository.markFailed(notification.id, String(error), nextAttemptAt)
  }
}

interface ReminderMessageData {
  subjectName: string
  taskTitle: string
  deadline: string
  timeRemaining: string
}

function buildReminderMessage(data: ReminderMessageData): string {
  return `Halo kak! 👋

Jangan lupa, ada tugas yang sebentar lagi deadline.

📚 Mata kuliah: ${data.subjectName}
📝 Tugas: ${data.taskTitle}
⏰ Deadline: ${data.deadline}
📌 Sisa waktu: ${data.timeRemaining}

Semangat mengerjakan tugasnya! 💪`
}

export async function scheduleTaskReminders(task: TaskWithSubject, user: { id: number; timezone: string; reminder_enabled: number; default_reminder_offset_minutes: number }): Promise<void> {
  const { reminder_enabled: taskReminderEnabled, reminder_offset_minutes: taskReminderOffset } = task
  const enabled = taskReminderEnabled !== null ? taskReminderEnabled === 1 : user.reminder_enabled === 1
  const offsetMinutes = taskReminderOffset !== null ? taskReminderOffset : user.default_reminder_offset_minutes

  if (!enabled || offsetMinutes <= 0) return

  const reminderTime = calculateReminderTime(task.deadline_at, offsetMinutes)
  
  if (new Date(reminderTime) <= new Date()) {
    return
  }

  const existing = notificationsRepository.findByTaskAndType(task.id, 'reminder', reminderTime)
  if (existing) return

  notificationsRepository.create({
    userId: task.user_id,
    taskId: task.id,
    notificationType: 'reminder',
    scheduledAt: reminderTime
  })
}

export async function cancelTaskReminders(taskId: number): Promise<void> {
  notificationsRepository.cancelByTaskId(taskId)
}

export async function rescheduleTaskReminders(task: TaskWithSubject, user: { id: number; timezone: string; reminder_enabled: number; default_reminder_offset_minutes: number }): Promise<void> {
  await cancelTaskReminders(task.id)
  await scheduleTaskReminders(task, user)
}