# @geometra/token-registry

Token registry and verification service for the Geometra auth ecosystem.

## What This Project Is

This is a standalone npm package (`@geometra/token-registry`) that provides a token management backend for `@geometra/auth`'s `remoteVerifier()`. It handles token creation, storage, verification, revocation, and expiry.

The registry can run as a library (programmatic API) or as an HTTP microservice that `remoteVerifier()` calls directly.

## Architecture

- **`src/types.ts`** — All TypeScript interfaces (`TokenRecord`, `TokenStore`, `Registry`, `VerifyResult`, etc.)
- **`src/store.ts`** — `memoryStore()` — in-memory token storage (default; implement `TokenStore` for Redis/Postgres)
- **`src/registry.ts`** — `createRegistry()` — core logic: token creation (opaque or JWT), verification, revocation, listing
- **`src/server.ts`** — `serveRegistry()` — HTTP server with `/verify` + `/admin/*` endpoints
- **`src/index.ts`** — Main entry point

## Build & Test

```bash
bun install
bun run check    # tsc --noEmit
bun test         # bun test runner
bun run build    # tsc → dist/
```

## Code Conventions

- ESM (`"type": "module"`) with `.js` extensions in imports
- Strict TypeScript, `nodenext` module resolution
- Tests use Bun's built-in test runner (`bun:test`)
- Single runtime dependency: `jose` (JWT signing/verification)
- `TokenStore` interface allows pluggable storage backends

## Relationship to Geometra Ecosystem

- **`@geometra/auth`** — defines the verification protocol (`TokenVerifier` type, `remoteVerifier()`)
- **`@geometra/token-registry`** (this package) — implements that protocol as a service
- **`@geometra/server`** — consumes auth hooks from `@geometra/auth`
