import { Request, Response } from '../../http'
import { subjectsRepository, type CreateSubjectInput, type UpdateSubjectInput } from '../../db/repositories/subjects'
import { tasksRepository } from '../../db/repositories/tasks'
import { subjectSchema } from '../../lib/validation'

export async function listSubjects(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const subjects = subjectsRepository.findByUserId(user.id)
  res.json({ success: true, data: subjects })
}

export async function createSubject(req: Request, res: Response): Promise<void> {
  const parseResult = subjectSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const subject = subjectsRepository.create({ userId: user.id, ...parseResult.data })
  res.status(201).json({ success: true, data: subject })
}

export async function getSubject(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  const subject = subjectsRepository.findById(id, user.id)
  
  if (!subject) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mata kuliah tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: subject })
}

export async function updateSubject(req: Request, res: Response): Promise<void> {
  const parseResult = subjectSchema.partial().safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Data tidak valid', details: parseResult.error.flatten() } })
    return
  }

  const user = req.user!
  const id = parseInt(req.params.id, 10)
  const subject = subjectsRepository.update(id, user.id, parseResult.data)
  
  if (!subject) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mata kuliah tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: subject })
}

export async function deleteSubject(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const id = parseInt(req.params.id, 10)
  
  const subject = subjectsRepository.findById(id, user.id)
  if (!subject) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mata kuliah tidak ditemukan' } })
    return
  }

  const hasTasks = subjectsRepository.hasTasks(id)
  if (hasTasks) {
    res.status(400).json({ success: false, error: { code: 'HAS_TASKS', message: 'Mata kuliah masih memiliki tugas. Pindahkan atau hapus tugas terlebih dahulu.' } })
    return
  }

  const deleted = subjectsRepository.delete(id, user.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Mata kuliah tidak ditemukan' } })
    return
  }
  
  res.json({ success: true, data: { message: 'Mata kuliah berhasil dihapus' } })
}