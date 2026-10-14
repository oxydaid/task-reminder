import cron from 'node-cron'
import { config } from '../../config'
import { logger } from '../../lib/logger'
import { tasksRepository } from '../../db/repositories/tasks'
import { usersRepository } from '../../db/repositories/users'
import { appSettingsRepository } from '../../db/repositories/appSettings'
import { scheduleTaskReminders } from '../notifications'
import { initializeWhatsApp, getConnectionState } from '../../lib/whatsapp'

let schedulerTask: cron.ScheduledTask | null = null

export function startScheduler(): void {
  if (schedulerTask) {
    logger.warn('Scheduler already running')
    return
  }

  if (!appSettingsRepository.isSchedulerEnabled()) {
    logger.info('Scheduler disabled via settings')
    return
  }

  logger.info({ schedule: config.schedulerInterval }, 'Starting notification scheduler')

  schedulerTask = cron.schedule(config.schedulerInterval, async () => {
    if (!appSettingsRepository.isSchedulerEnabled()) return

    const startTime = Date.now()
    logger.debug('Scheduler tick started')

    try {
      await runSchedulerTick()
    } catch (error) {
      logger.error({ error }, 'Scheduler tick failed')
    }

    const duration = Date.now() - startTime
    appSettingsRepository.setLastSchedulerRun(new Date().toISOString())
    logger.debug({ duration }, 'Scheduler tick completed')
  })

  logger.info('Notification scheduler started')
}

export function stopScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop()
    schedulerTask = null
    logger.info('Notification scheduler stopped')
  }
}

async function runSchedulerTick(): Promise<void> {
  const tasks = tasksRepository.findForReminderCheck()
  
  if (tasks.length === 0) return

  logger.debug({ count: tasks.length }, 'Checking tasks for reminders')

  const userCache = new Map<number, { id: number; timezone: string; reminder_enabled: number; default_reminder_offset_minutes: number }>()

  for (const task of tasks) {
    let user = userCache.get(task.user_id)
    if (!user) {
      const dbUser = usersRepository.findById(task.user_id)
      if (dbUser) {
        user = {
          id: dbUser.id,
          timezone: dbUser.timezone,
          reminder_enabled: dbUser.reminder_enabled,
          default_reminder_offset_minutes: dbUser.default_reminder_offset_minutes
        }
        userCache.set(task.user_id, user)
      }
    }

    if (user) {
      await scheduleTaskReminders(task, user)
    }
  }

  const whatsappState = getConnectionState()
  if (whatsappState !== 'connected') {
    logger.debug({ state: whatsappState }, 'WhatsApp not connected, notifications queued')
  }
}

export async function initializeScheduler(): Promise<void> {
  await initializeWhatsApp()
  startScheduler()
}

export function getSchedulerStatus(): { running: boolean; schedule: string; enabled: boolean } {
  return {
    running: schedulerTask !== null,
    schedule: config.schedulerInterval,
    enabled: appSettingsRepository.isSchedulerEnabled()
  }
}

export function setSchedulerEnabled(enabled: boolean): void {
  appSettingsRepository.setSchedulerEnabled(enabled)
  if (enabled) {
    startScheduler()
  } else {
    stopScheduler()
  }
}