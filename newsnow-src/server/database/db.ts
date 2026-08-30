import { createDatabase } from "db0"
import cloudflareD1Connector from "db0/connectors/cloudflare-d1"

/**
 * 把运行环境里的 D1 绑定包装成 db0 Database（提供 prepare().bind().get()/all()/run()）。
 * 原始 D1 绑定只有 .all()/.first()/.run()，而各 Table 类依赖 db0 的 StatementWrapper.get()。
 * 同时把 env 挂到 globalThis.__env__，供 db0 cloudflare-d1 connector 读取绑定。
 */
export function getDb(env?: any): any {
  const e = env || (globalThis as any).__env__ || {}
  const bindingName = e.NEWSNOW_DB ? "NEWSNOW_DB" : e.DB ? "DB" : ""
  if (!bindingName) return null
  ;(globalThis as any).__env__ = e
  return createDatabase(cloudflareD1Connector({ bindingName }))
}
