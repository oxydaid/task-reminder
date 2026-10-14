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
import { Loader2, Smartphone, Lock, Eye, EyeOff, UserPlus } from 'lucide-react'
import { useAuth } from '@/hooks/useApi'
import { normalizePhoneNumber } from '@/lib/utils'

const registerSchema = z.object({
  whatsappNumber: z.string().min(10, 'Nomor WhatsApp minimal 10 digit').max(15),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Password tidak cocok',
  path: ['confirmPassword']
})

type RegisterForm = z.infer<typeof registerSchema>

export function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/verify-whatsapp'
  const { register: registerUser, isRegisterPending } = useAuth()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      whatsappNumber: '',
      password: '',
      confirmPassword: ''
    }
  })

  const onSubmit = async (data: RegisterForm) => {
    try {
      await registerUser({
        whatsappNumber: normalizePhoneNumber(data.whatsappNumber),
        password: data.password,
        confirmPassword: data.confirmPassword
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
            <UserPlus className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Buat Akun Baru</CardTitle>
          <CardDescription>Daftar untuk mulai mengelola tugas kuliah Anda</CardDescription>
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
                  disabled={isRegisterPending}
                />
              </div>
              {errors.whatsappNumber && (
                <p className="text-sm text-destructive">{errors.whatsappNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimal 8 karakter"
                  className="pl-10 pr-10"
                  {...register('password')}
                  disabled={isRegisterPending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isRegisterPending}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ulangi password"
                  className="pl-10"
                  {...register('confirmPassword')}
                  disabled={isRegisterPending}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isRegisterPending}>
              {isRegisterPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mendaftar...
                </>
              ) : (
                'Daftar'
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
            Sudah punya akun?{' '}
            <Link to={`/login?redirect=${encodeURIComponent(redirect)}`} className="font-medium text-primary hover:underline">
              Masuk di sini
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}