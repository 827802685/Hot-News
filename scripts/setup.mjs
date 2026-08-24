#!/usr/bin/env node
/**
 * Hot-News 一键初始化脚本
 *
 * 作用：在【首次部署】时创建 D1 数据库与 KV 命名空间，并把真实 ID 回填到
 *       wrangler.toml，最后应用 D1 迁移建表。
 *
 * “只在第一次部署创建”的保证：
 *   - 脚本会检查 wrangler.toml 中 D1 database_id 与 KV 的 id 是否仍是占位符；
 *   - 若已是真实 ID（说明第一次已创建/回填过），则跳过创建，直接应用迁移，
 *     从而避免重复创建资源。
 *
 * 用法：
 *   npm install
 *   npm run setup            # 首次：创建 D1 + KV + 迁移
 *   npm run setup            # 再次：仅应用迁移（幂等，不会重复创建）
 *   npx wrangler secret put WECOM_WEBHOOK_KEY   # 设置企业微信群机器人 key
 *
 * 前置：已登录 wrangler（npx wrangler login）。
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(__dirname, '..');
const WRANGLER_TOML = path.join(WORKSPACE, 'wrangler.toml');

const D1_NAME = 'hot-news-db';
const KV_BINDING = 'PUSH_KV';
const PLACEHOLDER = /PASTE_[A-Z_]+_HERE/g;

/** 运行命令并返回 stdout，失败时抛出可读错误 */
function run(cmd) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: WORKSPACE, encoding: 'utf-8' });
}

/** 从 wrangler 输出里尽量提取 JSON 结果 */
function tryParseJson(raw) {
  const m = raw.match(/\{[\s\S]*?\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch { /* ignore */ }
  }
  return null;
}

/** 提取并回填 D1 与 KV 的 ID 到 wrangler.toml */
function fillIds(d1Id, kvId) {
  let content = readFileSync(WRANGLER_TOML, 'utf-8');

  let changed = false;
  if (d1Id && content.includes('PASTE_D1_DATABASE_ID_HERE')) {
    content = content.replace('PASTE_D1_DATABASE_ID_HERE', d1Id);
    changed = true;
  }
  if (kvId && content.includes('PASTE_KV_NAMESPACE_ID_HERE')) {
    content = content.replace('PASTE_KV_NAMESPACE_ID_HERE', kvId);
    changed = true;
  }

  if (changed) {
    writeFileSync(WRANGLER_TOML, content);
    console.log('✓ 已把资源 ID 回填到 wrangler.toml');
  }
  return changed;
}

function hasPlaceholder() {
  return PLACEHOLDER.test(readFileSync(WRANGLER_TOML, 'utf-8'));
}

/** 创建 D1 数据库（仅首次） */
function ensureD1() {
  if (!hasPlaceholderMatching('PASTE_D1_DATABASE_ID_HERE')) {
    console.log('→ D1 database_id 已配置，跳过创建（符合“只在首次部署创建”）。');
    return null;
  }
  const out = run(`npx wrangler d1 create ${D1_NAME}`);
  const parsed = tryParseJson(out);
  // wrangler v3 输出形如：<hidden> ... { "success":true, "result": { "database_id": "...", "name": "..." } }
  const d1Id = parsed?.result?.[0]?.database_id
    ?? parsed?.result?.database_id
    ?? out.match(/database_id["' :=]+\s*([a-zA-Z0-9-]{20,})/)?.[1];
  if (!d1Id) throw new Error('无法从 wrangler d1 create 输出中解析 database_id：\n' + out);
  console.log(`✓ 已创建 D1 数据库 ${D1_NAME} (${d1Id})`);
  return d1Id;
}

/** 创建 KV 命名空间（仅首次） */
function ensureKV() {
  if (!hasPlaceholderMatching('PASTE_KV_NAMESPACE_ID_HERE')) {
    console.log('→ KV 命名空间 id 已配置，跳过创建（符合“只在首次部署创建”）。');
    return null;
  }
  const out = run(`npx wrangler kv namespace create ${KV_BINDING.toLowerCase()}`);
  const parsed = tryParseJson(out);
  // wrangler v3 输出形如：... { "success":true, "result": [{ "id": "...", "binding": "PUSH_KV" }] }
  const kvId = parsed?.result?.[0]?.id
    ?? parsed?.result?.id
    ?? out.match(/(?:["']id["']|^id)[:=]\s*"?([a-zA-Z0-9]{32})/m)?.[1];
  if (!kvId) throw new Error('无法从 wrangler kv namespace create 输出中解析 id：\n' + out);
  console.log(`✓ 已创建 KV 命名空间 ${KV_BINDING} (${kvId})`);
  return kvId;
}

function hasPlaceholderMatching(token) {
  return readFileSync(WRANGLER_TOML, 'utf-8').includes(token);
}

/** 应用 D1 迁移（幂等） */
function applyMigrations() {
  run(`npx wrangler d1 migrations apply ${D1_NAME} --remote`);
  console.log('✓ D1 迁移已应用（建表成功）');
}

function main() {
  console.log('=== Hot-News 初始化开始 ===');

  if (!hasPlaceholder()) {
    console.log('→ wrangler.toml 已包含真实资源 ID，跳过资源创建，直接应用迁移。');
  }

  // 先创建 D1 再创建 KV（这一步只在首次部署执行创建）
  const d1Id = ensureD1();
  const kvId = ensureKV();

  if (d1Id || kvId) {
    fillIds(d1Id, kvId);
  } else {
    console.log('→ 无需回填 ID。');
  }

  applyMigrations();

  console.log('=== 初始化完成 ===');
  console.log('下一步：');
  console.log('  1) npx wrangler secret put WECOM_WEBHOOK_KEY');
  console.log('  2) npm run deploy');
}

try {
  main();
} catch (e) {
  console.error('✗ 初始化失败：', e.message);
  process.exit(1);
}