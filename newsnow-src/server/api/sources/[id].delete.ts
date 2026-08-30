import { SourceTable } from "#/database/sources"
import { getDb } from "#/database/db"

/** 控制面板：删除自定义源 */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const db = getDb(env)
  const id = getRouterParam(event, "id")
  if (!id) throw createError({ statusCode: 400, message: "缺少 id" })
  const table = new SourceTable(db)
  await table.remove(id)
  return { success: true, id }
})
