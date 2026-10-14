'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, CheckCircle2, XCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useNotifications } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import { NotificationItem } from '@/types'
import { format, formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

export function Notifications() {
  const [page, setPage] = useState(1)
  const { notifications, meta, isLoading } = useNotifications(page, 20)

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'sent':
        return { label: 'Terkirim', color: 'bg-green-100 text-green-800', icon: CheckCircle2 }
      case 'failed':
        return { label: 'Gagal', color: 'bg-red-100 text-red-800', icon: XCircle }
      case 'pending':
        return { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-800', icon: Clock }
      case 'processing':
        return { label: 'Diproses', color: 'bg-blue-100 text-blue-800', icon: Loader2 }
      case 'cancelled':
        return { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <Card><CardContent className="h-64 animate-pulse" /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Notifikasi</h1>
        <p className="text-muted-foreground">Lihat status pengiriman pengingat tugas ke WhatsApp</p>
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="pt-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Belum ada notifikasi</h3>
              <p className="text-muted-foreground">Notifikasi akan muncul di sini setelah pengingat tugas dikirim</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 p-4">
                  {notifications.map((notification: NotificationItem) => {
                    const statusConfig = getStatusConfig(notification.status)
                    const StatusIcon = statusConfig.icon
                    
                    return (
                      <div
                        key={notification.id}
                        className="flex items-start gap-4 p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className={cn('flex-shrink-0 p-2 rounded-full', statusConfig.color)}>
                          <StatusIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{notification.task_title}</p>
                            <Badge variant="outline" className={cn(statusConfig.color, 'h-5 px-2')}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Dijadwalkan: {format(new Date(notification.scheduled_at), 'dd MMM yyyy, HH:mm')}
                            </span>
                            {notification.sent_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                Terkirim: {formatDistanceToNow(new Date(notification.sent_at), { addSuffix: true, locale: id })}
                              </span>
                            )}
                            {notification.attempt_count > 0 && (
                              <span className="flex items-center gap-1 text-orange-600">
                                <RefreshCw className="h-3 w-3" />
                                Percobaan: {notification.attempt_count}
                              </span>
                            )}
                          </div>
                          {notification.last_error && (
                            <p className="mt-2 text-sm text-red-500 bg-red-50 p-2 rounded dark:bg-red-900/20">
                              Error: {notification.last_error}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {/* Pagination */}
              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} notifikasi)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p: number) => Math.min(meta.totalPages, p + 1))}
                      disabled={page === meta.totalPages}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
