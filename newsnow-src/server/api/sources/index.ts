import { SourceTable } from "#/database/sources"
import { getDb } from "#/database/db"

/** 控制面板：自定义源（RSS/Telegram）列表 */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const table = new SourceTable(db)
  const rows = await table.list({})
  return {
    success: true,
    sources: rows.map(r => ({
      ...r,
      pull_times: safeParse(r.pull_times),
      meta: safeParse(r.meta),
    })),
  }
})

function safeParse(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
