'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSubjects } from '@/hooks/useApi'
import { Subject } from '@/types'

const subjectSchema = z.object({
  name: z.string().min(1, 'Nama mata kuliah wajib diisi').max(100),
  code: z.string().max(20).optional(),
  lecturer: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Format warna tidak valid (hex)').optional()
})

type SubjectFormData = z.infer<typeof subjectSchema>

interface SubjectFormProps {
  initialData?: Subject
  onClose: () => void
  onSuccess: () => void
}

export function SubjectForm({ initialData, onClose, onSuccess }: SubjectFormProps) {
  const { create, update, isCreating, isUpdating } = useSubjects()
  const isEditing = !!initialData?.id

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      code: initialData?.code ?? '',
      lecturer: initialData?.lecturer ?? '',
      color: initialData?.color ?? '#3b82f6'
    }
  })

  const onSubmit = async (data: SubjectFormData) => {
    try {
      if (isEditing) {
        await update({ id: initialData!.id, data })
      } else {
        await create(data)
      }
      onSuccess()
      onClose()
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama Mata Kuliah *</Label>
        <Input
          id="name"
          placeholder="Contoh: Pemrograman Web"
          {...register('name')}
          disabled={isCreating || isUpdating}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Kode Mata Kuliah</Label>
        <Input
          id="code"
          placeholder="Contoh: IF1234"
          {...register('code')}
          disabled={isCreating || isUpdating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lecturer">Dosen</Label>
        <Input
          id="lecturer"
          placeholder="Contoh: Dr. Ahmad"
          {...register('lecturer')}
          disabled={isCreating || isUpdating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Warna</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color"
            type="color"
            {...register('color')}
            disabled={isCreating || isUpdating}
            className="h-10 w-10 rounded-lg border cursor-pointer p-0"
          />
          <Input
            type="text"
            placeholder="#3b82f6"
            {...register('color')}
            disabled={isCreating || isUpdating}
            className="flex-1 font-mono text-sm"
          />
        </div>
        {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
      </div>

      <div className="flex gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} disabled={isCreating || isUpdating}>
          Batal
        </Button>
        <Button type="submit" className="ml-auto" disabled={isCreating || isUpdating}>
          {isCreating || isUpdating ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
        </Button>
      </div>
    </form>
  )
}