import { Request, Response } from '../../http'
import { tasksRepository, type TaskFilters } from '../../db/repositories/tasks'
import { subjectsRepository } from '../../db/repositories/subjects'
import { taskSchema, taskUpdateSchema, taskFiltersSchema } from '../../lib/validation'
import { rescheduleTaskReminders, cancelTaskReminders } from '../notifications'

export async function listTasks(req: Request, res: Response): Promise<void> {
  const parseResult = taskFiltersSchema.safeParse(req.query)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Query tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const { tasks, total } = tasksRepository.findByUserId(user.id, parseResult.data)
  
  res.json({
    success: true,
    data: {
      tasks,
      total,
      page: parseResult.data.page,
      limit: parseResult.data.limit,
      totalPages: Math.ceil(total / parseResult.data.limit)
    },
    meta: {
      total,
      page: parseResult.data.page,
      limit: parseResult.data.limit,
      totalPages: Math.ceil(total / parseResult.data.limit)
    }
  })
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const parseResult = taskSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const input = parseResult.data

  if (input.subjectId) {
    const subject = subjectsRepository.findById(input.subjectId, user.id)
    if (!subject) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SUBJECT', message: 'Mata kuliah tidak valid' } })
      return
    }
  }

  const task = tasksRepository.create({
    userId: user.id,
    subjectId: input.subjectId ?? null,
    title: input.title,
    description: input.description,
    deadlineAt: input.deadlineAt,
    priority: input.priority,
    status: input.status,
    reminderEnabled: input.reminderEnabled,
    reminderOffsetMinutes: input.reminderOffsetMinutes
  })
  const taskWithSubject = tasksRepository.findByIdWithSubject(task.id, user.id)

  if (taskWithSubject) {
    const dbUser = { id: user.id, timezone: 'Asia/Jakarta', reminder_enabled: 1, default_reminder_offset_minutes: 2880 }
    await rescheduleTaskReminders(taskWithSubject, dbUser)
  }

  res.status(201).json({ success: true, data: taskWithSubject })
}

export async function getTask(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  const task = tasksRepository.findByIdWithSubject(id, user.id)
  
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: task })
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const parseResult = taskUpdateSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const id = parseInt(req.params.id, 10)
  const input = parseResult.data

  if (input.subjectId !== undefined && input.subjectId !== null) {
    const subject = subjectsRepository.findById(input.subjectId, user.id)
    if (!subject) {
      res.status(400).json({ success: false, error: { code: 'INVALID_SUBJECT', message: 'Mata kuliah tidak valid' } })
      return
    }
  }

  const existingTask = tasksRepository.findById(id, user.id)
  if (!existingTask) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }

  const task = tasksRepository.update(id, user.id, input)
  
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }

  const taskWithSubject = tasksRepository.findByIdWithSubject(id, user.id)
  if (taskWithSubject) {
    const dbUser = { id: user.id, timezone: 'Asia/Jakarta', reminder_enabled: 1, default_reminder_offset_minutes: 2880 }
    await rescheduleTaskReminders(taskWithSubject, dbUser)
  }

  res.json({ success: true, data: taskWithSubject })
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  
  const task = tasksRepository.findById(id, user.id)
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }

  await cancelTaskReminders(id)
  const deleted = tasksRepository.delete(id, user.id)
  
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: { message: 'Tugas berhasil dihapus' } })
}

export async function completeTask(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  
  const task = tasksRepository.findById(id, user.id)
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }

  if (task.status === 'completed') {
    res.status(400).json({ success: false, error: { code: 'ALREADY_COMPLETED', message: 'Tugas sudah selesai' } })
    return
  }

  const updatedTask = tasksRepository.complete(id, user.id)
  await cancelTaskReminders(id)
  
  const taskWithSubject = tasksRepository.findByIdWithSubject(id, user.id)
  res.json({ success: true, data: taskWithSubject })
}

export async function uncompleteTask(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  
  const task = tasksRepository.findById(id, user.id)
  if (!task) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tugas tidak ditemukan' } })
    return
  }

  if (task.status === 'pending') {
    res.status(400).json({ success: false, error: { code: 'ALREADY_PENDING', message: 'Tugas sudah berstatus pending' } })
    return
  }

  const updatedTask = tasksRepository.uncomplete(id, user.id)
  
  const taskWithSubject = tasksRepository.findByIdWithSubject(id, user.id)
  if (taskWithSubject) {
    const dbUser = { id: user.id, timezone: 'Asia/Jakarta', reminder_enabled: 1, default_reminder_offset_minutes: 2880 }
    await rescheduleTaskReminders(taskWithSubject, dbUser)
  }
  
  res.json({ success: true, data: taskWithSubject })
}