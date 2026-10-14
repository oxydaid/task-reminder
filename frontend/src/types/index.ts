export interface User {
  id: number
  whatsapp_number?: string
  whatsappNumber?: string
  role: 'user' | 'admin'
  timezone: string
  reminder_enabled?: boolean
  reminderEnabled?: boolean
  default_reminder_offset_minutes?: number
  defaultReminderOffsetMinutes?: number
  whatsapp_verified_at?: string | null
  whatsappVerifiedAt?: string | null
}

export interface Subject {
  id: number
  user_id: number
  name: string
  code: string | null
  lecturer: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  description: string | null
  deadline_at: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'completed'
  reminder_enabled: number | null
  reminder_offset_minutes: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
  subject_name?: string | null
  subject_color?: string | null
}

export interface DashboardSummary {
  total: number
  pending: number
  completed: number
  overdue: number
  dueSoon: number
}

export interface NotificationItem {
  id: number
  user_id: number
  task_id: number
  task_title: string
  task_deadline: string
  notification_type: 'reminder' | 'deadline' | 'overdue'
  scheduled_at: string
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled'
  attempt_count: number
  next_attempt_at: string | null
  sent_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SettingsData {
  whatsappNumber: string
  whatsappVerifiedAt: string | null
  timezone: string
  reminderEnabled: boolean
  defaultReminderOffsetMinutes: number
}