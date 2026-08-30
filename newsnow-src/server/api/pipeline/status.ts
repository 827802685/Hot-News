import { RecordTable } from "#/database/records"
import { getDb } from "#/database/db"

/** 控制面板：管线状态（最近一次运行结果 + 最近推送/抓取记录） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const kv = env.KV
  const records = new RecordTable(db)

  let lastRun: any = null
  try {
    if (kv) lastRun = await kv.get("hotnews:pipeline:last", "json")
  } catch { /* ignore */ }

  const [pushes, crawls] = await Promise.all([
    records.recentPushRecords(30),
    records.recentCrawlRecords(30),
  ])

  return {
    success: true,
    lastRun,
    pushes,
    crawls,
  }
})
