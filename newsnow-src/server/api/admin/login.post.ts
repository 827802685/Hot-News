import { getAdminCreds, hashPassword, createSession } from "#/services/admin"
import { getDb } from "#/database/db"

/** 管理员登录（邮箱 + 密码，与 legacy 兼容的 hash） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || "").trim().toLowerCase()
  const password = String(body?.password || "")

  const creds = await getAdminCreds(env, db)
  if (!creds) throw createError({ statusCode: 400, message: "系统尚未初始化，请先创建管理员" })
  if (email !== creds.email || await hashPassword(password) !== creds.passwordHash) {
    throw createError({ statusCode: 401, message: "邮箱或密码错误" })
  }
  await createSession(env, event, email)
  return { success: true, email }
})
