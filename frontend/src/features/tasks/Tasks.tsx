'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Search,
  Calendar,
  BookOpen,
  Trash2,
  Edit,
  CheckCircle2,
  Circle,
  SlidersHorizontal,
  RotateCcw,
  AlertCircle,
  Clock
} from 'lucide-react'
import { useTasks, useSubjects } from '@/hooks/useApi'
import { getPriorityColor, getPriorityLabel, isOverdue, isDueSoon, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { TaskForm } from './TaskForm'
import { Task } from '@/types'

export function Tasks() {
  const { tasks, isLoading, refetch, deleteTask, toggleComplete, isDeleting } = useTasks()
  const { subjects } = useSubjects()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sort, setSort] = useState<'deadline_asc' | 'deadline_desc' | 'priority_desc'>('deadline_asc')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (search.trim()) count++
    if (statusFilter !== 'all') count++
    if (subjectFilter !== 'all') count++
    if (priorityFilter !== 'all') count++
    if (sort !== 'deadline_asc') count++
    return count
  }, [search, statusFilter, subjectFilter, priorityFilter, sort])

  // Count tasks by status for chip badges
  const stats = useMemo(() => {
    const total = tasks.length
    const pending = tasks.filter(t => t.status === 'pending').length
    const completed = tasks.filter(t => t.status === 'completed').length
    const high = tasks.filter(t => t.priority === 'high' && t.status === 'pending').length
    return { total, pending, completed, high }
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task: Task) => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (subjectFilter !== 'all' && task.subject_id !== parseInt(subjectFilter)) return false
        if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
        if (search.trim() && !task.title.toLowerCase().includes(search.toLowerCase().trim())) return false
        return true
      })
      .sort((a, b) => {
        if (sort === 'deadline_asc') {
          return new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
        }
        if (sort === 'deadline_desc') {
          return new Date(b.deadline_at).getTime() - new Date(a.deadline_at).getTime()
        }
        if (sort === 'priority_desc') {
          const priorityWeight = { high: 3, medium: 2, low: 1 }
          const pA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0
          const pB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0
          return pB - pA
        }
        return 0
      })
  }, [tasks, statusFilter, subjectFilter, priorityFilter, search, sort])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setSubjectFilter('all')
    setPriorityFilter('all')
    setSort('deadline_asc')
  }

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
    <div className="space-y-4">
      {/* Top Header & Action */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Daftar Tugas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Kelola deadline & jadwal tugas kuliah Anda</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="rounded-xl shadow-xs font-semibold px-4 py-2 gap-2 text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Tugas</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingTask ? 'Edit Tugas' : 'Tambah Tugas Baru'}
              </DialogTitle>
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

      {/* Horizontal Carousel / Scrollable Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border',
            statusFilter === 'all' && priorityFilter === 'all'
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Semua
          <span className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px]',
            statusFilter === 'all' && priorityFilter === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {stats.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('pending')
            setPriorityFilter('all')
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border',
            statusFilter === 'pending' && priorityFilter === 'all'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Belum Selesai
          <span className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px]',
            statusFilter === 'pending' && priorityFilter === 'all' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
          )}>
            {stats.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('completed')
            setPriorityFilter('all')
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border',
            statusFilter === 'completed'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Selesai
          <span className={cn(
            'px-1.5 py-0.2 rounded-full text-[10px]',
            statusFilter === 'completed' ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
          )}>
            {stats.completed}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setPriorityFilter(priorityFilter === 'high' ? 'all' : 'high')
            setStatusFilter('pending')
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border',
            priorityFilter === 'high'
              ? 'bg-red-600 text-white border-red-600 shadow-xs'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          Prioritas Tinggi ⚡
          {stats.high > 0 && (
            <span className={cn(
              'px-1.5 py-0.2 rounded-full text-[10px]',
              priorityFilter === 'high' ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'
            )}>
              {stats.high}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 whitespace-nowrap"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Task List Section */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-card rounded-2xl border border-border/60 animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Tidak ada tugas ditemukan</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
                {activeFilterCount > 0
                  ? 'Tidak ada tugas yang cocok dengan filter atau pencarian Anda. Coba reset filter.'
                  : 'Belum ada tugas kuliah yang dicatat. Tambahkan tugas pertama Anda sekarang.'}
              </p>
              {activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4 rounded-xl gap-2 text-xs">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Filter
                </Button>
              ) : (
                <Button onClick={openCreateDialog} size="sm" className="mt-4 rounded-xl gap-2 text-xs font-semibold">
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Tugas Baru
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map((task: Task) => {
              const overdue = isOverdue(task.deadline_at, task.status)
              const dueSoon = isDueSoon(task.deadline_at) && task.status === 'pending'
              const isDone = task.status === 'completed'

              return (
                <div
                  key={task.id}
                  className={cn(
                    'group relative flex items-start gap-3 p-3.5 rounded-2xl border bg-card transition-all duration-150 hover:shadow-sm',
                    isDone
                      ? 'border-border/50 bg-muted/20 opacity-70'
                      : overdue
                      ? 'border-red-300 dark:border-red-900/60 bg-red-50/20 dark:bg-red-950/10'
                      : dueSoon
                      ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-border/70 hover:border-border'
                  )}
                >
                  {/* Complete Checkbox Button */}
                  <button
                    type="button"
                    onClick={() => handleComplete(task.id)}
                    disabled={isDeleting}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-hidden"
                    title={isDone ? 'Tandai belum selesai' : 'Tandai selesai'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100 dark:fill-emerald-950" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/60 hover:text-primary" />
                    )}
                  </button>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm font-semibold leading-snug line-clamp-2 text-foreground',
                          isDone && 'line-through text-muted-foreground'
                        )}
                      >
                        {task.title}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </p>
                    )}

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {task.subject_name && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground whitespace-nowrap shrink-0">
                          <BookOpen className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {task.subject_name}
                        </span>
                      )}

                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap shrink-0',
                          isDone
                            ? 'bg-muted text-muted-foreground'
                            : overdue
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-bold'
                            : dueSoon
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                            : 'bg-muted/80 text-muted-foreground'
                        )}
                      >
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{format(new Date(task.deadline_at), 'dd MMM yyyy', { locale: localeId })}</span>
                        <span className="opacity-30">•</span>
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{format(new Date(task.deadline_at), 'HH:mm')} WIB</span>
                      </span>

                      {/* Priority Tag */}
                      <span className={cn(
                        'inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap shrink-0',
                        getPriorityColor(task.priority)
                      )}>
                        {getPriorityLabel(task.priority)}
                      </span>

                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 whitespace-nowrap shrink-0">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Terlewat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(task)}
                      disabled={isDeleting}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(task.id)}
                      disabled={isDeleting}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) at Bottom Right */}
      <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-30">
        <Button
          onClick={() => setFilterModalOpen(true)}
          className="rounded-full shadow-xl bg-slate-900 text-white dark:bg-primary dark:text-primary-foreground hover:bg-slate-800 dark:hover:bg-primary/90 px-4 py-3 flex items-center gap-2 text-xs font-bold transition-all transform active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Filter & Cari</span>
          {activeFilterCount > 0 && (
            <span className="ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter & Search Modal / Dialog */}
      <Dialog open={filterModalOpen} onOpenChange={setFilterModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-5">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Filter & Cari Tugas
              </DialogTitle>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs text-destructive hover:underline font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Search Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cari Judul Tugas</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ketik kata kunci tugas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 rounded-xl text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status Tugas</Label>
              <Select value={statusFilter} onValueChange={(val: 'all' | 'pending' | 'completed') => setStatusFilter(val)}>
                <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Belum Selesai</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mata Kuliah</Label>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                  <SelectValue placeholder="Pilih Mata Kuliah" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Semua Mata Kuliah</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prioritas</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                  <SelectValue placeholder="Pilih Prioritas" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">Semua Prioritas</SelectItem>
                  <SelectItem value="high">Tinggi</SelectItem>
                  <SelectItem value="medium">Sedang</SelectItem>
                  <SelectItem value="low">Rendah</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Urutkan Berdasarkan</Label>
              <Select value={sort} onValueChange={(val: 'deadline_asc' | 'deadline_desc' | 'priority_desc') => setSort(val)}>
                <SelectTrigger className="rounded-xl text-xs sm:text-sm">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="deadline_asc">Deadline Terdekat</SelectItem>
                  <SelectItem value="deadline_desc">Deadline Terjauh</SelectItem>
                  <SelectItem value="priority_desc">Prioritas Tertinggi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <Button
                onClick={() => setFilterModalOpen(false)}
                className="w-full rounded-xl font-semibold text-xs sm:text-sm py-2.5"
              >
                Tampilkan Hasil ({filteredTasks.length} Tugas)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
