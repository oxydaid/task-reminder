'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Palette } from 'lucide-react'
import { useSubjects } from '@/hooks/useApi'
import { SubjectForm } from './SubjectForm'

export function Subjects() {
  const { subjects, isLoading, deleteSubject, isDeleting, isUpdating } = useSubjects()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<typeof subjects[0] | null>(null)

  const handleDelete = async (id: number) => {
    if (confirm('Yakin ingin menghapus mata kuliah ini? Tugas yang terkait akan kehilangan mata kuliah.')) {
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mata Kuliah</h1>
          <p className="text-muted-foreground">Kelola mata kuliah Anda</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Mata Kuliah
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSubject ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah Baru'}</DialogTitle>
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

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Palette className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Belum ada mata kuliah</h3>
              <p className="text-muted-foreground">Tambah mata kuliah pertama Anda untuk memulai</p>
              <Button asChild className="mt-4">
                <span onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Mata Kuliah
                </span>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {subjects.map(subject => (
                <div
                  key={subject.id}
                  className="relative p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  style={{ borderLeft: `4px solid ${subject.color || '#3b82f6'}` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-semibold truncate">{subject.name}</h3>
                      {subject.code && (
                        <p className="text-sm text-muted-foreground">Kode: {subject.code}</p>
                      )}
                      {subject.lecturer && (
                        <p className="text-sm text-muted-foreground">Dosen: {subject.lecturer}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(subject)}
                        disabled={isUpdating}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(subject.id)}
                        disabled={isDeleting}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}