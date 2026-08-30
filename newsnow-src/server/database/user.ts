import type { Database } from "db0"
import type { UserInfo } from "#/types"

/**
 * 统一用户表（users）：合并 newsnow 原 user 表与 legacy KV 管理员账号。
 * - 普通用户：GitHub OAuth 登录，data 存前端自定义展示
 * - 管理员：邮箱 + 密码（password_hash），role = "admin"
 */
export class UserTable {
  private db: Database
  constructor(db: Database) {
    this.db = db
  }

  async init() {
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        role TEXT DEFAULT 'user',
        password_hash TEXT,
        data TEXT DEFAULT '{}',
        type TEXT,
        created INTEGER,
        updated INTEGER
      );
    `).run()
    await this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`).run()
  }

  /** GitHub OAuth 新增/更新用户（普通用户） */
  async addUser(id: string, email: string, type: "github") {
    const u = await this.getUser(id)
    const now = Date.now()
    if (!u) {
      await this.db.prepare(`INSERT INTO users (id, email, role, password_hash, data, type, created, updated) VALUES (?, ?, 'user', '', '{}', ?, ?, ?)`)
        .run(id, email, type, now, now)
    } else if (u.email !== email && u.type !== type) {
      await this.db.prepare(`UPDATE users SET email = ?, updated = ? WHERE id = ?`).run(email, now, id)
    }
  }

  async getUser(id: string) {
    return (await this.db.prepare(`SELECT id, email, role, data, type, created, updated FROM users WHERE id = ?`).get(id)) as any
  }

  async getUserByEmail(email: string) {
    return (await this.db.prepare(`SELECT id, email, role, password_hash, data, type, created, updated FROM users WHERE email = ?`).get(email)) as any
  }

  /** 前端自定义展示 data */
  async setData(id: string, value: string, updatedTime = Date.now()) {
    await this.db.prepare(`UPDATE users SET data = ?, updated = ? WHERE id = ?`).run(value, updatedTime, id)
  }

  async getData(id: string) {
    const row: any = await this.db.prepare(`SELECT data, updated FROM users WHERE id = ?`).get(id)
    if (!row) throw new Error(`user ${id} not found`)
    return row as { data: string; updated: number }
  }

  /** 管理员：创建/更新管理员账号（首次 setup 时调用） */
  async upsertAdmin(id: string, email: string, passwordHash: string) {
    const now = Date.now()
    await this.db.prepare(
      `INSERT INTO users (id, email, role, password_hash, data, type, created, updated)
       VALUES (?, ?, 'admin', ?, '{}', 'email', ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash, role = 'admin', updated = excluded.updated`,
    ).bind(id, email, passwordHash, now, now).run()
  }

  async setPassword(id: string, passwordHash: string) {
    await this.db.prepare(`UPDATE users SET password_hash = ?, updated = ? WHERE id = ?`).run(passwordHash, Date.now(), id)
  }

  async listUsers(): Promise<UserInfo[]> {
    const res = await this.db.prepare(`SELECT id, email, role, data, type, created, updated FROM users ORDER BY created ASC`).all()
    return ((res as any).results ?? (res as any)) || []
  }

  async deleteUser(id: string) {
    await this.db.prepare(`DELETE FROM users WHERE id = ?`).run(id)
  }
}
