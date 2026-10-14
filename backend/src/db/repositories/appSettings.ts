import { db } from '../index'

export interface AppSetting {
  key: string
  value: string
  description: string | null
  updated_at: string
}

export const appSettingsRepository = {
  get(key: string): AppSetting | null {
    const row = db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key)
    return (row as unknown as AppSetting) ?? null
  },

  getValue(key: string): string | null {
    const setting = this.get(key)
    return setting?.value ?? null
  },

  set(key: string, value: string, description?: string): AppSetting {
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = COALESCE(excluded.description, description), updated_at = datetime('now')
      RETURNING *
    `)
    return stmt.get(key, value, description ?? null) as unknown as AppSetting
  },

  delete(key: string): boolean {
    const result = db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
    return Number(result.changes) > 0
  },

  list(): AppSetting[] {
    return db.prepare('SELECT * FROM app_settings ORDER BY key').all() as unknown as AppSetting[]
  },

  isSchedulerEnabled(): boolean {
    const value = this.getValue('scheduler_enabled')
    return value === 'true'
  },

  setSchedulerEnabled(enabled: boolean): void {
    this.set('scheduler_enabled', enabled ? 'true' : 'false', 'Whether the notification scheduler is enabled')
  },

  isWhatsAppConnected(): boolean {
    const value = this.getValue('whatsapp_connected')
    return value === 'true'
  },

  setWhatsAppConnected(connected: boolean): void {
    this.set('whatsapp_connected', connected ? 'true' : 'false', 'WhatsApp connection status')
  },

  getLastSchedulerRun(): string | null {
    return this.getValue('last_scheduler_run')
  },

  setLastSchedulerRun(timestamp: string): void {
    this.set('last_scheduler_run', timestamp, 'Last scheduler run timestamp')
  }
}