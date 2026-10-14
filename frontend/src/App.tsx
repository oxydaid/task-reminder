import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useApi'
import { Layout } from '@/components/layout'
import { Login } from '@/features/auth/Login'
import { Register } from '@/features/auth/Register'
import { VerifyWhatsApp } from '@/features/auth/VerifyWhatsApp'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { Tasks } from '@/features/tasks/Tasks'
import { Subjects } from '@/features/subjects/Subjects'
import { Settings } from '@/features/settings/Settings'
import { Notifications } from '@/features/notifications/Notifications'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/verify-whatsapp" element={<PublicRoute><VerifyWhatsApp /></PublicRoute>} />
      
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}