'use client'

import { useState } from 'react'
import { Outlet, Link, NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut, Settings, Bell, Menu, X, ChevronDown, LayoutDashboard, ListTodo, BookOpen } from 'lucide-react'
import { useAuth } from '@/hooks/useApi'
import { formatPhoneNumber } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Tugas', href: '/tasks', icon: ListTodo },
  { name: 'Mata Kuliah', href: '/subjects', icon: BookOpen },
  { name: 'Notifikasi', href: '/notifications', icon: Bell },
  { name: 'Pengaturan', href: '/settings', icon: Settings }
]

export function Layout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    setUserMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 lg:hidden', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <Link to="/" className="font-semibold text-lg">Task Reminder</Link>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          {/* Desktop navigation */}
          <nav className="hidden gap-1 lg:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt={user?.whatsapp_number || ''} />
                  <AvatarFallback className="text-xs font-medium">
                    {user?.whatsapp_number?.slice(-2) || '?'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{formatPhoneNumber(user?.whatsapp_number || '')}</p>
                  <p className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Administrator' : 'Pengguna'}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" onClick={() => setUserMenuOpen(false)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Pengaturan
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/notifications" onClick={() => setUserMenuOpen(false)}>
                  <Bell className="mr-2 h-4 w-4" />
                  Notifikasi
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Main content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}