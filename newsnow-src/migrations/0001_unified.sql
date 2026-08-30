-- 0001_unified.sql — 统一数据层（单 D1）
-- 目标：把旧 hot-news-db(DB 绑定) 与 newsnow-db(NEWSNOW_DB 绑定) 合并为单库，
--       结构性数据（源/订阅/配置/用户）从 KV 迁入 D1，KV 只保留 会话/锁/翻译缓存/去重。
-- 应用方式：wrangler d1 migrations apply <db>（或运行时 ensureSchema 幂等执行）。

-- ── 1) 统一「源/订阅」表 ──────────────────────────────────────────────
-- 替代：legacy KV hotnews:subscriptions；同时承载 newsnow 内置源与自定义 RSS/TG/平台热榜。
-- kind: builtin | rss | telegram | platform | custom
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'rss',
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  url TEXT DEFAULT '',
  column TEXT DEFAULT 'focus',       -- newsnow 前端列（focus/home/tech/...）
  color TEXT DEFAULT 'primary',
  interval INTEGER DEFAULT 600000,   -- 刷新间隔 ms
  enabled INTEGER DEFAULT 1,         -- 前端是否展示
  pull_enabled INTEGER DEFAULT 1,    -- 是否参与推送管线
  pull_times TEXT DEFAULT '[]',      -- 指定推送时段 JSON 数组
  meta TEXT DEFAULT '{}',            -- platformId / tg 频道 / 源参数等
  created INTEGER,
  updated INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources(kind);

-- ── 2) 统一「新闻条目」表 ─────────────────────────────────────────────
-- 替代：legacy DB 的 news_items / rank_history / rss_items。
-- kind: hotlist(平台热榜) | rss | telegram | custom
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
  fingerprint TEXT DEFAULT '',       -- 去重指纹（标题/内容哈希）
  first_seen TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_fingerprint ON items(fingerprint);
CREATE INDEX IF NOT EXISTS idx_items_published ON items(published_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_source_url ON items(source_id, url) WHERE url != '';

-- ── 3) 统一「用户」表 ─────────────────────────────────────────────────
-- 替代：newsnow D1 user 表 + legacy KV hotnews:auth:* / hotnews:session:*。
-- role: admin(管理员) | user(普通登录用户)。data 存前端自定义展示。
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'user',
  password_hash TEXT,
  data TEXT DEFAULT '{}',
  type TEXT,                         -- github / email
  created INTEGER,
  updated INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ── 4) 统一「配置」表 ─────────────────────────────────────────────────
-- 替代：legacy KV hotnews:config（整包大 JSON）。
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ── 5) 推送记录 ───────────────────────────────────────────────────────
-- kind: urgent(紧急消息) | digest(四时段整合) | daily(日报) | weekly(周报)
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

-- ── 6) 抓取记录 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_time TEXT NOT NULL UNIQUE,
  kind TEXT DEFAULT 'hotlist',
  total_items INTEGER DEFAULT 0,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── 7) 前端源快照（保留 newsnow 原 cache 表，供 /api/s 卡片墙）────────
CREATE TABLE IF NOT EXISTS cache (
  id TEXT PRIMARY KEY,
  updated INTEGER,
  data TEXT
);
