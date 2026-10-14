import { IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { parse as parseCookie } from 'cookie'
import { config } from './config'
import { sessionsRepository } from './db/repositories/sessions'
import { usersRepository } from './db/repositories/users'
import { createSessionHash } from './lib/auth'

import type { User } from './db/repositories/users'

export interface Request extends IncomingMessage {
  body: Record<string, unknown>
  query: Record<string, string>
  params: Record<string, string>
  cookies: Record<string, string>
  user?: User
}

export interface Response extends ServerResponse {
  json(data: unknown): this
  status(code: number): this
}

export function createRequest(req: IncomingMessage): Request {
  const url = parse(req.url || '/', true)
  const cookies = parseCookie(req.headers.cookie || '')
  
  return Object.assign(req, {
    query: (url.query || {}) as Record<string, string>,
    params: {},
    cookies,
    body: {}
  }) as Request
}

export function createResponse(res: ServerResponse): Response {
  const response = res as Response
  
  response.json = function (data: unknown) {
    this.setHeader('Content-Type', 'application/json')
    this.end(JSON.stringify(data))
    return this
  }
  
  response.status = function (code: number) {
    this.statusCode = code
    return this
  }
  
  return response
}

export async function parseBody(req: Request): Promise<void> {
  if (['GET', 'HEAD'].includes(req.method || '')) {
    req.body = {}
    return
  }

  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {}
        resolve()
      } catch {
        req.body = {}
        resolve()
      }
    })
    req.on('error', reject)
  })
}

export async function authMiddleware(req: Request, res: Response, next: () => void): Promise<void> {
  const sessionToken = req.cookies?.session
  if (!sessionToken) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Tidak terautentikasi' } })
    return
  }

  const sessionHash = createSessionHash(sessionToken)
  const session = sessionsRepository.findByHash(sessionHash)
  
  if (!session || !sessionsRepository.isValid(sessionHash)) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sesi tidak valid atau sudah kadaluwarsa' } })
    return
  }

  const user = usersRepository.findById(session.user_id)
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Pengguna tidak ditemukan' } })
    return
  }

  req.user = user
  sessionsRepository.updateLastSeen(sessionHash)
  next()
}

export function adminMiddleware(req: Request, res: Response, next: () => void): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Akses ditolak: memerlukan hak admin' } })
    return
  }
  next()
}

export function corsMiddleware(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', config.corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

export function securityHeaders(res: Response): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}