import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  })
}

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMs < 0) {
    const pastDays = Math.floor(-diffMs / (1000 * 60 * 60 * 24))
    const pastHours = Math.floor(-diffMs / (1000 * 60 * 60))
    if (pastDays > 0) return `${pastDays} hari yang lalu`
    if (pastHours > 0) return `${pastHours} jam yang lalu`
    return 'Barabaram'
  }

  if (diffDays > 0) return `${diffDays} hari lagi`
  if (diffHours > 0) return `${diffHours} jam lagi`
  if (diffMinutes > 0) return `${diffMinutes} menit lagi`
  return 'Sekarang'
}

export function getPriorityColor(priority: 'low' | 'medium' | 'high'): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  }
}

export function getPriorityLabel(priority: 'low' | 'medium' | 'high'): string {
  switch (priority) {
    case 'high': return 'Tinggi'
    case 'medium': return 'Sedang'
    case 'low': return 'Rendah'
  }
}

export function getStatusLabel(status: 'pending' | 'completed'): string {
  switch (status) {
    case 'pending': return 'Belum Selesai'
    case 'completed': return 'Selesai'
  }
}

export function isOverdue(deadline: string, status: 'pending' | 'completed'): boolean {
  if (status === 'completed') return false
  return new Date(deadline) < new Date()
}

export function isDueSoon(deadline: string, hours = 24): boolean {
  const now = new Date()
  const deadlineDate = new Date(deadline)
  const diffMs = deadlineDate.getTime() - now.getTime()
  return diffMs > 0 && diffMs <= hours * 60 * 60 * 1000
}

export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned
  }
  return cleaned
}

export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone)
  if (normalized.startsWith('62')) {
    return '+62 ' + normalized.slice(2).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')
  }
  return normalized
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}