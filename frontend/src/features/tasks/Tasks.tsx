'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, Calendar, Clock, BookOpen, Trash2, Edit, Check, X } from 'lucide-react'
import { useTasks, useSubjects } from '@/hooks/useApi'
import { getPriorityColor, getPriorityLabel, isOverdue, isDueSoon, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { TaskForm } from './TaskForm'
import { Task } from '@/types'

export function Tasks() {
  const { tasks, meta, isLoading, refetch, deleteTask, toggleComplete, isDeleting } = useTasks()
  const { subjects } = useSubjects()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sort, setSort] = useState<'deadline_asc' | 'deadline_desc' | 'priority_desc'>('deadline_asc')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const filteredTasks = tasks.filter((task: Task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (subjectFilter !== 'all' && task.subject_id !== parseInt(subjectFilter)) return false
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleDelete = async (id: number) => {
    if (confirm('Yakin ingin menghapus tugas ini?')) {
      await deleteTask(id)
    }
  }

  const handleComplete = async (id: number) => {
    await toggleComplete(id)
  }

  const openCreateDialog = () => {
    setEditingTask(null)
    setDialogOpen(true)
  }

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tugas</h1>
          <p className="text-muted-foreground">Kelola semua tugas kuliah Anda</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Tugas
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Tugas' : 'Tambah Tugas Baru'}</DialogTitle>
            </DialogHeader>
            <TaskForm
              initialData={editingTask || undefined}
              subjects={subjects}
              onClose={() => setDialogOpen(false)}
              onSuccess={() => {
                refetch()
                setEditingTask(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari tugas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(val: 'all' | 'pending' | 'completed') => setStatusFilter(val)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="pending">Belum Selesai</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Mata Kuliah" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mata Kuliah</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Prioritas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="high">Tinggi</SelectItem>
                <SelectItem value="medium">Sedang</SelectItem>
                <SelectItem value="low">Rendah</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(val: 'deadline_asc' | 'deadline_desc' | 'priority_desc') => setSort(val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deadline_asc">Deadline Terdekat</SelectItem>
                <SelectItem value="deadline_desc">Deadline Terjauh</SelectItem>
                <SelectItem value="priority_desc">Prioritas Tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="p-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="mb-4 h-20 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Tidak ada tugas</h3>
              <p className="text-muted-foreground">
                {search ? 'Coba ubah pencarian atau filter' : 'Mulai tambah tugas pertama Anda'}
              </p>
              {!search && (
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />Tambah Tugas
                </Button>
              )}
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 p-4">
                  {filteredTasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className={cn(
                        'flex items-center gap-4 p-3 rounded-lg border hover:bg-accent transition-colors',
                        task.status === 'completed' && 'opacity-60'
                      )}
                    >
                      <div className={cn('h-3 w-3 rounded-full flex-shrink-0', getPriorityColor(task.priority).replace('bg-', '').replace('text-', 'bg-'))} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">
                          {task.title}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                          {task.subject_name && (
                            <Badge variant="outline" className="gap-1 h-5 px-2">
                              <BookOpen className="h-3 w-3" />
                              {task.subject_name}
                            </Badge>
                          )}
                          <span className={cn('flex items-center gap-1', isOverdue(task.deadline_at, task.status) ? 'text-red-500 font-medium' : isDueSoon(task.deadline_at) ? 'text-orange-500' : '')}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.deadline_at), 'dd MMM yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(task.deadline_at), 'HH:mm')}
                          </span>
                          <Badge variant="outline" className={cn(getPriorityColor(task.priority), 'h-5 px-2')}>
                            {getPriorityLabel(task.priority)}
                          </Badge>
                          {task.status === 'completed' && (
                            <Badge variant="secondary" className="h-5 px-2 gap-1 text-green-600">
                              <Check className="h-3 w-3" />
                              Selesai
                            </Badge>
                          )}
                          {isOverdue(task.deadline_at, task.status) && (
                            <Badge variant="destructive" className="h-5 px-2 gap-1">
                              <X className="h-3 w-3" />
                              Terlambat
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(task)}
                          disabled={isDeleting}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleComplete(task.id)}
                          disabled={isDeleting}
                        >
                          {task.status === 'pending' ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-orange-500" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(task.id)}
                          disabled={isDeleting}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} tugas)
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
