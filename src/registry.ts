import { randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'
import type {
  CreateTokenOptions,
  Registry,
  RegistryOptions,
  TokenRecord,
  VerifyResult,
} from './types.js'
import { memoryStore } from './store.js'

/** Parse a duration string like "7d", "1h", "30m" into milliseconds */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)\s*(ms|s|m|h|d)$/)
  if (!match) throw new Error(`Invalid duration: "${duration}"`)
  const value = parseInt(match[1]!, 10)
  const unit = match[2]!
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  }
  return value * multipliers[unit]!
}

function generateId(): string {
  return randomBytes(12).toString('hex')
}

function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * Create a token registry.
 *
 * ```ts
 * import { createRegistry } from '@geometra/token-registry'
 *
 * const registry = createRegistry()
 * const record = await registry.createToken({ role: 'admin' })
 * const result = await registry.verify(record.token)
 * // { role: 'admin', claims: {} }
 * ```
 */
export function createRegistry(options: RegistryOptions = {}): Registry {
  const store = options.store ?? memoryStore()
  const jwtSecret = options.jwtSecret
    ? new TextEncoder().encode(options.jwtSecret)
    : null
  const jwtIssuer = options.jwtIssuer ?? '@geometra/token-registry'

  const createToken = async (
    tokenOptions: CreateTokenOptions,
  ): Promise<TokenRecord> => {
    const id = generateId()
    const claims = tokenOptions.claims ?? {}
    const now = new Date()

    let expiresAt: string | null = null
    if (tokenOptions.expiresIn) {
      const ms = parseDuration(tokenOptions.expiresIn)
      expiresAt = new Date(now.getTime() + ms).toISOString()
    }

    let token: string
    if (jwtSecret) {
      const builder = new SignJWT({ role: tokenOptions.role, ...claims })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(jwtIssuer)
        .setIssuedAt()
        .setJti(id)
      if (tokenOptions.expiresIn) {
        builder.setExpirationTime(tokenOptions.expiresIn)
      }
      token = await builder.sign(jwtSecret)
    } else {
      token = generateOpaqueToken()
    }

    const record: TokenRecord = {
      id,
      token,
      role: tokenOptions.role,
      claims,
      createdAt: now.toISOString(),
      expiresAt,
      revoked: false,
    }

    await store.put(record)
    return record
  }

  const verify = async (token: string): Promise<VerifyResult | null> => {
    // Try JWT verification first if a secret is configured
    if (jwtSecret) {
      try {
        const { payload } = await jwtVerify(token, jwtSecret, {
          issuer: jwtIssuer,
        })
        const role = payload.role as string | undefined
        if (!role) return null

        // Check if revoked in store
        const jti = payload.jti
        if (jti) {
          const record = await store.getById(jti)
          if (record?.revoked) return null
        }

        const { role: _, jti: __, iss: ___, iat: ____, exp: _____, ...claims } =
          payload
        return { role, claims }
      } catch {
        // JWT verification failed — fall through to opaque lookup
      }
    }

    // Opaque token lookup
    const record = await store.getByToken(token)
    if (!record) return null
    if (record.revoked) return null
    if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
      return null
    }

    return { role: record.role, claims: record.claims }
  }

  const revoke = async (id: string): Promise<boolean> => {
    return store.revoke(id)
  }

  const list = async (): Promise<TokenRecord[]> => {
    const records = await store.list()
    const now = new Date()
    return records.filter(
      (r) => !r.expiresAt || new Date(r.expiresAt) > now,
    )
  }

  return { createToken, verify, revoke, list, store }
}
