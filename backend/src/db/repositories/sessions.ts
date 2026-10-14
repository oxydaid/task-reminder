import { db } from '../index'

export interface Session {
  id: number
  user_id: number
  session_hash: string
  expires_at: string
  created_at: string
  last_seen_at: string
}

export interface CreateSessionInput {
  userId: number
  sessionHash: string
  expiresAt: string
}

export const sessionsRepository = {
  create(input: CreateSessionInput): Session {
    const stmt = db.prepare(`
      INSERT INTO sessions (user_id, session_hash, expires_at)
      VALUES (?, ?, ?)
      RETURNING *
    `)
    return stmt.get(input.userId, input.sessionHash, input.expiresAt) as unknown as Session
  },

  findByHash(sessionHash: string): Session | null {
    const row = db.prepare('SELECT * FROM sessions WHERE session_hash = ?').get(sessionHash)
    return (row as unknown as Session) ?? null
  },

  findByUserId(userId: number): Session[] {
    return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as unknown as Session[]
  },

  updateLastSeen(sessionHash: string): Session | null {
    const stmt = db.prepare(`
      UPDATE sessions SET last_seen_at = datetime('now')
      WHERE session_hash = ? RETURNING *
    `)
    const row = stmt.get(sessionHash)
    return (row as unknown as Session) ?? null
  },

  delete(sessionHash: string): boolean {
    const result = db.prepare('DELETE FROM sessions WHERE session_hash = ?').run(sessionHash)
    return Number(result.changes) > 0
  },

  deleteByUserId(userId: number): number {
    const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    return Number(result.changes)
  },

  deleteExpired(): number {
    const result = db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run()
    return Number(result.changes)
  },

  isValid(sessionHash: string): boolean {
    const session = this.findByHash(sessionHash)
    if (!session) return false
    return new Date(session.expires_at) > new Date()
  }
}