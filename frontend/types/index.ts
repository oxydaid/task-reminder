export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  whatsapp_number: string;
  role: UserRole;
  is_active: boolean;
  is_verified?: boolean;
  verified_at?: string | null;
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
  notification_limit: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = "active" | "expired" | "cancelled" | "pending" | "trialing";
export type SubscriptionType = "paid" | "trial" | "free";

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan?: Plan;
  status: SubscriptionStatus;
  subscription_type: SubscriptionType;
  started_at: string;
  expires_at?: string | null;
  activated_at: string;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserUsage {
  active_plan: Plan;
  subscription?: Subscription;
  course_count: number;
  course_limit: number;
  task_count: number;
  task_limit: number;
  notification_count: number;
  notification_limit: number;
  is_over_limit: boolean;
  days_remaining: number;
}

export type PaymentMethodType = "bank_transfer" | "qris";
export type FeeType = "fixed" | "percentage" | "mixed";

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  qris_image_url?: string;
  description?: string;
  fee_type: FeeType;
  fee_percentage: number;
  fee_fixed: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TransactionStatus =
  | "pending_payment"
  | "waiting_verification"
  | "paid"
  | "rejected"
  | "cancelled"
  | "expired";

export interface PaymentProof {
  id: string;
  transaction_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  source: string;
  notes?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  code: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  plan_id: string;
  payment_method_id: string;
  plan_name: string;
  plan_price: number;
  plan_course_limit: number;
  plan_task_limit: number;
  plan_notification_limit: number;
  payment_method_name: string;
  payment_method_type: PaymentMethodType;
  payment_method_details: string;
  fee_type: FeeType;
  fee_percentage: number;
  fee_fixed: number;
  fee_amount: number;
  subtotal: number;
  total_amount: number;
  status: TransactionStatus;
  expires_at: string;
  paid_at?: string | null;
  verified_by?: string;
  admin_notes?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  proofs?: PaymentProof[];
}

export interface AdminNotificationSettings {
  admin_id: string;
  receive_transaction_notification: boolean;
  receive_payment_proof_notification: boolean;
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
