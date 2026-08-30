import { clearSession } from "#/services/admin"

export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  clearSession(env, event)
  return { success: true }
})
