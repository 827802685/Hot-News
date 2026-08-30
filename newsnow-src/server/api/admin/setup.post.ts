import { getAdminCreds, hashPassword, saveAdminCreds, createSession } from "#/services/admin"
import { getDb } from "#/database/db"

/** 首次初始化管理员（仅当尚无管理员凭据时可用） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const body = await readBody(event).catch(() => ({}))
  const email = String(body?.email || "").trim().toLowerCase()
  const password = String(body?.password || "")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, message: "邮箱格式不正确" })
  if (password.length < 6) throw createError({ statusCode: 400, message: "密码至少 6 位" })

  const existing = await getAdminCreds(env, db)
  if (existing) throw createError({ statusCode: 403, message: "管理员已存在，请直接登录" })

  const passwordHash = await hashPassword(password)
  await saveAdminCreds(env, db, email, passwordHash)
  await createSession(env, event, email)
  return { success: true, email }
})
