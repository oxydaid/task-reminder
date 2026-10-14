'use client'

import { Clock, CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw, Bell } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useNotifications } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import { NotificationItem } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

export function Notifications() {
  const { notifications, isLoading } = useNotifications(1, 50)

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: 'Terkirim', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', icon: CheckCircle2 }
      case 'failed':
        return { label: 'Gagal', color: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300', icon: XCircle }
      case 'pending':
        return { label: 'Menunggu', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', icon: Clock }
      case 'processing':
        return { label: 'Diproses', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300', icon: Loader2 }
      case 'cancelled':
        return { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: AlertCircle }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-7 bg-muted animate-pulse rounded-xl w-1/3" />
        <div className="h-64 bg-card rounded-2xl border border-border/60 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Riwayat Notifikasi</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Log pengiriman pesan pengingat tugas otomatis ke WhatsApp</p>
      </div>

      <Card className="rounded-2xl border border-border/70 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground mb-3">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Belum ada riwayat notifikasi</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
                Notifikasi WhatsApp otomatis akan tercatat di sini saat bot mulai mengirimkan pengingat tugas kuliah.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notification: NotificationItem) => {
                const statusConfig = getStatusConfig(notification.status)
                const StatusIcon = statusConfig.icon

                return (
                  <div
                    key={notification.id}
                    className="flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border border-border/70 bg-card hover:shadow-xs transition-all"
                  >
                    <div className={cn('shrink-0 p-2 rounded-xl mt-0.5', statusConfig.color)}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate">{notification.task_title}</p>
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0', statusConfig.color)}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Dijadwalkan: {format(new Date(notification.scheduled_at), 'dd MMM, HH:mm', { locale: localeId })}
                        </span>
                        {notification.sent_at && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Terkirim {formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true, locale: localeId })}
                          </span>
                        )}
                        {notification.attempt_count > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <RefreshCw className="h-3 w-3" />
                            Percobaan: {notification.attempt_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
