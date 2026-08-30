import type { Database } from "db0"

/** 统一配置表：替代 legacy KV hotnews:config（整包大 JSON） */
export class ConfigTable {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async get(key: string): Promise<string | undefined> {
    const r = (await this.db.prepare(`SELECT value FROM config WHERE key = ?`).bind(key).get()) as any
    return r ? r.value : undefined
  }

  async getJSON<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.get(key)
    if (!raw) return undefined
    try {
      return JSON.parse(raw) as T
    } catch {
      return undefined
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(key, value).run()
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value))
  }

  async remove(key: string): Promise<void> {
    await this.db.prepare(`DELETE FROM config WHERE key = ?`).bind(key).run()
  }

  /** 读取整个配置对象（默认合并进 defaults） */
  async getAll(defaults: Record<string, unknown> = {}): Promise<Record<string, any>> {
    const res = await this.db.prepare(`SELECT key, value FROM config`).all()
    const rows = ((res as any).results ?? (res as any)) || []
    const cfg: Record<string, any> = structuredClone(defaults)
    for (const r of rows) {
      try {
        cfg[r.key] = JSON.parse(r.value)
      } catch {
        cfg[r.key] = r.value
      }
    }
    return cfg
  }

  /** 覆盖整份配置（合并到 defaults 之上） */
  async setAll(config: Record<string, unknown>, defaults: Record<string, unknown> = {}): Promise<void> {
    const merged = { ...structuredClone(defaults), ...config }
    const stmt = this.db.prepare(
      `INSERT INTO config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    for (const [k, v] of Object.entries(merged)) {
      await stmt.bind(k, JSON.stringify(v)).run()
    }
  }
}
