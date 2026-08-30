import { loadConfig, saveConfig, maskConfig, unmaskMerge } from "#/services/config"
import type { HotNewsConfig } from "#/services/config"
import { getDb } from "#/database/db"

/**
 * 控制面板：读取/保存统一配置。
 * GET 返回脱敏配置；PUT 支持整包保存（"********" 占位保留原秘密值）。
 */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const method = getMethod(event)

  if (method === "GET") {
    const cfg = await loadConfig(db)
    return { success: true, config: maskConfig(cfg) }
  }

  if (method === "PUT" || method === "POST") {
    const body = await readBody(event)
    if (!body || typeof body !== "object") {
      throw createError({ statusCode: 400, message: "请求体必须是对象" })
    }
    const stored = await loadConfig(db)
    const merged = unmaskMerge<Partial<HotNewsConfig>>(stored as any, body)
    const saved = await saveConfig(db, merged)
    return { success: true, config: maskConfig(saved as HotNewsConfig) }
  }

  throw createError({ statusCode: 405, message: "Method not allowed" })
})
