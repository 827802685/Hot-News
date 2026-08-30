import { SourceTable } from "#/database/sources"
import { getDb } from "#/database/db"

/**
 * 自定义订阅（公开）：供前端卡片墙展示。
 * 返回启用的 RSS/Telegram/自定义源列表，不含敏感字段。
 */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  if (!db) return { success: true, sources: [] }
  const table = new SourceTable(db)
  const rows = await table.list({ enabled: true })
  const custom = rows.filter(r => r.kind === "rss" || r.kind === "telegram" || r.kind === "custom")
  return {
    success: true,
    sources: custom.map(r => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      title: r.title || "",
      url: r.url || "",
      color: r.color || "primary",
    })),
  }
})
