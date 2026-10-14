import { Request, Response, parseBody, corsMiddleware, securityHeaders } from './http'

export type Handler = (req: Request, res: Response) => Promise<void> | void
export type Middleware = (req: Request, res: Response, next: () => void) => Promise<void> | void
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS'

interface Route {
  method: Method
  path: string
  handler: Handler
  middlewares?: Middleware[]
}

const routes: Route[] = []

export function get(path: string, handler: Handler, middlewares?: Middleware[]) {
  routes.push({ method: 'GET', path, handler, middlewares })
}

export function post(path: string, handler: Handler, middlewares?: Middleware[]) {
  routes.push({ method: 'POST', path, handler, middlewares })
}

export function patch(path: string, handler: Handler, middlewares?: Middleware[]) {
  routes.push({ method: 'PATCH', path, handler, middlewares })
}

export function del(path: string, handler: Handler, middlewares?: Middleware[]) {
  routes.push({ method: 'DELETE', path, handler, middlewares })
}

function matchRoute(path: string, routePath: string): { match: boolean; params: Record<string, string> } {
  const routeParts = routePath.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)
  const params: Record<string, string> = {}

  if (routeParts.length !== pathParts.length) {
    return { match: false, params: {} }
  }

  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i]
    const pathPart = pathParts[i]
    
    if (routePart.startsWith(':')) {
      params[routePart.slice(1)] = pathPart
    } else if (routePart !== pathPart) {
      return { match: false, params: {} }
    }
  }

  return { match: true, params }
}

export async function handleRequest(req: Request, res: Response): Promise<void> {
  corsMiddleware(res)
  securityHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  for (const route of routes) {
    if (route.method !== req.method) continue
    
    const { match, params } = matchRoute(pathname, route.path)
    if (!match) continue

    req.params = params

    try {
      await parseBody(req)
    } catch {
      res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } })
      return
    }

    const executeMiddleware = async (middlewares: Middleware[] = [], index = 0): Promise<boolean> => {
      if (index >= middlewares.length) return true
      let called = false
      await middlewares[index](req, res, () => { called = true })
      if (!called) return false
      return executeMiddleware(middlewares, index + 1)
    }

    if (route.middlewares && route.middlewares.length > 0) {
      const proceed = await executeMiddleware(route.middlewares)
      if (!proceed) return
    }

    try {
      await route.handler(req, res)
    } catch (error) {
      console.error('Route handler error:', error)
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan internal' } })
      }
    }
    return
  }

  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint tidak ditemukan' } })
}