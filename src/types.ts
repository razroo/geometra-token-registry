/** A role string (e.g. "admin", "viewer") */
export type Role = string

/** Stored token record */
export interface TokenRecord {
  /** Unique token identifier */
  id: string
  /** The token string sent by clients */
  token: string
  /** Role assigned to this token */
  role: Role
  /** Arbitrary claims attached to the token */
  claims: Record<string, unknown>
  /** When the token was created (ISO 8601) */
  createdAt: string
  /** When the token expires (ISO 8601), or null for no expiry */
  expiresAt: string | null
  /** Whether this token has been revoked */
  revoked: boolean
}

/** Result of a verify call — matches what @geometra/auth expects */
export interface VerifyResult {
  role: Role
  claims?: Record<string, unknown>
}

/** Options for creating a new token */
export interface CreateTokenOptions {
  /** Role to assign. Required. */
  role: Role
  /** Optional claims to attach */
  claims?: Record<string, unknown>
  /** Expiry duration string (e.g. "7d", "1h", "30m") or null for no expiry */
  expiresIn?: string | null
}

/**
 * Token storage backend interface.
 * Implement this to use a custom database (Redis, Postgres, etc.).
 */
export interface TokenStore {
  /** Store a new token record */
  put(record: TokenRecord): Promise<void>
  /** Look up a token by its string value. Returns null if not found. */
  getByToken(token: string): Promise<TokenRecord | null>
  /** Look up a token by its ID. Returns null if not found. */
  getById(id: string): Promise<TokenRecord | null>
  /** Mark a token as revoked by ID */
  revoke(id: string): Promise<boolean>
  /** List all non-revoked tokens */
  list(): Promise<TokenRecord[]>
  /** Remove all tokens (useful for testing) */
  clear(): Promise<void>
}

/** Configuration for createRegistry() */
export interface RegistryOptions {
  /** Token storage backend. Default: in-memory store. */
  store?: TokenStore
  /** Secret for signing JWTs. If omitted, tokens are random opaque strings. */
  jwtSecret?: string
  /** JWT issuer claim. Default: "@geometra/token-registry" */
  jwtIssuer?: string
}

/** HTTP server options for serveRegistry() */
export interface ServeOptions extends RegistryOptions {
  /** Port to listen on. Default: 3200. */
  port?: number
  /** Optional admin API key to protect admin endpoints */
  adminKey?: string
}

/** The registry instance returned by createRegistry() */
export interface Registry {
  /** Create a new token and store it */
  createToken(options: CreateTokenOptions): Promise<TokenRecord>
  /** Verify a token string — returns { role, claims } or null */
  verify(token: string): Promise<VerifyResult | null>
  /** Revoke a token by ID */
  revoke(id: string): Promise<boolean>
  /** List all active (non-revoked, non-expired) tokens */
  list(): Promise<TokenRecord[]>
  /** The underlying store */
  store: TokenStore
}
