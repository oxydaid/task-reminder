'use client'

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Smartphone, RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useApi'
import { toast } from 'sonner'
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils'

const verifySchema = z.object({
  whatsappNumber: z.string().min(10).max(15),
  code: z.string().length(6, 'Kode verifikasi harus 6 digit').regex(/^\d+$/, 'Hanya angka')
})

type VerifyForm = z.infer<typeof verifySchema>

export function VerifyWhatsApp() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const whatsappNumberFromUrl = searchParams.get('whatsappNumber') || ''
  const redirect = searchParams.get('redirect') || '/'
  const { verifyWhatsApp, requestVerification, isLoginPending } = useAuth()
  const [resendCooldown, setResendCooldown] = useState<number>(0)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<VerifyForm>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      whatsappNumber: whatsappNumberFromUrl,
      code: ''
    }
  })

  const code = watch('code')

  const handleResend = async () => {
    if (resendCooldown > 0) return
    try {
      await requestVerification(normalizePhoneNumber(watch('whatsappNumber')))
      toast.success('Kode verifikasi baru telah dikirim')
      setResendCooldown(60)
      const interval = setInterval(() => {
        setResendCooldown((c: number) => {
          if (c <= 1) {
            clearInterval(interval)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {
      // Error handled by mutation
    }
  }

  const onSubmit = async (data: VerifyForm) => {
    try {
      await verifyWhatsApp({
        whatsappNumber: normalizePhoneNumber(data.whatsappNumber),
        code: data.code
      })
      toast.success('Verifikasi berhasil!')
      navigate(redirect, { replace: true })
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verifikasi WhatsApp</CardTitle>
          <CardDescription>
            Masukkan kode 6 digit yang dikirim ke <strong>{formatPhoneNumber(watch('whatsappNumber'))}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kode Verifikasi</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                {...register('code')}
                disabled={isLoginPending}
                autoComplete="one-time-code"
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tidak menerima kode?</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoginPending}
              >
                {resendCooldown > 0 ? (
                  <>
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                    Kirim ulang ({resendCooldown}s)
                  </>
                ) : (
                  'Kirim ulang'
                )}
              </Button>
            </div>

            <Button type="submit" className="w-full" disabled={isLoginPending || code.length !== 6}>
              {isLoginPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Verifikasi'
              )}
            </Button>
          </form>

          <div className="mt-6 p-4 space-y-3 text-sm bg-muted/50 rounded-lg">
            <h4 className="font-medium">Cara Verifikasi:</h4>
            <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
              <li>Buka WhatsApp di HP Anda</li>
              <li>Mulai chat ke nomor bot Task Reminder</li>
              <li>Kirim pesan: <code className="bg-background px-1 rounded">VERIFY 123456</code> (ganti dengan kode Anda)</li>
              <li>Klik tombol Verifikasi di atas</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}