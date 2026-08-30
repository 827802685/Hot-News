import { setCookie, deleteCookie, getCookie } from "h3"
import { UserTable } from "../database/user"
import { logger } from "../utils/logger"

/**
 * 管理员认证（控制面板用）
 * - 与 legacy 兼容：凭据存 KV hotnews:auth:email / hotnews:auth:password_hash
 *   （hash = hex(SHA-256(password + "::hotnews_salt_v1"))），同时写进统一 users 表 role=admin
 * - 会话：随机 token → KV hotnews:session:<token>（7 天），cookie hotnews_session
 */

const SALT = "::hotnews_salt_v1"
const SESSION_TTL = 7 * 24 * 3600
const COOKIE_NAME = "hotnews_session"

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(String(password || "") + SALT)
  const buf = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")
}

export function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("")
}

/** 读取管理员凭据（KV 优先，users 表兜底） */
export async function getAdminCreds(env: any, db: any): Promise<{ email: string; passwordHash: string } | null> {
  try {
    const kv = env?.KV
    let email = kv ? await kv.get("hotnews:auth:email") : null
    let passwordHash = kv ? await kv.get("hotnews:auth:password_hash") : null
    if (email && passwordHash) return { email, passwordHash }
  } catch { /* KV 不可用 */ }
  try {
    if (db) {
      const admins = await new UserTable(db).listUsers()
      const admin = admins.find(u => u.role === "admin")
      if (admin?.email) {
        const row: any = await new UserTable(db).getUserByEmail(admin.email)
        if (row?.password_hash) return { email: row.email, passwordHash: row.password_hash }
      }
    }
  } catch { /* ignore */ }
  return null
}

export async function saveAdminCreds(env: any, db: any, email: string, passwordHash: string) {
  try {
    const kv = env?.KV
    if (kv) {
      await kv.put("hotnews:auth:email", email)
      await kv.put("hotnews:auth:password_hash", passwordHash)
    }
  } catch { /* ignore */ }
  try {
    if (db) await new UserTable(db).upsertAdmin(`admin_${Date.now().toString(36)}`, email, passwordHash)
  } catch (e: any) {
    logger.warn(`saveAdminCreds user table: ${e.message}`)
  }
}

/** 创建会话并种 cookie */
export async function createSession(env: any, event: any, email: string): Promise<string> {
  const token = generateToken()
  const expires = Date.now() + SESSION_TTL * 1000
  try {
    if (env?.KV) await env.KV.put(`hotnews:session:${token}`, JSON.stringify({ email, expires }), { expirationTtl: SESSION_TTL })
  } catch { /* ignore */ }
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(getRequestURL(event)).protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL,
  })
  return token
}

/** 读取当前会话（cookie → KV） */
export async function getSession(env: any, event: any): Promise<{ email: string } | null> {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null
  try {
    const raw = env?.KV ? await env.KV.get(`hotnews:session:${token}`) : null
    if (!raw) return null
    const s = JSON.parse(raw)
    if (Date.now() > s.expires) {
      if (env?.KV) await env.KV.delete(`hotnews:session:${token}`)
      return null
    }
    return { email: s.email }
  } catch {
    return null
  }
}

export function clearSession(env: any, event: any) {
  const token = getCookie(event, COOKIE_NAME)
  if (token && env?.KV) env.KV.delete(`hotnews:session:${token}`).catch(() => {})
  deleteCookie(event, COOKIE_NAME, { path: "/" })
}

/** 校验管理员登录态，未登录抛 401 */
export async function requireAdmin(env: any, event: any): Promise<{ email: string }> {
  const session = await getSession(env, event)
  if (!session) {
    throw createError({ statusCode: 401, message: "未登录或会话已过期" })
  }
  return session
}
