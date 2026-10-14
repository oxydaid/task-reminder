'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  ArrowRight
} from 'lucide-react'
import { useDashboard, useTasks } from '@/hooks/useApi'
import { formatRelativeTime, getPriorityColor, getPriorityLabel, isOverdue, isDueSoon, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Task } from '@/types'

export function Dashboard() {
  const { summary, isLoading } = useDashboard()
  const { tasks: allTasks } = useTasks({ status: 'pending', limit: '10', sort: 'deadline_asc' })
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'overdue' | 'due-soon'>('all')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-7 bg-muted animate-pulse rounded-xl w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-card rounded-2xl border border-border/60 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-card rounded-2xl border border-border/60 animate-pulse" />
      </div>
    )
  }

  const stats = [
    {
      label: 'Total Tugas',
      value: summary?.total || 0,
      icon: BookOpen,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    },
    {
      label: 'Belum Selesai',
      value: summary?.pending || 0,
      icon: Clock,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    },
    {
      label: 'Terlambat',
      value: summary?.overdue || 0,
      icon: AlertTriangle,
      iconBg: 'bg-red-500/10 text-red-600 dark:text-red-400'
    },
    {
      label: 'Mendekati H-1',
      value: summary?.dueSoon || 0,
      icon: TrendingUp,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
    }
  ]

  const filteredTasks = allTasks.filter((task: Task) => {
    if (activeTab === 'overdue') return isOverdue(task.deadline_at, task.status)
    if (activeTab === 'due-soon') return isDueSoon(task.deadline_at) && !isOverdue(task.deadline_at, task.status)
    if (activeTab === 'upcoming') return !isOverdue(task.deadline_at, task.status) && !isDueSoon(task.deadline_at)
    return true
  })

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Ringkasan Kuliah
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Pantau progres dan jadwal deadline tugas Anda</p>
        </div>
        <Link to="/tasks" className="shrink-0">
          <Button className="rounded-xl shadow-xs font-semibold px-4 py-2 gap-2 text-xs sm:text-sm w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            <span>Tambah Tugas</span>
          </Button>
        </Link>
      </div>

      {/* Modern Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-2xl border border-border/70 shadow-xs hover:border-border transition-all">
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5 text-foreground">{stat.value}</p>
              </div>
              <div className={cn('p-2.5 sm:p-3 rounded-xl flex items-center justify-center', stat.iconBg)}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task List Section */}
      <Card className="rounded-2xl border border-border/70 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'Semua Prioritas' },
                { id: 'due-soon', label: 'Segera', count: summary?.dueSoon },
                { id: 'overdue', label: 'Terlambat', count: summary?.overdue },
                { id: 'upcoming', label: 'Mendatang' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={cn(
                      'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : tab.id === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <Link
              to="/tasks"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              Lihat Semua
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 pt-3">
          <ScrollArea className="max-h-[460px]">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-10 w-10 rounded-xl bg-muted/70 flex items-center justify-center text-muted-foreground mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {activeTab === 'overdue'
                    ? 'Hebat! Tidak ada tugas terlambat 🎉'
                    : activeTab === 'due-soon'
                    ? 'Tidak ada tugas yang mendesak'
                    : 'Tidak ada tugas di kategori ini'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Semua tugas Anda aman terkendali
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTasks.map((task: Task) => {
                  const overdue = isOverdue(task.deadline_at, task.status)
                  const dueSoon = isDueSoon(task.deadline_at) && task.status === 'pending'

                  return (
                    <Link
                      key={task.id}
                      to="/tasks"
                      className={cn(
                        'group flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border bg-card transition-all hover:shadow-xs',
                        overdue
                          ? 'border-red-200 dark:border-red-950 bg-red-50/20'
                          : dueSoon
                          ? 'border-amber-200 dark:border-amber-950 bg-amber-50/20'
                          : 'border-border/60 hover:border-border'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {task.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                          {task.subject_name && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium shrink-0 whitespace-nowrap">
                              <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                              {task.subject_name}
                            </span>
                          )}
                          <span className={cn(
                            'inline-flex items-center gap-1 font-medium shrink-0 whitespace-nowrap',
                            overdue ? 'text-red-600 font-bold' : dueSoon ? 'text-amber-600 font-semibold' : ''
                          )}>
                            <Clock className="h-3 w-3 shrink-0" />
                            {formatRelativeTime(task.deadline_at)} • {format(new Date(task.deadline_at), 'HH:mm')} WIB
                          </span>
                          <span className={cn('px-1.5 py-0.2 rounded text-[10px] uppercase font-bold shrink-0 whitespace-nowrap', getPriorityColor(task.priority))}>
                            {getPriorityLabel(task.priority)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {overdue ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : dueSoon ? (
                          <TrendingUp className="h-4 w-4 text-amber-500" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
