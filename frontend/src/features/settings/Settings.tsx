'use client'

import { useState } from 'react'
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
import { Loader2, Bell, Lock, User, Smartphone, Eye, EyeOff, AlertTriangle, LogOut } from 'lucide-react'
import { useAuth, useSettings } from '@/hooks/useApi'

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
  { value: 30, label: '30 menit' },
  { value: 60, label: '1 jam' },
  { value: 180, label: '3 jam' },
  { value: 360, label: '6 jam' },
  { value: 720, label: '12 jam' },
  { value: 1440, label: '1 hari (H-1)' },
  { value: 2880, label: '2 hari (H-2)' },
  { value: 4320, label: '3 hari (H-3)' },
  { value: 10080, label: '1 minggu (H-7)' }
]

export function Settings() {
  const { user, logout, changePassword } = useAuth()
  const { settings, isLoading, update: updateSettings, isUpdating } = useSettings()
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
    formState: { errors: passwordErrors }
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema)
  })

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
    } catch {
      // Handled
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <Card><CardContent className="h-64 animate-pulse" /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground">Kelola pengaturan akun dan preferensi Anda</p>
      </div>

      <div className="flex gap-2 border-b">
        {[
          { id: 'profile', label: 'Profil', icon: User },
          { id: 'notifications', label: 'Notifikasi', icon: Bell },
          { id: 'security', label: 'Keamanan', icon: Lock }
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="gap-2"
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil
            </CardTitle>
            <CardDescription>Informasi akun dan preferensi dasar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitSettings(onSubmitSettings)} className="space-y-6">
              <div className="space-y-2">
                <Label>Nomor WhatsApp</Label>
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                  <Input value={user?.whatsapp_number || ''} disabled />
                  {user?.whatsapp_verified_at ? (
                    <span className="text-green-500 text-sm flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Terverifikasi
                    </span>
                  ) : (
                    <span className="text-yellow-500 text-sm flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Belum terverifikasi
                    </span>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Waktu</Label>
                  <Select
                    value={watch('timezone')}
                    onValueChange={value => setValue('timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih zona waktu" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Preferensi Pengingat
            </CardTitle>
            <CardDescription>Atur cara Anda menerima notifikasi WhatsApp</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitSettings(onSubmitSettings)} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notifikasi WhatsApp</Label>
                  <p className="text-sm text-muted-foreground">Aktifkan atau nonaktifkan semua pengingat otomatis</p>
                </div>
                <Switch
                  checked={watch('reminderEnabled')}
                  onCheckedChange={checked => setValue('reminderEnabled', checked)}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Waktu Pengingat Standar</Label>
                <p className="text-sm text-muted-foreground">Kapan notifikasi harus dikirim sebelum deadline tugas</p>
                <Select
                  value={String(watch('defaultReminderOffsetMinutes'))}
                  onValueChange={value => setValue('defaultReminderOffsetMinutes', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih waktu pengingat" />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderOffsets.map(offset => (
                      <SelectItem key={offset.value} value={String(offset.value)}>
                        {offset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Keamanan Akun
            </CardTitle>
            <CardDescription>Ubah kata sandi akun Anda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    {...registerPassword('currentPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.currentPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    {...registerPassword('newPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Konfirmasi Password Baru</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...registerPassword('confirmNewPassword')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {passwordErrors.confirmNewPassword && (
                  <p className="text-xs text-destructive">{passwordErrors.confirmNewPassword.message}</p>
                )}
              </div>

              <Button type="submit" variant="outline" className="w-full">
                Ubah Password
              </Button>
            </form>

            <Separator className="my-6" />

            <div className="space-y-2">
              <Button variant="destructive" onClick={handleLogout} className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar dari Akun
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && !user?.whatsapp_verified_at && (
        <Card className="border-yellow-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 p-4 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Nomor WhatsApp belum diverifikasi</p>
                <p className="text-sm">Anda tidak akan menerima notifikasi pengingat tugas hingga verifikasi selesai.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
