'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useTasks } from '@/hooks/useApi'
import { Task } from '@/types'

const taskSchema = z.object({
  subjectId: z.number().nullable().optional(),
  title: z.string().min(1, 'Judul wajib diisi').max(200),
  description: z.string().max(2000).optional(),
  deadlineAt: z.string().min(1, 'Deadline wajib diisi'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  status: z.enum(['pending', 'completed']).default('pending'),
  reminderEnabled: z.boolean().optional().nullable(),
  reminderOffsetMinutes: z.number().optional().nullable()
})

type TaskFormData = z.infer<typeof taskSchema>

interface TaskFormProps {
  initialData?: Task
  subjects: { id: number; name: string }[]
  onClose: () => void
  onSuccess: () => void
}

export function TaskForm({ initialData, subjects, onClose, onSuccess }: TaskFormProps) {
  const { create, update, isCreating, isUpdating } = useTasks()
  const isEditing = !!initialData?.id

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      subjectId: initialData?.subject_id ?? null,
      title: initialData?.title ?? '',
      description: initialData?.description ?? '',
      deadlineAt: initialData?.deadline_at ? format(new Date(initialData.deadline_at), "yyyy-MM-dd'T'HH:mm") : '',
      priority: initialData?.priority ?? 'medium',
      status: initialData?.status ?? 'pending',
      reminderEnabled: initialData?.reminder_enabled ? Boolean(initialData.reminder_enabled) : null,
      reminderOffsetMinutes: initialData?.reminder_offset_minutes ?? null
    }
  })

  useEffect(() => {
    if (initialData?.deadline_at) {
      setValue('deadlineAt', format(new Date(initialData.deadline_at), "yyyy-MM-dd'T'HH:mm"))
    }
  }, [initialData, setValue])

  const onSubmit = async (data: TaskFormData) => {
    try {
      const submitData = {
        ...data,
        subjectId: data.subjectId || null,
        deadlineAt: new Date(data.deadlineAt).toISOString()
      }

      if (isEditing) {
        await update({ id: initialData!.id, data: submitData })
      } else {
        await create(submitData)
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
        <Label htmlFor="title">Judul Tugas *</Label>
        <Input
          id="title"
          placeholder="Contoh: Membuat halaman login"
          {...register('title')}
          disabled={isCreating || isUpdating}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="subjectId">Mata Kuliah</Label>
        <Select
          onValueChange={value => setValue('subjectId', value ? parseInt(value) : null)}
          defaultValue={initialData?.subject_id ? String(initialData.subject_id) : ''}
        >
          <SelectTrigger>
            <SelectValue placeholder="Pilih mata kuliah (opsional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tidak ada</SelectItem>
            {subjects.map(subject => (
              <SelectItem key={subject.id} value={String(subject.id)}>{subject.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi</Label>
        <Textarea
          id="description"
          placeholder="Deskripsi tugas (opsional)"
          rows={3}
          {...register('description')}
          disabled={isCreating || isUpdating}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadlineAt">Deadline *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-full justify-start text-left font-normal', errors.deadlineAt && 'border-destructive')}
              type="button"
            >
              <Calendar className="mr-2 h-4 w-4" />
              {watch('deadlineAt') ? format(parseISO(watch('deadlineAt')), 'dd MMM yyyy, HH:mm') : 'Pilih tanggal dan waktu'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-4 space-y-4 w-[280px]">
              <div>
                <Label htmlFor="deadlineDate">Tanggal</Label>
                <Input
                  id="deadlineDate"
                  type="date"
                  onChange={e => {
                    const time = watch('deadlineAt') ? parseISO(watch('deadlineAt')).toTimeString().slice(0, 5) : '23:59'
                    setValue('deadlineAt', `${e.target.value}T${time}`)
                  }}
                  defaultValue={watch('deadlineAt') ? format(parseISO(watch('deadlineAt')), 'yyyy-MM-dd') : ''}
                />
              </div>
              <div>
                <Label htmlFor="deadlineTime">Waktu</Label>
                <Input
                  id="deadlineTime"
                  type="time"
                  onChange={e => {
                    const date = watch('deadlineAt') ? format(parseISO(watch('deadlineAt')), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                    setValue('deadlineAt', `${date}T${e.target.value}`)
                  }}
                  defaultValue={watch('deadlineAt') ? format(parseISO(watch('deadlineAt')), 'HH:mm') : '23:59'}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {errors.deadlineAt && <p className="text-sm text-destructive">{errors.deadlineAt.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priority">Prioritas</Label>
          <Select
            onValueChange={value => setValue('priority', value as 'low' | 'medium' | 'high')}
            defaultValue={initialData?.priority ?? 'medium'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Prioritas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Rendah</SelectItem>
              <SelectItem value="medium">Sedang</SelectItem>
              <SelectItem value="high">Tinggi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            onValueChange={value => setValue('status', value as 'pending' | 'completed')}
            defaultValue={initialData?.status ?? 'pending'}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Belum Selesai</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="reminderEnabled">Pengaturan Pengingat</Label>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Aktifkan pengingat WhatsApp</p>
            <p className="text-sm text-muted-foreground">Kirim notifikasi ke WhatsApp sebelum deadline</p>
          </div>
          <Switch
            id="reminderEnabled"
            checked={watch('reminderEnabled') ?? true}
            onCheckedChange={checked => setValue('reminderEnabled', checked)}
            disabled={isCreating || isUpdating}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reminderOffsetMinutes">Kirim pengingat sebelum deadline</Label>
          <Select
            onValueChange={value => setValue('reminderOffsetMinutes', value ? parseInt(value) : null)}
            defaultValue={watch('reminderOffsetMinutes') ? String(watch('reminderOffsetMinutes')) : ''}
            disabled={isCreating || isUpdating}
          >
            <SelectTrigger>
              <SelectValue placeholder="Gunakan default (H-2)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Default (H-2)</SelectItem>
              <SelectItem value="30">30 menit</SelectItem>
              <SelectItem value="60">1 jam</SelectItem>
              <SelectItem value="180">3 jam</SelectItem>
              <SelectItem value="360">6 jam</SelectItem>
              <SelectItem value="720">12 jam</SelectItem>
              <SelectItem value="1440">1 hari (H-1)</SelectItem>
              <SelectItem value="2880">2 hari (H-2)</SelectItem>
              <SelectItem value="4320">3 hari (H-3)</SelectItem>
              <SelectItem value="10080">1 minggu (H-7)</SelectItem>
            </SelectContent>
          </Select>
        </div>
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