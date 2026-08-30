/**
 * 统一数据层 schema 初始化
 *
 * 与 migrations/0001_unified.sql 保持一致，运行时可幂等执行（CREATE TABLE IF NOT EXISTS）。
 * 单库合并：所有表建在同一个 D1（NEWSNOW_DB）上。
 */
export const UNIFIED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'rss',
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  url TEXT DEFAULT '',
  column TEXT DEFAULT 'focus',
  color TEXT DEFAULT 'primary',
  interval INTEGER DEFAULT 600000,
  enabled INTEGER DEFAULT 1,
  pull_enabled INTEGER DEFAULT 1,
  pull_times TEXT DEFAULT '[]',
  meta TEXT DEFAULT '{}',
  created INTEGER,
  updated INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources(kind);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  kind TEXT DEFAULT 'hotlist',
  title TEXT NOT NULL,
  url TEXT DEFAULT '',
  mobile_url TEXT DEFAULT '',
  rank INTEGER,
  summary TEXT DEFAULT '',
  image TEXT DEFAULT '',
  published_at TEXT,
  fingerprint TEXT DEFAULT '',
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_fingerprint ON items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_source_url ON items(source_id, url) WHERE url != '';

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
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS push_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  push_time TEXT NOT NULL,
  channel TEXT DEFAULT '',
  kind TEXT DEFAULT 'digest',
  item_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_records_date ON push_records(date);

CREATE TABLE IF NOT EXISTS crawl_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_time TEXT NOT NULL UNIQUE,
  kind TEXT DEFAULT 'hotlist',
  total_items INTEGER DEFAULT 0,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`

/**
 * 幂等初始化统一 schema（部署/首次运行/定时任务启动时调用）。
 * @returns 是否成功
 */
export async function ensureUnifiedSchema(db: { exec: (sql: string) => Promise<unknown> }): Promise<boolean> {
  if (!db) return false
  try {
    await db.exec(UNIFIED_SCHEMA_SQL)
    return true
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("ensureUnifiedSchema failed", e)
    return false
  }
}
