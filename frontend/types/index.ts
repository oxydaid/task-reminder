export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  whatsapp_number: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: string;
  timezone: string;
  reminder_enabled: boolean;
  default_reminder_offset_minutes: number;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  code?: string;
  lecturer?: string;
  color?: string;
  task_count?: number;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "completed";

export interface Task {
  id: string;
  user_id: string;
  course_id?: string | null;
  course_name?: string;
  course_color?: string;
  title: string;
  description: string;
  deadline_at: string;
  priority: TaskPriority;
  status: TaskStatus;
  is_overdue: boolean;
  reminder_enabled: boolean;
  reminder_offset_minutes: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  nearing_tasks: number;
  upcoming_tasks: Task[];
}

export interface ReminderLog {
  id: string;
  user_id: string;
  task_id: string;
  task_title: string;
  course_name?: string;
  offset_minutes: number;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  attempt_count: number;
  last_error?: string;
  sent_at?: string;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  billing_period: string;
  course_limit: number;
  task_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppStatus {
  is_connected: boolean;
  is_logged_in: boolean;
  phone_number?: string;
  qr_code?: string;
  qr_code_image?: string;
  last_error?: string;
  last_connected?: string;
}

export interface AdminUserItem extends User {
  task_count: number;
  course_count: number;
}
