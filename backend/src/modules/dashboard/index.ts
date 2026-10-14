import { Request, Response } from '../../http'
import { tasksRepository } from '../../db/repositories/tasks'

export async function getDashboardSummary(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const stats = tasksRepository.getDashboardStats(user.id)
  
  res.json({ success: true, data: stats })
}

export async function getUpcomingTasks(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const limit = parseInt(req.query.limit as string || '10', 10)
  const tasks = tasksRepository.getUpcoming(user.id, limit)
  
  res.json({ success: true, data: tasks })
}

export async function getOverdueTasks(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const tasks = tasksRepository.getOverdue(user.id)
  
  res.json({ success: true, data: tasks })
}

export async function getDueSoonTasks(req: Request, res: Response): Promise<void> {
  const user = req.user!
  const hours = parseInt(req.query.hours as string || '24', 10)
  const tasks = tasksRepository.getDueSoon(user.id, hours)
  
  res.json({ success: true, data: tasks })
}