import { describe, it, expect, beforeEach } from 'bun:test'
import { createRegistry } from './registry.js'
import { memoryStore } from './store.js'
import type { TokenStore } from './types.js'

let store: TokenStore

beforeEach(async () => {
  store = memoryStore()
  await store.clear()
})

describe('createRegistry', () => {
  describe('opaque tokens', () => {
    it('creates a token with a role', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({ role: 'admin' })
      expect(record.role).toBe('admin')
      expect(record.token).toBeTruthy()
      expect(record.id).toBeTruthy()
      expect(record.revoked).toBe(false)
      expect(record.expiresAt).toBeNull()
    })

    it('verifies a valid token', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({ role: 'viewer' })
      const result = await registry.verify(record.token)
      expect(result).not.toBeNull()
      expect(result!.role).toBe('viewer')
    })

    it('returns null for unknown tokens', async () => {
      const registry = createRegistry({ store })
      const result = await registry.verify('nonexistent')
      expect(result).toBeNull()
    })

    it('attaches claims to tokens', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({
        role: 'admin',
        claims: { userId: '42', org: 'razroo' },
      })
      const result = await registry.verify(record.token)
      expect(result!.claims).toEqual({ userId: '42', org: 'razroo' })
    })

    it('rejects revoked tokens', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({ role: 'admin' })
      await registry.revoke(record.id)
      const result = await registry.verify(record.token)
      expect(result).toBeNull()
    })

    it('rejects expired tokens', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({
        role: 'admin',
        expiresIn: '1ms',
      })
      // Wait for expiry
      await new Promise((r) => setTimeout(r, 10))
      const result = await registry.verify(record.token)
      expect(result).toBeNull()
    })

    it('accepts non-expired tokens', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({
        role: 'admin',
        expiresIn: '1h',
      })
      const result = await registry.verify(record.token)
      expect(result).not.toBeNull()
      expect(result!.role).toBe('admin')
    })
  })

  describe('JWT tokens', () => {
    const jwtSecret = 'test-secret-at-least-32-chars-long!'

    it('creates a JWT token', async () => {
      const registry = createRegistry({ store, jwtSecret })
      const record = await registry.createToken({ role: 'admin' })
      // JWT tokens have three dot-separated parts
      expect(record.token.split('.').length).toBe(3)
    })

    it('verifies a JWT token', async () => {
      const registry = createRegistry({ store, jwtSecret })
      const record = await registry.createToken({ role: 'editor' })
      const result = await registry.verify(record.token)
      expect(result).not.toBeNull()
      expect(result!.role).toBe('editor')
    })

    it('includes claims in JWT', async () => {
      const registry = createRegistry({ store, jwtSecret })
      const record = await registry.createToken({
        role: 'admin',
        claims: { team: 'core' },
      })
      const result = await registry.verify(record.token)
      expect(result!.claims).toMatchObject({ team: 'core' })
    })

    it('rejects revoked JWT tokens', async () => {
      const registry = createRegistry({ store, jwtSecret })
      const record = await registry.createToken({ role: 'admin' })
      await registry.revoke(record.id)
      const result = await registry.verify(record.token)
      expect(result).toBeNull()
    })

    it('uses custom issuer', async () => {
      const registry = createRegistry({
        store,
        jwtSecret,
        jwtIssuer: 'my-app',
      })
      const record = await registry.createToken({ role: 'admin' })
      const result = await registry.verify(record.token)
      expect(result).not.toBeNull()
    })

    it('rejects JWT with wrong secret', async () => {
      const registry1 = createRegistry({ store, jwtSecret: 'secret-one-that-is-long-enough!!' })
      const record = await registry1.createToken({ role: 'admin' })

      const store2 = memoryStore()
      const registry2 = createRegistry({ store: store2, jwtSecret: 'secret-two-that-is-long-enough!!' })
      const result = await registry2.verify(record.token)
      expect(result).toBeNull()
    })
  })

  describe('revoke', () => {
    it('returns true for existing tokens', async () => {
      const registry = createRegistry({ store })
      const record = await registry.createToken({ role: 'admin' })
      const result = await registry.revoke(record.id)
      expect(result).toBe(true)
    })

    it('returns false for nonexistent ids', async () => {
      const registry = createRegistry({ store })
      const result = await registry.revoke('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('list', () => {
    it('lists active tokens', async () => {
      const registry = createRegistry({ store })
      await registry.createToken({ role: 'admin' })
      await registry.createToken({ role: 'viewer' })
      const tokens = await registry.list()
      expect(tokens.length).toBe(2)
    })

    it('excludes revoked tokens', async () => {
      const registry = createRegistry({ store })
      const r1 = await registry.createToken({ role: 'admin' })
      await registry.createToken({ role: 'viewer' })
      await registry.revoke(r1.id)
      const tokens = await registry.list()
      expect(tokens.length).toBe(1)
      expect(tokens[0]!.role).toBe('viewer')
    })

    it('excludes expired tokens', async () => {
      const registry = createRegistry({ store })
      await registry.createToken({ role: 'admin', expiresIn: '1ms' })
      await registry.createToken({ role: 'viewer', expiresIn: '1h' })
      await new Promise((r) => setTimeout(r, 10))
      const tokens = await registry.list()
      expect(tokens.length).toBe(1)
      expect(tokens[0]!.role).toBe('viewer')
    })
  })
})
