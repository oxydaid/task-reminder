'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, BookOpen, GraduationCap, User } from 'lucide-react'
import { useSubjects } from '@/hooks/useApi'
import { SubjectForm } from './SubjectForm'

export function Subjects() {
  const { subjects, isLoading, deleteSubject, isDeleting, isUpdating } = useSubjects()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<typeof subjects[0] | null>(null)

  const handleDelete = async (id: number) => {
    if (confirm('Yakin ingin menghapus mata kuliah ini? Tugas terkait akan kehilangan asosiasi mata kuliah.')) {
      await deleteSubject(id)
    }
  }

  const openCreateDialog = () => {
    setEditingSubject(null)
    setDialogOpen(true)
  }

  const openEditDialog = (subject: typeof subjects[0]) => {
    setEditingSubject(subject)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Mata Kuliah</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Kelola daftar mata kuliah dan dosen pengampu</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreateDialog}
              className="rounded-xl shadow-xs font-semibold px-4 py-2 gap-2 text-xs sm:text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Matkul</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingSubject ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}
              </DialogTitle>
            </DialogHeader>
            <SubjectForm
              initialData={editingSubject || undefined}
              onClose={() => setDialogOpen(false)}
              onSuccess={() => {
                setEditingSubject(null)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid List */}
      <div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-card rounded-2xl border border-border/60 animate-pulse" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-14 px-4 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/80 flex items-center justify-center text-muted-foreground mb-3">
                <BookOpen className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Belum ada mata kuliah</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
                Tambahkan mata kuliah Anda untuk mengelompokkan tugas kuliah dengan rapi.
              </p>
              <Button onClick={openCreateDialog} size="sm" className="mt-4 rounded-xl gap-2 text-xs font-semibold">
                <Plus className="h-3.5 w-3.5" />
                Tambah Mata Kuliah
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subjects.map(subject => (
              <div
                key={subject.id}
                className="group relative p-4 rounded-2xl border border-border/70 bg-card hover:shadow-xs transition-all flex flex-col justify-between"
                style={{ borderLeftWidth: '4px', borderLeftColor: subject.color || '#3b82f6' }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-1">{subject.name}</h3>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(subject)}
                        disabled={isUpdating}
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(subject.id)}
                        disabled={isDeleting}
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 space-y-1">
                    {subject.code && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Kode: <strong className="text-foreground font-medium">{subject.code}</strong></span>
                      </p>
                    )}
                    {subject.lecturer && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Dosen: {subject.lecturer}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
