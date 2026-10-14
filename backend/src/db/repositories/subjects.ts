import { db } from '../index'

export interface Subject {
  id: number
  user_id: number
  name: string
  code: string | null
  lecturer: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface CreateSubjectInput {
  userId: number
  name: string
  code?: string
  lecturer?: string
  color?: string
}

export interface UpdateSubjectInput {
  name?: string
  code?: string | null
  lecturer?: string | null
  color?: string | null
}

export const subjectsRepository = {
  create(input: CreateSubjectInput): Subject {
    const stmt = db.prepare(`
      INSERT INTO subjects (user_id, name, code, lecturer, color)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `)
    return stmt.get(input.userId, input.name, input.code ?? null, input.lecturer ?? null, input.color ?? null) as unknown as Subject
  },

  findById(id: number, userId: number): Subject | null {
    const row = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(id, userId)
    return (row as unknown as Subject) ?? null
  },

  findByIdUnsafe(id: number): Subject | null {
    const row = db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)
    return (row as unknown as Subject) ?? null
  },

  findByUserId(userId: number): Subject[] {
    return db.prepare('SELECT * FROM subjects WHERE user_id = ? ORDER BY name ASC').all(userId) as unknown as Subject[]
  },

  update(id: number, userId: number, input: UpdateSubjectInput): Subject | null {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (input.name !== undefined) {
      fields.push('name = ?')
      values.push(input.name)
    }
    if (input.code !== undefined) {
      fields.push('code = ?')
      values.push(input.code)
    }
    if (input.lecturer !== undefined) {
      fields.push('lecturer = ?')
      values.push(input.lecturer)
    }
    if (input.color !== undefined) {
      fields.push('color = ?')
      values.push(input.color)
    }

    if (fields.length === 0) return this.findById(id, userId)

    fields.push("updated_at = datetime('now')")
    values.push(id, userId)

    const stmt = db.prepare(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`)
    const row = stmt.get(...(values as any))
    return (row as unknown as Subject) ?? null
  },

  delete(id: number, userId: number): boolean {
    const result = db.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(id, userId)
    return Number(result.changes) > 0
  },

  hasTasks(subjectId: number): boolean {
    const row = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE subject_id = ?').get(subjectId) as { count: number | bigint } | undefined
    return Number(row?.count ?? 0) > 0
  },

  countByUserId(userId: number): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM subjects WHERE user_id = ?').get(userId) as { count: number | bigint } | undefined
    return Number(row?.count ?? 0)
  }
}