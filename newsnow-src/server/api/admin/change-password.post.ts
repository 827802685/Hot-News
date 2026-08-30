import { getAdminCreds, hashPassword, saveAdminCreds, requireAdmin } from "#/services/admin"
import { getDb } from "#/database/db"

/** 修改管理员密码 */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const session = await requireAdmin(env, event)
  const body = await readBody(event).catch(() => ({}))
  const oldPassword = String(body?.oldPassword || "")
  const newPassword = String(body?.newPassword || "")
  if (newPassword.length < 6) throw createError({ statusCode: 400, message: "新密码至少 6 位" })

  const creds = await getAdminCreds(env, db)
  if (!creds || await hashPassword(oldPassword) !== creds.passwordHash) {
    throw createError({ statusCode: 401, message: "旧密码错误" })
  }
  await saveAdminCreds(env, db, session.email, await hashPassword(newPassword))
  return { success: true }
})
