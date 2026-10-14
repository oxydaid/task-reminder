import { z } from 'zod'

export const phoneNumberSchema = z.string().min(10).max(15).regex(/^\+?[0-9]+$/, 'Nomor telepon hanya boleh berisi angka dan tanda +')

export const passwordSchema = z.string().min(8).max(128)

export const registerSchema = z.object({
  whatsappNumber: phoneNumberSchema,
  password: passwordSchema,
  confirmPassword: passwordSchema
}).refine(data => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword']
})

export const loginSchema = z.object({
  whatsappNumber: phoneNumberSchema,
  password: z.string().min(1)
})

export const verifyWhatsAppSchema = z.object({
  whatsappNumber: phoneNumberSchema,
  code: z.string().length(6, 'Kode verifikasi harus 6 digit').regex(/^\d+$/, 'Kode verifikasi hanya boleh angka')
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
  confirmNewPassword: passwordSchema
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Password baru tidak cocok',
  path: ['confirmNewPassword']
})

export const subjectSchema = z.object({
  name: z.string().min(1, 'Nama mata kuliah wajib diisi').max(100),
  code: z.string().max(20).optional(),
  lecturer: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna tidak valid (hex)').optional()
})

export const taskSchema = z.object({
  subjectId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1, 'Judul tugas wajib diisi').max(200),
  description: z.string().max(2000).optional(),
  deadlineAt: z.string().datetime({ message: 'Format deadline tidak valid' }),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'completed']).default('pending'),
  reminderEnabled: z.boolean().optional().nullable(),
  reminderOffsetMinutes: z.number().int().min(0).optional().nullable()
})

export const taskUpdateSchema = taskSchema.partial()

export const settingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  reminderEnabled: z.boolean().optional(),
  defaultReminderOffsetMinutes: z.number().int().min(0).max(30 * 24 * 60).optional()
})

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export const taskFiltersSchema = z.object({
  status: z.enum(['pending', 'completed']).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['deadline_asc', 'deadline_desc', 'created_desc', 'priority_desc']).default('deadline_asc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type VerifyWhatsAppInput = z.infer<typeof verifyWhatsAppSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type SubjectInput = z.infer<typeof subjectSchema>
export type TaskInput = z.infer<typeof taskSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type SettingsInput = z.infer<typeof settingsSchema>
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>