import { loadConfig } from "#/services/config"
import { runUrgentPush } from "#/services/urgent"
import { getDb } from "#/database/db"

/** 手动触发「紧急消息」即时推送（调试用） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const cfg = await loadConfig(db)
  const result = await runUrgentPush(cfg, env, db)
  return result
})
