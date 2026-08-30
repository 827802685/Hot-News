import { getSession } from "../services/admin"

/**
 * 管理员鉴权中间件：保护控制面板相关 API。
 * - /api/config, /api/sources, /api/pipeline/* 需要管理员登录
 * - /api/admin 下除 status/setup/login/logout 外也需要登录
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const path = url.pathname
  if (!path.startsWith("/api")) return

  const isProtected =
    path.startsWith("/api/config") ||
    path.startsWith("/api/sources") ||
    path.startsWith("/api/pipeline")

  const isAdminApi = path.startsWith("/api/admin")
  const isPublicAdminAction =
    path.endsWith("/api/admin/status") ||
    path.endsWith("/api/admin/setup") ||
    path.endsWith("/api/admin/login") ||
    path.endsWith("/api/admin/logout")

  if (!isProtected && !(isAdminApi && !isPublicAdminAction)) return

  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const session = await getSession(env, event)
  if (!session) {
    throw createError({ statusCode: 401, message: "未登录或会话已过期" })
  }
  ;(event.context as any).admin = session
})
