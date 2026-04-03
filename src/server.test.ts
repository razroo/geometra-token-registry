import { describe, it, expect, afterEach } from 'bun:test'
import { serveRegistry } from './server.js'

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

async function startServer(options: Parameters<typeof serveRegistry>[0] = {}) {
  const result = await serveRegistry({ port: 0, ...options })
  cleanup = result.close
  const addr = result.server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return { ...result, port, base: `http://localhost:${port}` }
}

describe('serveRegistry', () => {
  describe('POST /verify', () => {
    it('verifies a valid token', async () => {
      const { registry, base } = await startServer()
      const record = await registry.createToken({ role: 'admin' })

      const res = await fetch(`${base}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${record.token}` },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.role).toBe('admin')
    })

    it('rejects invalid tokens', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/verify`, {
        method: 'POST',
        headers: { Authorization: 'Bearer bad-token' },
      })
      expect(res.status).toBe(401)
    })

    it('rejects missing tokens', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/verify`, { method: 'POST' })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /admin/tokens', () => {
    it('creates a token', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'viewer' }),
      })
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.role).toBe('viewer')
      expect(body.token).toBeTruthy()
    })

    it('rejects when role is missing', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })

    it('requires admin key when configured', async () => {
      const { base } = await startServer({ adminKey: 'secret' })
      const res = await fetch(`${base}/admin/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' }),
      })
      expect(res.status).toBe(401)
    })

    it('accepts admin key in Authorization header', async () => {
      const { base } = await startServer({ adminKey: 'secret' })
      const res = await fetch(`${base}/admin/tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret',
        },
        body: JSON.stringify({ role: 'admin' }),
      })
      expect(res.status).toBe(201)
    })
  })

  describe('GET /admin/tokens', () => {
    it('lists tokens', async () => {
      const { registry, base } = await startServer()
      await registry.createToken({ role: 'admin' })
      await registry.createToken({ role: 'viewer' })

      const res = await fetch(`${base}/admin/tokens`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.tokens.length).toBe(2)
    })
  })

  describe('POST /admin/revoke', () => {
    it('revokes a token', async () => {
      const { registry, base } = await startServer()
      const record = await registry.createToken({ role: 'admin' })

      const res = await fetch(`${base}/admin/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.id }),
      })
      expect(res.status).toBe(200)

      // Verify token no longer works
      const verifyRes = await fetch(`${base}/verify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${record.token}` },
      })
      expect(verifyRes.status).toBe(401)
    })

    it('returns 404 for unknown id', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/admin/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'nonexistent' }),
      })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /health', () => {
    it('returns ok', async () => {
      const { base } = await startServer()
      const res = await fetch(`${base}/health`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
    })
  })
})
