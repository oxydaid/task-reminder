'use client'

import { useState } from 'react'
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  LogOut,
  Settings,
  Bell,
  LayoutDashboard,
  CheckCircle2,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  Sun,
  Moon,
  Laptop
} from 'lucide-react'
import { useAuth } from '@/hooks/useApi'
import { useTheme } from '@/context/ThemeContext'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tugas', href: '/tasks', icon: CalendarCheck },
  { name: 'Mata Kuliah', href: '/subjects', icon: BookOpen },
  { name: 'Notifikasi', href: '/notifications', icon: Bell },
  { name: 'Pengaturan', href: '/settings', icon: Settings }
]

export function Layout() {
  const { user, logout } = useAuth()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setUserMenuOpen(false)
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-tight tracking-tight text-foreground flex items-center gap-1.5">
                Task Reminder
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  WA Bot
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:block">Pengingat Tugas Kuliah</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              const Icon = item.icon
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-background text-primary shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  )}
                >
                  <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                  <span>{item.name}</span>
                </NavLink>
              )
            })}
          </nav>

          {/* User Menu & Theme Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-hidden"
              title={`Tema saat ini: ${theme === 'system' ? 'Sistem' : theme === 'dark' ? 'Gelap' : 'Terang'}. Klik untuk beralih.`}
              aria-label="Ubah tema"
            >
              {resolvedTheme === 'dark' ? (
                <Moon className="h-4 w-4 text-amber-400" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </button>

            <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-full hover:bg-muted/80 transition-colors focus:outline-hidden"
                >
                  <Avatar className="h-8 w-8 ring-1 ring-border shadow-xs">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {(user?.whatsapp_number || (user as any)?.whatsappNumber) ? (user?.whatsapp_number || (user as any)?.whatsappNumber).slice(-2) : 'TR'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold leading-tight">{formatPhoneNumber(user?.whatsapp_number || (user as any)?.whatsappNumber || '')}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{user?.role === 'admin' ? 'Administrator' : 'Mahasiswa'}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mt-1 rounded-xl shadow-lg border border-border/80" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">{formatPhoneNumber(user?.whatsapp_number || (user as any)?.whatsappNumber || '')}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {user?.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{user?.timezone || 'Asia/Jakarta'}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer py-2">
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Pengaturan Akun</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/notifications" className="cursor-pointer py-2">
                    <Bell className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Riwayat Notifikasi</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                    <span>Tema Tampilan</span>
                    <span className="text-[10px] capitalize font-semibold text-foreground">
                      {theme === 'system' ? 'Sistem' : theme === 'dark' ? 'Gelap' : 'Terang'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={cn(
                        'flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all',
                        theme === 'light'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all',
                        theme === 'dark'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('system')}
                      className={cn(
                        'flex items-center justify-center gap-1 py-1 rounded-lg text-xs font-semibold transition-all',
                        theme === 'system'
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Auto</span>
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Keluar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-28 md:pb-12">
        <Outlet />
      </main>

      {/* Modern Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/90 backdrop-blur-xl border-t border-border/70 shadow-lg px-2 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] flex items-center justify-around"
      >
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 px-3 min-w-[56px] rounded-xl transition-all duration-150',
                isActive
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              {isActive && (
                <span className="absolute -top-1 w-7 h-1 rounded-full bg-primary animate-in fade-in zoom-in-75 duration-200" />
              )}
              <Icon className={cn('h-5 w-5 transition-transform duration-150', isActive && 'scale-110 text-primary')} />
              <span className="text-[10px] mt-1 tracking-tight">{item.name}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
