import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRegistry } from './registry.js'
import type { Registry, ServeOptions } from './types.js'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

/**
 * Serve the registry as an HTTP server.
 *
 * Endpoints:
 *   POST /verify          — verify a Bearer token (for remoteVerifier)
 *   POST /admin/tokens    — create a token (admin)
 *   GET  /admin/tokens    — list active tokens (admin)
 *   POST /admin/revoke    — revoke a token by id (admin)
 *
 * ```ts
 * import { serveRegistry } from '@geometra/token-registry'
 *
 * const { registry, server } = await serveRegistry({
 *   port: 3200,
 *   adminKey: process.env.ADMIN_KEY,
 * })
 * ```
 */
export async function serveRegistry(options: ServeOptions = {}): Promise<{
  registry: Registry
  server: ReturnType<typeof createServer>
  close: () => void
}> {
  const port = options.port ?? 3200
  const adminKey = options.adminKey ?? null
  const registry = createRegistry(options)

  function checkAdmin(req: IncomingMessage, res: ServerResponse): boolean {
    if (!adminKey) return true
    const auth = req.headers.authorization
    if (auth === `Bearer ${adminKey}`) return true
    json(res, 401, { error: 'Unauthorized' })
    return false
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const path = url.pathname

    try {
      // POST /verify — for @geometra/auth remoteVerifier()
      if (req.method === 'POST' && path === '/verify') {
        const auth = req.headers.authorization ?? ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (!token) {
          json(res, 401, { error: 'No token' })
          return
        }
        const result = await registry.verify(token)
        if (!result) {
          json(res, 401, { error: 'Invalid token' })
          return
        }
        json(res, 200, result)
        return
      }

      // POST /admin/tokens — create a token
      if (req.method === 'POST' && path === '/admin/tokens') {
        if (!checkAdmin(req, res)) return
        const body = JSON.parse(await readBody(req)) as {
          role?: string
          claims?: Record<string, unknown>
          expiresIn?: string
        }
        if (!body.role) {
          json(res, 400, { error: 'role is required' })
          return
        }
        const record = await registry.createToken({
          role: body.role,
          claims: body.claims,
          expiresIn: body.expiresIn,
        })
        json(res, 201, record)
        return
      }

      // GET /admin/tokens — list active tokens
      if (req.method === 'GET' && path === '/admin/tokens') {
        if (!checkAdmin(req, res)) return
        const tokens = await registry.list()
        json(res, 200, { tokens })
        return
      }

      // POST /admin/revoke — revoke a token
      if (req.method === 'POST' && path === '/admin/revoke') {
        if (!checkAdmin(req, res)) return
        const body = JSON.parse(await readBody(req)) as { id?: string }
        if (!body.id) {
          json(res, 400, { error: 'id is required' })
          return
        }
        const revoked = await registry.revoke(body.id)
        json(res, revoked ? 200 : 404, { revoked })
        return
      }

      // Health check
      if (req.method === 'GET' && path === '/health') {
        json(res, 200, { status: 'ok' })
        return
      }

      json(res, 404, { error: 'Not found' })
    } catch (err) {
      json(res, 500, { error: String(err) })
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(port, resolve)
  })

  return {
    registry,
    server,
    close: () => server.close(),
  }
}
