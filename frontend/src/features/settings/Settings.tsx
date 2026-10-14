'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  Bell,
  Lock,
  User,
  Smartphone,
  Eye,
  EyeOff,
  LogOut,
  Bot,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Clock,
  PowerOff
} from 'lucide-react'
import { useAuth, useSettings } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { formatPhoneNumber } from '@/lib/utils'

const settingsSchema = z.object({
  timezone: z.string().min(1),
  reminderEnabled: z.boolean(),
  defaultReminderOffsetMinutes: z.number().min(0).max(30 * 24 * 60)
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
  confirmNewPassword: z.string()
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'Password baru tidak cocok',
  path: ['confirmNewPassword']
})

type SettingsFormData = z.infer<typeof settingsSchema>
type ChangePasswordData = z.infer<typeof changePasswordSchema>

const timezones = [
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (WIB)' },
  { value: 'Asia/Makassar', label: 'Asia/Makassar (WITA)' },
  { value: 'Asia/Jayapura', label: 'Asia/Jayapura (WIT)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala Lumpur' },
  { value: 'UTC', label: 'UTC' }
]

const reminderOffsets = [
  { value: 30, label: '30 menit sebelum deadline' },
  { value: 60, label: '1 jam sebelum deadline' },
  { value: 180, label: '3 jam sebelum deadline' },
  { value: 360, label: '6 jam sebelum deadline' },
  { value: 720, label: '12 jam sebelum deadline' },
  { value: 1440, label: '1 hari sebelum deadline (H-1)' },
  { value: 2880, label: '2 hari sebelum deadline (H-2)' },
  { value: 4320, label: '3 hari sebelum deadline (H-3)' }
]

export function Settings() {
  const { user, logout, changePassword } = useAuth()
  const { settings, isLoading, update: updateSettings, isUpdating } = useSettings()

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'bot'>('profile')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // WhatsApp Admin Bot state
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [botStatus, setBotStatus] = useState<string>('disconnected')
  const [botNumber, setBotNumber] = useState<string | null>(null)
  const [isBotLoading, setIsBotLoading] = useState(false)

  const {
    handleSubmit: handleSubmitSettings,
    watch,
    setValue
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    values: {
      timezone: settings?.timezone || 'Asia/Jakarta',
      reminderEnabled: settings?.reminderEnabled ?? true,
      defaultReminderOffsetMinutes: settings?.defaultReminderOffsetMinutes || 2880
    }
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema)
  })

  // Poll WhatsApp status while on bot tab
  useEffect(() => {
    if (user?.role !== 'admin') return

    const fetchStatus = () => {
      api.admin.getWhatsAppStatus()
        .then(res => {
          setBotStatus(res.status)
          setQrCode(res.qrCode)
          setBotNumber(res.botNumber)
        })
        .catch(() => {})
    }

    fetchStatus()

    let interval: ReturnType<typeof setInterval> | null = null
    if (activeTab === 'bot') {
      interval = setInterval(fetchStatus, 3000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [user?.role, activeTab])

  const handleRefreshQR = async () => {
    setIsBotLoading(true)
    try {
      await api.admin.reconnectWhatsApp()
      toast.success('Memuat ulang QR Code WhatsApp...')
      const res = await api.admin.getWhatsAppStatus()
      setBotStatus(res.status)
      setQrCode(res.qrCode)
      setBotNumber(res.botNumber)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memuat ulang QR Code')
    } finally {
      setIsBotLoading(false)
    }
  }

  const handleDisconnectBot = async () => {
    if (!confirm('Yakin ingin memutuskan koneksi WhatsApp bot ini? Anda perlu memindai QR Code lagi untuk menghubungkannya kembali.')) {
      return
    }

    setIsBotLoading(true)
    try {
      await api.admin.disconnectWhatsApp()
      toast.success('Sesi WhatsApp berhasil diputuskan')
      setBotStatus('disconnected')
      setQrCode(null)
      setBotNumber(null)
      setTimeout(async () => {
        const res = await api.admin.getWhatsAppStatus()
        setBotStatus(res.status)
        setQrCode(res.qrCode)
        setBotNumber(res.botNumber)
      }, 2000)
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memutuskan sesi WhatsApp')
    } finally {
      setIsBotLoading(false)
    }
  }

  const onSubmitSettings = async (data: SettingsFormData) => {
    try {
      await updateSettings(data)
    } catch {
      // Handled
    }
  }

  const onSubmitPassword = async (data: ChangePasswordData) => {
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmNewPassword: data.confirmNewPassword
      })
      resetPasswordForm()
    } catch {
      // Handled
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="h-7 bg-muted animate-pulse rounded-xl w-1/3" />
        <div className="h-64 bg-card rounded-2xl border border-border/60 animate-pulse" />
      </div>
    )
  }

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'notifications', label: 'Pengingat WA', icon: Bell },
    { id: 'security', label: 'Keamanan', icon: Lock },
    ...(user?.role === 'admin' ? [{ id: 'bot', label: 'Bot WA (Scan QR)', icon: Bot }] : [])
  ]

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Pengaturan</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">Kelola profil, waktu notifikasi, dan preferensi akun Anda</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/70 hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab: Profil */}
      {activeTab === 'profile' && (
        <Card className="rounded-2xl border border-border/70 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informasi Akun
            </CardTitle>
            <CardDescription className="text-xs">Informasi nomor WhatsApp dan zona waktu</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <form onSubmit={handleSubmitSettings(onSubmitSettings)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nomor WhatsApp Terdaftar</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={user?.whatsapp_number || ''}
                      disabled
                      className="pl-9 rounded-xl bg-muted/40 font-mono text-xs sm:text-sm"
                    />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Terverifikasi
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Zona Waktu</Label>
                <Select
                  value={watch('timezone')}
                  onValueChange={value => setValue('timezone', value)}
                >
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Pilih zona waktu" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {timezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Jadwal deadline & pengingat disesuaikan dengan zona waktu ini.</p>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isUpdating} className="rounded-xl font-semibold text-xs sm:text-sm px-5">
                  {isUpdating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Simpan Profil
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab: Pengingat Notifikasi */}
      {activeTab === 'notifications' && (
        <Card className="rounded-2xl border border-border/70 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              Preferensi Pengingat WhatsApp
            </CardTitle>
            <CardDescription className="text-xs">Atur pengiriman pesan otomatis ke WhatsApp Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <form onSubmit={handleSubmitSettings(onSubmitSettings)} className="space-y-5">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/30">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-semibold text-foreground">Kirim Notifikasi WhatsApp</p>
                  <p className="text-[11px] text-muted-foreground">Kirim pesan WhatsApp sebelum deadline tugas tiba</p>
                </div>
                <Switch
                  checked={watch('reminderEnabled')}
                  onCheckedChange={checked => setValue('reminderEnabled', checked)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Waktu Pengingat Default</Label>
                <Select
                  value={String(watch('defaultReminderOffsetMinutes'))}
                  onValueChange={value => setValue('defaultReminderOffsetMinutes', Number(value))}
                >
                  <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                    <SelectValue placeholder="Pilih waktu pengingat" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {reminderOffsets.map(offset => (
                      <SelectItem key={offset.value} value={String(offset.value)}>
                        {offset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Bot akan menjadwalkan notifikasi WhatsApp pada waktu yang dipilih sebelum deadline setiap tugas.
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={isUpdating} className="rounded-xl font-semibold text-xs sm:text-sm px-5">
                  {isUpdating && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Simpan Pengaturan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab: Keamanan Akun */}
      {activeTab === 'security' && (
        <Card className="rounded-2xl border border-border/70 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Keamanan Akun
            </CardTitle>
            <CardDescription className="text-xs">Ubah kata sandi akun masuk Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Password Saat Ini</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...registerPassword('currentPassword')}
                    className="rounded-xl pr-10 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Password Baru</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Minimal 8 karakter"
                    {...registerPassword('newPassword')}
                    className="rounded-xl pr-10 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ulangi password baru"
                    {...registerPassword('confirmNewPassword')}
                    className="rounded-xl pr-10 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmNewPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.confirmNewPassword.message}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" variant="outline" className="rounded-xl font-semibold text-xs sm:text-sm w-full">
                  Perbarui Password
                </Button>
              </div>

              <Separator className="my-4" />

              <Button
                type="button"
                variant="destructive"
                onClick={handleLogout}
                className="w-full rounded-xl font-semibold text-xs sm:text-sm gap-2"
              >
                <LogOut className="h-4 w-4" />
                Keluar dari Akun Ini
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab: Bot WhatsApp Admin (Baileys QR Scan) */}
      {activeTab === 'bot' && user?.role === 'admin' && (
        <Card className="rounded-2xl border border-border/70 shadow-xs">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  Koneksi Bot WhatsApp (Baileys QR)
                </CardTitle>
                <CardDescription className="text-xs">Pindai QR code dari WhatsApp HP Anda untuk mengaktifkan bot pengirim</CardDescription>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                botStatus === 'connected'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {botStatus === 'connected' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Clock className="h-3.5 w-3.5" />}
                {botStatus === 'connected' ? 'Terhubung' : 'Belum Terhubung'}
              </span>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0 space-y-4">
            {botStatus === 'connected' ? (
              /* Connected State */
              <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 text-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">WhatsApp Bot Sedang Aktif</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Bot siap mengirimkan notifikasi pengingat tugas kuliah ke WhatsApp pengguna.
                  </p>
                  {botNumber && (
                    <p className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-2 bg-emerald-100/60 dark:bg-emerald-900/40 inline-block px-3 py-1 rounded-full">
                      Nomor Bot: {formatPhoneNumber(botNumber)}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectBot}
                    disabled={isBotLoading}
                    className="rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 gap-1.5"
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                    Putuskan Sesi / Ganti Nomor
                  </Button>
                </div>
              </div>
            ) : (
              /* Disconnected / Scanning QR State */
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-900 dark:text-blue-200 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1.5">
                    <QrCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Cara Menghubungkan WhatsApp via Scan QR:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] opacity-90 pl-1">
                    <li>Buka aplikasi WhatsApp di HP nomor yang ingin dijadikan bot.</li>
                    <li>Buka menu <strong>Titik Tiga (Android)</strong> atau <strong>Pengaturan (iPhone)</strong>.</li>
                    <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                    <li>Tekan tombol <strong>Tautkan Perangkat</strong>.</li>
                    <li>Arahkan kamera HP Anda ke QR Code di bawah ini.</li>
                  </ol>
                </div>

                {/* QR Display Container */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl border border-border/80 bg-background/80 text-center space-y-3">
                  {qrCode ? (
                    <div className="relative group p-2 rounded-2xl bg-white border border-border shadow-md">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-muted/40 border border-dashed border-border/80 flex flex-col items-center justify-center p-4">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Menghubungi Baileys...</p>
                      <p className="text-[11px] text-muted-foreground/80 mt-1">Menyiapkan QR Code baru</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    QR Code diperbarui otomatis. Pindai sebelum kode kedaluwarsa.
                  </p>

                  <div className="pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshQR}
                      disabled={isBotLoading}
                      className="rounded-xl text-xs font-semibold gap-1.5"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isBotLoading ? 'animate-spin' : ''}`} />
                      Muat Ulang / Refresh QR
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
