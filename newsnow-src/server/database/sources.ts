import type { Database } from "db0"

/** 源/订阅类型：内置 | RSS | Telegram | 平台热榜 | 自定义 */
export type SourceKind = "builtin" | "rss" | "telegram" | "platform" | "custom"

export interface SourceRow {
  id: string
  kind: SourceKind
  name: string
  title: string
  icon: string
  url: string
  column: string
  color: string
  interval: number
  enabled: number
  pull_enabled: number
  pull_times: string
  meta: string
  created: number
  updated: number
}

export interface SourceInput {
  id?: string
  kind?: SourceKind
  name: string
  title?: string
  icon?: string
  url?: string
  column?: string
  color?: string
  interval?: number
  enabled?: boolean
  pull_enabled?: boolean
  pull_times?: string[]
  meta?: Record<string, unknown>
}

const COLS = "id, kind, name, title, icon, url, column, color, interval, enabled, pull_enabled, pull_times, meta, created, updated"

function rowToSource(r: any): SourceRow {
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    title: r.title || "",
    icon: r.icon || "",
    url: r.url || "",
    column: r.column || "focus",
    color: r.color || "primary",
    interval: r.interval ?? 600000,
    enabled: r.enabled ?? 1,
    pull_enabled: r.pull_enabled ?? 1,
    pull_times: r.pull_times || "[]",
    meta: r.meta || "{}",
    created: r.created ?? 0,
    updated: r.updated ?? 0,
  }
}

export class SourceTable {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  /** 列出全部源，可按 kind / enabled 过滤 */
  async list(opts: { kind?: SourceKind; enabled?: boolean } = {}): Promise<SourceRow[]> {
    const conds: string[] = []
    const params: any[] = []
    if (opts.kind) {
      conds.push("kind = ?")
      params.push(opts.kind)
    }
    if (opts.enabled !== undefined) {
      conds.push("enabled = ?")
      params.push(opts.enabled ? 1 : 0)
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : ""
    const res = await this.db.prepare(`SELECT ${COLS} FROM sources ${where} ORDER BY updated DESC`).bind(...params).all()
    const rows = (res as any).results ?? (res as any)
    return (rows || []).map(rowToSource)
  }

  async get(id: string): Promise<SourceRow | undefined> {
    const r = (await this.db.prepare(`SELECT ${COLS} FROM sources WHERE id = ?`).bind(id).get()) as any
    return r ? rowToSource(r) : undefined
  }

  async exists(id: string): Promise<boolean> {
    return !!(await this.get(id))
  }

  /** 新增或更新一个源 */
  async upsert(input: SourceInput): Promise<SourceRow> {
    const now = Date.now()
    const id = input.id || `${input.kind || "custom"}_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const existing = await this.get(id)
    const row: SourceRow = {
      id,
      kind: input.kind || "custom",
      name: input.name,
      title: input.title ?? existing?.title ?? "",
      icon: input.icon ?? existing?.icon ?? "",
      url: input.url ?? existing?.url ?? "",
      column: input.column ?? existing?.column ?? "focus",
      color: input.color ?? existing?.color ?? "primary",
      interval: input.interval ?? existing?.interval ?? 600000,
      enabled: input.enabled === undefined ? (existing?.enabled ?? 1) : input.enabled ? 1 : 0,
      pull_enabled: input.pull_enabled === undefined ? (existing?.pull_enabled ?? 1) : input.pull_enabled ? 1 : 0,
      pull_times: JSON.stringify(input.pull_times ?? JSON.parse(existing?.pull_times || "[]")),
      meta: JSON.stringify(input.meta ?? JSON.parse(existing?.meta || "{}")),
      created: existing?.created ?? now,
      updated: now,
    }
    await this.db.prepare(
      `INSERT INTO sources (${COLS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         kind=excluded.kind, name=excluded.name, title=excluded.title, icon=excluded.icon,
         url=excluded.url, column=excluded.column, color=excluded.color, interval=excluded.interval,
         enabled=excluded.enabled, pull_enabled=excluded.pull_enabled, pull_times=excluded.pull_times,
         meta=excluded.meta, updated=excluded.updated`,
    ).bind(
      row.id, row.kind, row.name, row.title, row.icon, row.url, row.column, row.color,
      row.interval, row.enabled, row.pull_enabled, row.pull_times, row.meta, row.created, row.updated,
    ).run()
    return row
  }

  async remove(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sources WHERE id = ?`).bind(id).run()
  }
}
