import type { Database } from "db0"

export type ItemKind = "hotlist" | "rss" | "telegram" | "custom"

export interface ItemRow {
  id: number
  source_id: string
  kind: ItemKind
  title: string
  url: string
  mobile_url: string
  rank: number | null
  summary: string
  image: string
  published_at: string
  fingerprint: string
  first_seen: string
  last_seen: string
}

export interface ItemInput {
  source_id: string
  kind?: ItemKind
  title: string
  url?: string
  mobile_url?: string
  rank?: number | null
  summary?: string
  image?: string
  published_at?: string
  fingerprint?: string
}

const COLS = "id, source_id, kind, title, url, mobile_url, rank, summary, image, published_at, fingerprint, first_seen, last_seen"

function rowToItem(r: any): ItemRow {
  return {
    id: r.id,
    source_id: r.source_id,
    kind: r.kind || "hotlist",
    title: r.title,
    url: r.url || "",
    mobile_url: r.mobile_url || "",
    rank: r.rank ?? null,
    summary: r.summary || "",
    image: r.image || "",
    published_at: r.published_at || "",
    fingerprint: r.fingerprint || "",
    first_seen: r.first_seen,
    last_seen: r.last_seen,
  }
}

export class ItemTable {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  /** 按源取最新 N 条 */
  async listBySource(sourceId: string, limit = 30): Promise<ItemRow[]> {
    const res = await this.db.prepare(`SELECT ${COLS} FROM items WHERE source_id = ? ORDER BY id DESC LIMIT ?`).bind(sourceId, limit).all()
    const rows = (res as any).results ?? (res as any)
    return (rows || []).map(rowToItem)
  }

  /** 按类型取某时间之后的条目（用于推送管线） */
  async listByKindSince(kind: ItemKind, since: string, limit = 200): Promise<ItemRow[]> {
    const res = await this.db.prepare(
      `SELECT ${COLS} FROM items WHERE kind = ? AND first_seen >= ? ORDER BY id DESC LIMIT ?`,
    ).bind(kind, since, limit).all()
    const rows = (res as any).results ?? (res as any)
    return (rows || []).map(rowToItem)
  }

  /** 取某时间之后（含全部来源）的条目，按入库时间倒序 */
  async listSince(since: string, limit = 300): Promise<ItemRow[]> {
    const res = await this.db.prepare(
      `SELECT ${COLS} FROM items WHERE first_seen >= ? ORDER BY id DESC LIMIT ?`,
    ).bind(since, limit).all()
    const rows = (res as any).results ?? (res as any)
    return (rows || []).map(rowToItem)
  }

  /** 取指定来源（如平台热榜）某时间之后的条目 */
  async listSourceSince(sourceIds: string[], since: string, limit = 300): Promise<ItemRow[]> {
    if (!sourceIds.length) return []
    const placeholders = sourceIds.map(() => "?").join(",")
    const res = await this.db.prepare(
      `SELECT ${COLS} FROM items WHERE source_id IN (${placeholders}) AND first_seen >= ? ORDER BY id DESC LIMIT ?`,
    ).bind(...sourceIds, since, limit).all()
    const rows = (res as any).results ?? (res as any)
    return (rows || []).map(rowToItem)
  }

  /** 清理 N 天前的旧条目（用于 retention） */
  async purgeBefore(days: number): Promise<number> {
    const r = await this.db.prepare(
      `DELETE FROM items WHERE first_seen < datetime('now', ?)`,
    ).bind(`-${days} days`).run()
    return (r as any)?.meta?.changes ?? 0
  }

  /** 取某源在某指纹之后的条目 */
  async findByFingerprint(fingerprint: string): Promise<ItemRow | undefined> {
    if (!fingerprint) return undefined
    const r = (await this.db.prepare(`SELECT ${COLS} FROM items WHERE fingerprint = ? LIMIT 1`).bind(fingerprint).get()) as any
    return r ? rowToItem(r) : undefined
  }

  /**
   * 写入条目（按 source_id + url 幂等 upsert）。
   * @returns 是否为本轮新入库（true=新增）
   */
  async upsert(input: ItemInput): Promise<{ added: boolean; row: ItemRow | undefined }> {
    const url = input.url || ""
    const existing = url
      ? (await this.db.prepare(`SELECT ${COLS} FROM items WHERE source_id = ? AND url = ? LIMIT 1`).bind(input.source_id, url).get()) as any
      : undefined

    if (existing) {
      // 已存在：更新时间与摘要/图片等可变字段
      await this.db.prepare(
        `UPDATE items SET last_seen = datetime('now'), summary = ?, image = ?, rank = ?, published_at = ?, fingerprint = ? WHERE id = ?`,
      ).bind(
        input.summary ?? existing.summary ?? "",
        input.image ?? existing.image ?? "",
        input.rank ?? existing.rank ?? null,
        input.published_at ?? existing.published_at ?? "",
        input.fingerprint ?? existing.fingerprint ?? "",
        existing.id,
      ).run()
      return { added: false, row: rowToItem(existing) }
    }

    const r = await this.db.prepare(
      `INSERT INTO items (source_id, kind, title, url, mobile_url, rank, summary, image, published_at, fingerprint, first_seen, last_seen)
       VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'), datetime('now'))`,
    ).bind(
      input.source_id,
      input.kind || "hotlist",
      input.title,
      url,
      input.mobile_url || "",
      input.rank ?? null,
      input.summary || "",
      input.image || "",
      input.published_at || "",
      input.fingerprint || "",
    ).run()
    const id = ((r as any).meta?.last_row_id) ?? undefined
    return { added: true, row: id ? (await this.get(id)) : undefined }
  }

  async get(id: number): Promise<ItemRow | undefined> {
    const r = (await this.db.prepare(`SELECT ${COLS} FROM items WHERE id = ?`).bind(id).get()) as any
    return r ? rowToItem(r) : undefined
  }
}
