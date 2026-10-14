import { createServer } from 'http'
import { existsSync, statSync, createReadStream } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from './config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
import { initializeDatabase, closeDatabase } from './db'
import { logger } from './lib/logger'
import { handleRequest } from './router'
import { createRequest, createResponse } from './http'
import { get, post, patch, del } from './router'
import { authMiddleware, adminMiddleware } from './http'
import * as authModule from './modules/auth'
import * as subjectsModule from './modules/subjects'
import * as tasksModule from './modules/tasks'
import * as dashboardModule from './modules/dashboard'
import * as settingsModule from './modules/settings'
import * as notificationsUserModule from './modules/notifications/user'
import * as adminModule from './modules/admin'
import { initializeScheduler } from './modules/scheduler'

function registerRoutes() {
  // Auth routes
  post('/api/auth/register', authModule.register)
  post('/api/auth/login', authModule.login)
  post('/api/auth/verify-whatsapp', authModule.requestVerificationCode)
  post('/api/auth/confirm-whatsapp', authModule.verifyWhatsApp)
  post('/api/auth/request-verification', authModule.requestVerificationCode)
  post('/api/auth/logout', authModule.logout, [authMiddleware])
  get('/api/auth/me', authModule.me, [authMiddleware])
  post('/api/auth/change-password', authModule.changePassword, [authMiddleware])

  // Subjects routes
  get('/api/subjects', subjectsModule.listSubjects, [authMiddleware])
  post('/api/subjects', subjectsModule.createSubject, [authMiddleware])
  get('/api/subjects/:id', subjectsModule.getSubject, [authMiddleware])
  patch('/api/subjects/:id', subjectsModule.updateSubject, [authMiddleware])
  del('/api/subjects/:id', subjectsModule.deleteSubject, [authMiddleware])

  // Tasks routes
  get('/api/tasks', tasksModule.listTasks, [authMiddleware])
  post('/api/tasks', tasksModule.createTask, [authMiddleware])
  get('/api/tasks/:id', tasksModule.getTask, [authMiddleware])
  patch('/api/tasks/:id', tasksModule.updateTask, [authMiddleware])
  del('/api/tasks/:id', tasksModule.deleteTask, [authMiddleware])
  patch('/api/tasks/:id/complete', tasksModule.completeTask, [authMiddleware])
  patch('/api/tasks/:id/uncomplete', tasksModule.uncompleteTask, [authMiddleware])

  // Dashboard routes
  get('/api/dashboard/summary', dashboardModule.getDashboardSummary, [authMiddleware])
  get('/api/dashboard/upcoming', dashboardModule.getUpcomingTasks, [authMiddleware])
  get('/api/dashboard/overdue', dashboardModule.getOverdueTasks, [authMiddleware])
  get('/api/dashboard/due-soon', dashboardModule.getDueSoonTasks, [authMiddleware])

  // Settings routes
  get('/api/settings', settingsModule.getSettings, [authMiddleware])
  patch('/api/settings', settingsModule.updateSettings, [authMiddleware])

  // Notifications routes
  get('/api/notifications', notificationsUserModule.listNotifications, [authMiddleware])
  get('/api/notifications/:id', notificationsUserModule.getNotification, [authMiddleware])

  // Admin routes
  get('/api/admin/stats', adminModule.getAdminStats, [authMiddleware, adminMiddleware])
  get('/api/admin/whatsapp/status', adminModule.getWhatsAppStatus, [authMiddleware, adminMiddleware])
  post('/api/admin/whatsapp/pairing-code', adminModule.generatePairingCode, [authMiddleware, adminMiddleware])
  post('/api/admin/whatsapp/reconnect', adminModule.reconnectWhatsApp, [authMiddleware, adminMiddleware])
  post('/api/admin/whatsapp/disconnect', adminModule.disconnectWhatsApp, [authMiddleware, adminMiddleware])
  get('/api/admin/notifications/queue', adminModule.getNotificationQueue, [authMiddleware, adminMiddleware])
  get('/api/admin/notifications/failed', adminModule.getFailedNotifications, [authMiddleware, adminMiddleware])
  get('/api/admin/settings', adminModule.getAppSettings, [authMiddleware, adminMiddleware])
  patch('/api/admin/settings', adminModule.updateAppSetting, [authMiddleware, adminMiddleware])

  // Health check
  get('/api/health', async (_req, res) => {
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } })
  })
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

function serveStaticFrontend(reqUrl: string, res: any): boolean {
  // Try several candidate directories for frontend dist
  const candidates = [
    join(process.cwd(), 'frontend', 'dist'),
    join(process.cwd(), '..', 'frontend', 'dist'),
    join(__dirname, '..', '..', 'frontend', 'dist')
  ]

  let frontendDist = ''
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) {
      frontendDist = c
      break
    }
  }

  if (!frontendDist) return false

  const urlPath = new URL(reqUrl, 'http://localhost').pathname
  let targetFile = join(frontendDist, urlPath)

  if (!existsSync(targetFile) || statSync(targetFile).isDirectory()) {
    targetFile = join(frontendDist, 'index.html')
  }

  if (existsSync(targetFile) && statSync(targetFile).isFile()) {
    const ext = extname(targetFile).toLowerCase()
    const mime = MIME_TYPES[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    createReadStream(targetFile).pipe(res)
    return true
  }

  return false
}

async function startServer() {
  try {
    logger.info('Initializing database...')
    initializeDatabase()

    logger.info('Registering routes...')
    registerRoutes()

    logger.info('Initializing scheduler...')
    await initializeScheduler()

    const server = createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

      // If it is an API request, handle with router
      if (parsedUrl.pathname.startsWith('/api')) {
        const request = createRequest(req)
        const response = createResponse(res)
        return handleRequest(request, response)
      }

      // If static frontend exists, serve it
      const served = serveStaticFrontend(req.url || '/', res)
      if (served) return

      // Fallback response
      res.statusCode = 404
      res.end('Not Found')
    })

    server.listen(config.port, '0.0.0.0', () => {
      logger.info({ port: config.port, env: config.nodeEnv }, 'Server started')
      console.log(`🚀 Server running on http://0.0.0.0:${config.port}`)
      console.log(`   Timezone: ${config.appTimezone}`)
    })

    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutting down...')
      server.close()
      closeDatabase()
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  } catch (error) {
    logger.error({ error }, 'Failed to start server')
    process.exit(1)
  }
}

startServer()
