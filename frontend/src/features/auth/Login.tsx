'use client'

import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Loader2, Lock, Eye, EyeOff, Smartphone } from 'lucide-react'
import { useAuth } from '@/hooks/useApi'
import { normalizePhoneNumber } from '@/lib/utils'

const loginSchema = z.object({
  whatsappNumber: z.string().min(10, 'Nomor WhatsApp minimal 10 digit').max(15),
  password: z.string().min(1, 'Password wajib diisi')
})

type LoginForm = z.infer<typeof loginSchema>

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const { login, isLoginPending } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      whatsappNumber: ''
    }
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      await login({
        whatsappNumber: normalizePhoneNumber(data.whatsappNumber),
        password: data.password
      })
      navigate(redirect, { replace: true })
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Smartphone className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Masuk ke Task Reminder</CardTitle>
          <CardDescription>Masukkan nomor WhatsApp dan password Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">Nomor WhatsApp</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="whatsappNumber"
                  type="tel"
                  placeholder="08xx-xxxx-xxxx"
                  className="pl-10"
                  {...register('whatsappNumber')}
                  disabled={isLoginPending}
                />
              </div>
              {errors.whatsappNumber && (
                <p className="text-sm text-destructive">{errors.whatsappNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  {...register('password')}
                  disabled={isLoginPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoginPending}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoginPending}>
              {isLoginPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Masuk...
                </>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <div className="relative w-full">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">atau</span>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Belum punya akun?{' '}
            <Link to={`/register?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-primary hover:underline">
              Daftar di sini
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}