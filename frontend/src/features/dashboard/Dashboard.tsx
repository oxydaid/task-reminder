'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, AlertTriangle, Clock, CheckCircle2, BookOpen, TrendingUp } from 'lucide-react'
import { useDashboard, useTasks } from '@/hooks/useApi'
import { formatRelativeTime, getPriorityColor, getPriorityLabel, isOverdue, isDueSoon, cn } from '@/lib/utils'
import { Task } from '@/types'

export function Dashboard() {
  const { summary, isLoading } = useDashboard()
  const { tasks: allTasks } = useTasks({ status: 'pending', limit: '5', sort: 'deadline_asc' })
  const [activeTab, setActiveTab] = useState<'all' | 'upcoming' | 'overdue' | 'due-soon'>('all')

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  const stats = [
    { label: 'Total Tugas', value: summary?.total || 0, icon: BookOpen, color: 'text-blue-500' },
    { label: 'Belum Selesai', value: summary?.pending || 0, icon: Clock, color: 'text-yellow-500' },
    { label: 'Terlambat', value: summary?.overdue || 0, icon: AlertTriangle, color: 'text-red-500' },
    { label: 'Segera', value: summary?.dueSoon || 0, icon: TrendingUp, color: 'text-orange-500' }
  ]

  const filteredTasks = allTasks.filter((task: Task) => {
    if (activeTab === 'overdue') return isOverdue(task.deadline_at, task.status)
    if (activeTab === 'due-soon') return isDueSoon(task.deadline_at) && !isOverdue(task.deadline_at, task.status)
    if (activeTab === 'upcoming') return !isOverdue(task.deadline_at, task.status) && !isDueSoon(task.deadline_at)
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Ringkasan tugas dan deadline Anda</p>
        </div>
        <Link to="/tasks" className="w-full sm:w-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Tugas
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={cn('p-3 rounded-full', stat.color + '/10')}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tasks Tabs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'upcoming', label: 'Mendatang' },
              { id: 'due-soon', label: 'Segera' },
              { id: 'overdue', label: 'Terlambat', count: summary?.overdue }
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="gap-1"
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge variant="destructive" className="ml-1">{tab.count}</Badge>
                )}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">Tidak ada tugas</h3>
                <p className="text-muted-foreground">
                  {activeTab === 'overdue' ? 'Tidak ada tugas yang terlambat 🎉' :
                   activeTab === 'due-soon' ? 'Tidak ada tugas yang mendekati deadline' :
                   activeTab === 'upcoming' ? 'Tidak ada tugas mendatang' :
                   'Mulai tambah tugas pertama Anda'}
                </p>
                {activeTab === 'all' && (
                  <Button asChild className="mt-4">
                    <Link to="/tasks"><Plus className="mr-2 h-4 w-4" />Tambah Tugas</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task: Task) => (
                  <Link
                    key={task.id}
                    to={`/tasks`}
                    className="group flex items-center gap-4 p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className={cn('h-2 w-2 rounded-full flex-shrink-0', getPriorityColor(task.priority).replace('bg-', '').replace('text-', 'bg-'))} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:underline">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {task.subject_name && (
                          <Badge variant="outline" className="gap-1 h-5 px-2">
                            <BookOpen className="h-3 w-3" />
                            {task.subject_name}
                          </Badge>
                        )}
                        <span className={cn('flex items-center gap-1', isOverdue(task.deadline_at, task.status) ? 'text-red-500' : isDueSoon(task.deadline_at) ? 'text-orange-500' : '')}>
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(task.deadline_at)}
                        </span>
                        <Badge variant="outline" className={cn(getPriorityColor(task.priority), 'h-5 px-2')}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                      </div>
                    </div>
                    {task.status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {isOverdue(task.deadline_at, task.status) && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
