-- 0000_init.sql
-- Hot-News 消息记录表（D1 表结构只在首次部署时通过迁移应用，之后部署不会重复创建）
CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  msg_id       TEXT UNIQUE NOT NULL,
  title        TEXT DEFAULT '',
  content      TEXT NOT NULL,
  push_status  TEXT NOT NULL DEFAULT 'sent',
  push_detail  TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);