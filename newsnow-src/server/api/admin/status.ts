import { getAdminCreds, getSession } from "#/services/admin"
import { getDb } from "#/database/db"

/** 控制面板登录状态：authenticated / needsSetup（首次需创建管理员） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const creds = await getAdminCreds(env, db)
  const session = await getSession(env, event)
  return {
    success: true,
    authenticated: !!session,
    needsSetup: !creds,
    email: session?.email || null,
  }
})
