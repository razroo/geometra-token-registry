import type { TokenRecord, TokenStore } from './types.js'

/**
 * In-memory token store. Good for development and testing.
 * Tokens are lost when the process exits.
 */
export function memoryStore(): TokenStore {
  const byToken = new Map<string, TokenRecord>()
  const byId = new Map<string, TokenRecord>()

  return {
    async put(record) {
      byToken.set(record.token, record)
      byId.set(record.id, record)
    },

    async getByToken(token) {
      return byToken.get(token) ?? null
    },

    async getById(id) {
      return byId.get(id) ?? null
    },

    async revoke(id) {
      const record = byId.get(id)
      if (!record) return false
      record.revoked = true
      return true
    },

    async list() {
      return Array.from(byId.values()).filter((r) => !r.revoked)
    },

    async clear() {
      byToken.clear()
      byId.clear()
    },
  }
}
