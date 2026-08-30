import type { Database } from "db0"

/** 推送 / 抓取 日志表 DAO */
export class RecordTable {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  /** kind: urgent(紧急) | digest(四时段) | daily(日报) | weekly(周报) */
  async addPushRecord(input: {
    date: string
    push_time: string
    channel: string
    kind: string
    item_count: number
  }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO push_records (date, push_time, channel, kind, item_count, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(input.date, input.push_time, input.channel, input.kind, input.item_count).run()
  }

  async addCrawlRecord(input: { crawl_time: string; kind: string; total_items: number; detail?: string }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO crawl_records (crawl_time, kind, total_items, detail, created_at) VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(crawl_time) DO NOTHING`,
    ).bind(input.crawl_time, input.kind, input.total_items, input.detail || "").run()
  }

  async recentPushRecords(limit = 50): Promise<any[]> {
    const res = await this.db.prepare(`SELECT * FROM push_records ORDER BY id DESC LIMIT ?`).bind(limit).all()
    return ((res as any).results ?? (res as any)) || []
  }

  async recentCrawlRecords(limit = 50): Promise<any[]> {
    const res = await this.db.prepare(`SELECT * FROM crawl_records ORDER BY id DESC LIMIT ?`).bind(limit).all()
    return ((res as any).results ?? (res as any)) || []
  }
}
