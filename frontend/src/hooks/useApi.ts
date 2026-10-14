import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { User, Subject, Task, DashboardSummary, NotificationItem, SettingsData } from '@/types'
import { toast } from 'sonner'

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading, isFetched, error } = useQuery<User | null>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.auth.me() as any
        return res?.user || res || null
      } catch (err: any) {
        if (err?.status === 401) {
          return null
        }
        throw err
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5
  })

  const loginMutation = useMutation({
    mutationFn: api.auth.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Login berhasil')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const registerMutation = useMutation({
    mutationFn: api.auth.register,
    onSuccess: (res: any) => {
      const user = res?.data?.user || res?.user
      if (user) {
        queryClient.setQueryData(['auth', 'me'], user)
      }
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Pendaftaran berhasil! Selamat datang di Task Reminder.')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const logoutMutation = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
      toast.success('Logout berhasil')
    },
    onError: (err: ApiError) => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
      toast.error(err.message)
    }
  })

  const verifyWhatsAppMutation = useMutation({
    mutationFn: api.auth.verifyWhatsApp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Verifikasi berhasil')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const requestVerificationMutation = useMutation({
    mutationFn: api.auth.requestVerification,
    onSuccess: () => {
      toast.success('Kode verifikasi baru telah dikirim')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: api.auth.changePassword,
    onSuccess: () => {
      toast.success('Password berhasil diubah, silakan login kembali')
      queryClient.clear()
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  return {
    user,
    isLoading: isLoading && !isFetched,
    error,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    verifyWhatsApp: verifyWhatsAppMutation.mutateAsync,
    requestVerification: requestVerificationMutation.mutateAsync,
    changePassword: changePasswordMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    isLogoutPending: logoutMutation.isPending
  }
}

export function useSubjects() {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<Subject[]>({
    queryKey: ['subjects'],
    queryFn: () => api.subjects.list() as Promise<Subject[]>
  })

  const createMutation = useMutation({
    mutationFn: api.subjects.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Mata kuliah berhasil ditambahkan')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.subjects.update>[1] }) =>
      api.subjects.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      toast.success('Mata kuliah berhasil diperbarui')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: api.subjects.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Mata kuliah berhasil dihapus')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  return {
    subjects: data || [],
    isLoading,
    error,
    refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    deleteSubject: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  }
}

export function useTasks(params?: Record<string, string>) {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['tasks', params],
    queryFn: () => api.tasks.list(params)
  })

  const createMutation = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tugas berhasil dibuat')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.tasks.update>[1] }) =>
      api.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tugas berhasil diperbarui')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Tugas berhasil dihapus')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const completeMutation = useMutation({
    mutationFn: api.tasks.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Status tugas berhasil diperbarui')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  const taskList: Task[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.tasks)
    ? data.tasks
    : []

  return {
    tasks: taskList,
    meta: Array.isArray(data) ? undefined : data?.meta,
    isLoading,
    error,
    refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    deleteTask: deleteMutation.mutateAsync,
    toggleComplete: completeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCompleting: completeMutation.isPending
  }
}

export function useDashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useQuery<DashboardSummary>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.dashboard.summary() as Promise<DashboardSummary>
  })

  const { data: upcoming, isLoading: isUpcomingLoading } = useQuery<Task[]>({
    queryKey: ['dashboard', 'upcoming'],
    queryFn: () => api.dashboard.upcoming(10) as Promise<Task[]>
  })

  const { data: overdue, isLoading: isOverdueLoading } = useQuery<Task[]>({
    queryKey: ['dashboard', 'overdue'],
    queryFn: () => api.dashboard.overdue() as Promise<Task[]>
  })

  const { data: dueSoon, isLoading: isDueSoonLoading } = useQuery<Task[]>({
    queryKey: ['dashboard', 'dueSoon'],
    queryFn: () => api.dashboard.dueSoon(24) as Promise<Task[]>
  })

  return {
    summary: summary || { total: 0, pending: 0, completed: 0, overdue: 0, dueSoon: 0 },
    upcoming: upcoming || [],
    overdue: overdue || [],
    dueSoon: dueSoon || [],
    isLoading: isSummaryLoading || isUpcomingLoading || isOverdueLoading || isDueSoonLoading
  }
}

export function useSettings() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => api.settings.get() as Promise<SettingsData>
  })

  const updateMutation = useMutation({
    mutationFn: api.settings.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('Pengaturan berhasil disimpan')
    },
    onError: (err: ApiError) => {
      toast.error(err.message)
    }
  })

  return {
    settings: data,
    isLoading,
    error,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending
  }
}

export function useNotifications(page = 1, limit = 50) {
  const { data, isLoading, error } = useQuery<{ notifications: NotificationItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }>({
    queryKey: ['notifications', page, limit],
    queryFn: () => api.notifications.list(page, limit) as any
  })

  return {
    notifications: data?.notifications || [],
    meta: data?.meta,
    isLoading,
    error
  }
}
