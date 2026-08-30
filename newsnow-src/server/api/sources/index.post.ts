import { SourceTable } from "#/database/sources"
import { getDb } from "#/database/db"

/** 控制面板：新增/更新自定义源（RSS / Telegram / 自定义） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const body = await readBody(event)
  if (!body || !body.name) {
    throw createError({ statusCode: 400, message: "缺少 name" })
  }
  if (!body.url) {
    throw createError({ statusCode: 400, message: "缺少 url" })
  }
  const table = new SourceTable(db)
  const row = await table.upsert({
    id: body.id || undefined,
    kind: body.kind || "rss",
    name: body.name,
    title: body.title,
    icon: body.icon,
    url: body.url,
    column: body.column,
    color: body.color,
    interval: body.interval,
    enabled: body.enabled,
    pull_enabled: body.pull_enabled,
    pull_times: body.pull_times,
    meta: body.meta,
  })
  return { success: true, source: row }
})
