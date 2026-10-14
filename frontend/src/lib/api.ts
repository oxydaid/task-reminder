const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include',
    ...options
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code || 'ERROR',
      data.error?.message || 'Terjadi kesalahan',
      data.error?.details
    )
  }

  return data.data as T
}

export const api = {
  auth: {
    register: (data: { whatsappNumber: string; password: string; confirmPassword: string }) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { whatsappNumber: string; password: string }) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    verifyWhatsApp: (data: { whatsappNumber: string; code: string }) =>
      request('/auth/confirm-whatsapp', { method: 'POST', body: JSON.stringify(data) }),
    requestVerification: (whatsappNumber: string) =>
      request('/auth/request-verification', { method: 'POST', body: JSON.stringify({ whatsappNumber }) }),
    changePassword: (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify(data) })
  },
  subjects: {
    list: () => request<any[]>('/subjects'),
    create: (data: { name: string; code?: string; lecturer?: string; color?: string }) =>
      request('/subjects', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request(`/subjects/${id}`),
    update: (id: number, data: Partial<{ name: string; code: string; lecturer: string; color: string }>) =>
      request(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/subjects/${id}`, { method: 'DELETE' })
  },
  tasks: {
    list: (params?: Record<string, string>) => {
      const searchParams = new URLSearchParams(params)
      return request<any>('/tasks?' + searchParams.toString())
    },
    create: (data: {
      subjectId?: number | null
      title: string
      description?: string
      deadlineAt: string
      priority?: 'low' | 'medium' | 'high'
      status?: 'pending' | 'completed'
      reminderEnabled?: boolean | null
      reminderOffsetMinutes?: number | null
    }) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: number) => request(`/tasks/${id}`),
    update: (id: number, data: Partial<{
      subjectId: number | null
      title: string
      description: string
      deadlineAt: string
      priority: 'low' | 'medium' | 'high'
      status: 'pending' | 'completed'
      reminderEnabled: boolean | null
      reminderOffsetMinutes: number | null
    }>) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request(`/tasks/${id}`, { method: 'DELETE' }),
    complete: (id: number) => request(`/tasks/${id}/complete`, { method: 'PATCH' })
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
    upcoming: (limit = 10) => request(`/dashboard/upcoming?limit=${limit}`),
    overdue: () => request('/dashboard/overdue'),
    dueSoon: (hours = 24) => request(`/dashboard/due-soon?hours=${hours}`)
  },
  settings: {
    get: () => request('/settings'),
    update: (data: { timezone?: string; reminderEnabled?: boolean; defaultReminderOffsetMinutes?: number }) =>
      request('/settings', { method: 'PATCH', body: JSON.stringify(data) })
  },
  notifications: {
    list: (page = 1, limit = 50) => request(`/notifications?page=${page}&limit=${limit}`),
    get: (id: number) => request(`/notifications/${id}`)
  },
  admin: {
    getStats: () => request<{ totalUsers: number; whatsappStatus: string; schedulerEnabled: boolean; lastSchedulerRun: string | null }>('/admin/stats'),
    getWhatsAppStatus: () => request<{ status: string; qrCode: string | null; botNumber: string | null; hasSession?: boolean }>('/admin/whatsapp/status'),
    generateQR: () => request<{ status: string; qrCode: string | null; botNumber: string | null }>('/admin/whatsapp/generate-qr', { method: 'POST' }),
    reconnectWhatsApp: () => request<{ message: string; qrCode?: string | null; status?: string; botNumber?: string | null }>('/admin/whatsapp/reconnect', { method: 'POST' }),
    disconnectWhatsApp: () => request<{ message: string }>('/admin/whatsapp/disconnect', { method: 'POST' }),
    testMessage: (phoneNumber: string, message?: string) => request<{ message: string; recipient: string }>('/admin/whatsapp/test-message', { method: 'POST', body: JSON.stringify({ phoneNumber, message }) })
  }
}