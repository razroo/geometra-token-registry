# @geometra/token-registry

Token registry and verification service for [`@geometra/auth`](https://github.com/razroo/geometra-auth).

Creates, stores, and verifies tokens with role-based access control. Serves as the backend for `@geometra/auth`'s `remoteVerifier()`.

## Install

```bash
npm install @geometra/token-registry
```

## Quick Start

```ts
import { createRegistry, serveRegistry } from '@geometra/token-registry'

// Start the registry HTTP server
const { registry } = await serveRegistry({
  port: 3200,
  adminKey: process.env.ADMIN_KEY,
  jwtSecret: process.env.JWT_SECRET, // optional: enables JWT tokens
})

// Create tokens via the registry API
const admin = await registry.createToken({ role: 'admin', expiresIn: '7d' })
const viewer = await registry.createToken({ role: 'viewer' })
```

Then on the Geometra server, point `remoteVerifier()` at the registry:

```ts
import { createAuth } from '@geometra/auth'
import { remoteVerifier } from '@geometra/auth'

const auth = createAuth({
  verify: remoteVerifier('http://localhost:3200/verify'),
  policies: {
    viewer: { allow: ['resize'] },
  },
})
```

## API

### `createRegistry(options?)`

Creates a registry instance for programmatic use.

```ts
const registry = createRegistry({
  store: memoryStore(),             // default; implement TokenStore for Redis/Postgres
  jwtSecret: 'your-secret',        // optional: sign tokens as JWTs
  jwtIssuer: '@geometra/token-registry', // optional: JWT issuer claim
})
```

| Method | Description |
|---|---|
| `registry.createToken({ role, claims?, expiresIn? })` | Create and store a new token |
| `registry.verify(token)` | Returns `{ role, claims }` or `null` |
| `registry.revoke(id)` | Revoke a token by ID |
| `registry.list()` | List all active (non-revoked, non-expired) tokens |

### `serveRegistry(options?)`

Starts an HTTP server with verification and admin endpoints.

```ts
const { registry, server, close } = await serveRegistry({
  port: 3200,
  adminKey: 'secret',   // protects /admin/* endpoints
  jwtSecret: 'secret',  // optional
})
```

### HTTP Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/verify` | Bearer token | Verify a token (for `remoteVerifier()`) |
| `POST` | `/admin/tokens` | Admin key | Create a token (`{ role, claims?, expiresIn? }`) |
| `GET` | `/admin/tokens` | Admin key | List active tokens |
| `POST` | `/admin/revoke` | Admin key | Revoke a token (`{ id }`) |
| `GET` | `/health` | None | Health check |

### Token Modes

**Opaque tokens** (default): Random base64url strings stored and looked up in the store.

**JWT tokens** (when `jwtSecret` is set): Signed JWTs that can be verified without a store lookup. Revocation still checks the store.

### Custom Stores

Implement the `TokenStore` interface for any backend:

```ts
import type { TokenStore } from '@geometra/token-registry'

function redisStore(client: RedisClient): TokenStore {
  return {
    async put(record) { /* ... */ },
    async getByToken(token) { /* ... */ },
    async getById(id) { /* ... */ },
    async revoke(id) { /* ... */ },
    async list() { /* ... */ },
    async clear() { /* ... */ },
  }
}
```

## Development

```bash
bun install
bun run check    # type check
bun test         # run tests
bun run build    # compile to dist/
```

## License

MIT
