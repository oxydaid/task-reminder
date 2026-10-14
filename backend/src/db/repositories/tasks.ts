import { db } from '../index'

export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'completed'

export interface Task {
  id: number
  user_id: number
  subject_id: number | null
  title: string
  description: string | null
  deadline_at: string
  priority: TaskPriority
  status: TaskStatus
  reminder_enabled: number | null
  reminder_offset_minutes: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithSubject extends Task {
  subject_name: string | null
  subject_color: string | null
}

export interface CreateTaskInput {
  userId: number
  subjectId: number | null
  title: string
  description?: string | null
  deadlineAt: string
  priority?: TaskPriority
  status?: TaskStatus
  reminderEnabled?: boolean | null
  reminderOffsetMinutes?: number | null
}

export interface UpdateTaskInput {
  subjectId?: number | null
  title?: string
  description?: string | null
  deadlineAt?: string
  priority?: TaskPriority
  status?: TaskStatus
  reminderEnabled?: boolean | null
  reminderOffsetMinutes?: number | null
}

export interface TaskFilters {
  status?: TaskStatus
  subjectId?: number
  priority?: TaskPriority
  from?: string
  to?: string
  sort?: 'deadline_asc' | 'deadline_desc' | 'created_desc' | 'priority_desc'
  page?: number
  limit?: number
}

export const tasksRepository = {
  create(input: CreateTaskInput): Task {
    const stmt = db.prepare(`
      INSERT INTO tasks (user_id, subject_id, title, description, deadline_at, priority, status, reminder_enabled, reminder_offset_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `)
    return stmt.get(
      input.userId,
      input.subjectId,
      input.title,
      input.description ?? null,
      input.deadlineAt,
      input.priority ?? 'medium',
      input.status ?? 'pending',
      input.reminderEnabled !== undefined ? (input.reminderEnabled ? 1 : 0) : null,
      input.reminderOffsetMinutes ?? null
    ) as unknown as Task
  },

  findById(id: number, userId: number): Task | null {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, userId)
    return (row as unknown as Task) ?? null
  },

  findByIdWithSubject(id: number, userId: number): TaskWithSubject | null {
    const row = db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(id, userId)
    return (row as unknown as TaskWithSubject) ?? null
  },

  findByUserId(userId: number, filters: TaskFilters = {}): { tasks: TaskWithSubject[]; total: number } {
    const conditions: string[] = ['t.user_id = ?']
    const values: (string | number)[] = [userId]

    if (filters.status) {
      conditions.push('t.status = ?')
      values.push(filters.status)
    }
    if (filters.subjectId) {
      conditions.push('t.subject_id = ?')
      values.push(filters.subjectId)
    }
    if (filters.priority) {
      conditions.push('t.priority = ?')
      values.push(filters.priority)
    }
    if (filters.from) {
      conditions.push('t.deadline_at >= ?')
      values.push(filters.from)
    }
    if (filters.to) {
      conditions.push('t.deadline_at <= ?')
      values.push(filters.to)
    }

    const whereClause = conditions.join(' AND ')

    let orderBy = 't.deadline_at ASC'
    switch (filters.sort) {
      case 'deadline_desc':
        orderBy = 't.deadline_at DESC'
        break
      case 'created_desc':
        orderBy = 't.created_at DESC'
        break
      case 'priority_desc':
        orderBy = "CASE t.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC, t.deadline_at ASC"
        break
    }

    const page = filters.page ?? 1
    const limit = filters.limit ?? 50
    const offset = (page - 1) * limit

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM tasks t WHERE ${whereClause}`)
    const countRow = countStmt.get(...(values as any)) as { total: number | bigint } | undefined
    const total = Number(countRow?.total ?? 0)

    const dataStmt = db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `)
    const tasks = dataStmt.all(...(values as any), limit, offset) as unknown as TaskWithSubject[]

    return { tasks, total }
  },

  getUpcoming(userId: number, limit = 10): TaskWithSubject[] {
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.user_id = ? AND t.status = 'pending' AND t.deadline_at >= datetime('now')
      ORDER BY t.deadline_at ASC
      LIMIT ?
    `).all(userId, limit) as unknown as TaskWithSubject[]
  },

  getOverdue(userId: number): TaskWithSubject[] {
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.user_id = ? AND t.status = 'pending' AND t.deadline_at < datetime('now')
      ORDER BY t.deadline_at ASC
    `).all(userId) as unknown as TaskWithSubject[]
  },

  getDueSoon(userId: number, hours = 24): TaskWithSubject[] {
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE t.user_id = ? AND t.status = 'pending' 
        AND t.deadline_at >= datetime('now') 
        AND t.deadline_at <= datetime('now', '+' || ? || ' hours')
      ORDER BY t.deadline_at ASC
    `).all(userId, hours) as unknown as TaskWithSubject[]
  },

  getDashboardStats(userId: number): {
    total: number
    pending: number
    completed: number
    overdue: number
    dueSoon: number
  } {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' AND deadline_at < datetime('now') THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN status = 'pending' AND deadline_at >= datetime('now') AND deadline_at <= datetime('now', '+24 hours') THEN 1 ELSE 0 END) as dueSoon
      FROM tasks WHERE user_id = ?
    `).get(userId) as Record<string, number | bigint | null> | undefined

    return {
      total: Number(stats?.total ?? 0),
      pending: Number(stats?.pending ?? 0),
      completed: Number(stats?.completed ?? 0),
      overdue: Number(stats?.overdue ?? 0),
      dueSoon: Number(stats?.dueSoon ?? 0)
    }
  },

  update(id: number, userId: number, input: UpdateTaskInput): Task | null {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (input.subjectId !== undefined) {
      fields.push('subject_id = ?')
      values.push(input.subjectId)
    }
    if (input.title !== undefined) {
      fields.push('title = ?')
      values.push(input.title)
    }
    if (input.description !== undefined) {
      fields.push('description = ?')
      values.push(input.description)
    }
    if (input.deadlineAt !== undefined) {
      fields.push('deadline_at = ?')
      values.push(input.deadlineAt)
    }
    if (input.priority !== undefined) {
      fields.push('priority = ?')
      values.push(input.priority)
    }
    if (input.status !== undefined) {
      fields.push('status = ?')
      values.push(input.status)
      if (input.status === 'completed') {
        fields.push("completed_at = datetime('now')")
      } else {
        fields.push('completed_at = NULL')
      }
    }
    if (input.reminderEnabled !== undefined) {
      fields.push('reminder_enabled = ?')
      values.push(input.reminderEnabled ? 1 : 0)
    }
    if (input.reminderOffsetMinutes !== undefined) {
      fields.push('reminder_offset_minutes = ?')
      values.push(input.reminderOffsetMinutes)
    }

    if (fields.length === 0) return this.findById(id, userId)

    fields.push("updated_at = datetime('now')")
    values.push(id, userId)

    const stmt = db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`)
    const row = stmt.get(...(values as any))
    return (row as unknown as Task) ?? null
  },

  complete(id: number, userId: number): Task | null {
    const stmt = db.prepare(`
      UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND user_id = ? RETURNING *
    `)
    const row = stmt.get(id, userId)
    return (row as unknown as Task) ?? null
  },

  uncomplete(id: number, userId: number): Task | null {
    const stmt = db.prepare(`
      UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = datetime('now')
      WHERE id = ? AND user_id = ? RETURNING *
    `)
    const row = stmt.get(id, userId)
    return (row as unknown as Task) ?? null
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId)
    return Number(result.changes) > 0
  },

  findForReminderCheck(): (TaskWithSubject & { whatsapp_number: string; timezone: string; reminder_enabled: number; default_reminder_offset_minutes: number })[] {
    return db.prepare(`
      SELECT t.*, s.name as subject_name, s.color as subject_color, u.whatsapp_number, u.timezone, u.reminder_enabled, u.default_reminder_offset_minutes
      FROM tasks t
      LEFT JOIN subjects s ON t.subject_id = s.id
      JOIN users u ON t.user_id = u.id
      WHERE t.status = 'pending' 
        AND u.whatsapp_verified_at IS NOT NULL
        AND u.reminder_enabled = 1
        AND (t.reminder_enabled IS NULL OR t.reminder_enabled = 1)
    `).all() as unknown as (TaskWithSubject & { whatsapp_number: string; timezone: string; reminder_enabled: number; default_reminder_offset_minutes: number })[]
  },

  countByUserId(userId: number): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(userId) as { count: number | bigint } | undefined
    return Number(row?.count ?? 0)
  }
}