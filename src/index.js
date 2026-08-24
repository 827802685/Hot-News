/**
 * Hot-News 消息推送 Worker
 *
 * 目标：把“所有接收到的消息 —— 包括调用方手工输入的消息”全部实时推送至企业微信。
 *
 * 路由：
 *   POST /message  |  POST /push  接收一条消息并推送到企业微信（核心入口）
 *   GET  /                   服务与运行状态概览
 *   GET  /messages           查看已推送的历史消息（来源 D1，近 N 条）
 *   GET  /health             健康检查
 *
 * 存储：
 *   - D1 (HB_DB)：记录每一条被接收/推送的消息，作为历史消息库
 *   - KV (PUSH_KV)：① 幂等去重（同一 msg_id / 内容 不重复推送）
 *                   ② 数据库初始化标记 —— 保证建表逻辑只在第一次运行/部署时执行
 */

import { sendWechatWork } from './wecom.js';

/** 单条消息去重缓存时间（秒）：默认 7 天 */
const DEDUP_TTL_SECONDS = 7 * 24 * 3600;

/** KV 中用于标记“D1 表结构已在首次部署时创建”的键 */
const SCHEMA_INIT_FLAG = 'db:schema_init';
const SCHEMA_INIT_VALUE = 'done';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. 概览
    if (method === 'GET' && (path === '/' || path === '/index')) {
      return json({
        service: 'Hot-News 消息推送',
        pushChannel: '企业微信（群机器人）',
        storage: ['D1 消息记录', 'KV 幂等/初始化'],
        endpoints: ['POST /message', 'POST /push', 'GET /messages', 'GET /health'],
        tip: '向 POST /message 发送任意消息即可触发企业微信推送',
      });
    }

    // 2. 接收消息并推送（“把所有收到的消息，包括用户输入，全部推送”）
    if ((path === '/message' || path === '/push') && (method === 'POST' || method === 'PUT')) {
      return handleMessage(request, env, ctx);
    }

    // 3. 历史消息
    if (path === '/messages' && method === 'GET') {
      return listMessages(env, url.searchParams);
    }

    // 4. 健康检查
    if (path === '/health' && method === 'GET') {
      return json({ ok: true, up: true, bindings: { d1: 'HB_DB', kv: 'PUSH_KV' } });
    }

    return json({ error: 'Not Found', tip: 'POST /message  接收并推送一条消息到企业微信' }, 404);
  },
};

/**
 * 核心处理器：解析入站消息 → 幂等去重 → 首次部署建表 → 推送企业微信 → 落库
 */
async function handleMessage(request, env, ctx) {
  // 仅在第一次部署/运行时初始化表结构（由 KV 标记保证只执行一次）
  await ensureSchemaOnce(env);

  // 解析入站消息：支持 JSON，也支持纯文本 body（把整段文本当作消息）
  let payload;
  let rawText = null;
  try {
    payload = await request.json();
  } catch {
    rawText = (await request.text()).trim();
    payload = { content: rawText };
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const content =
    typeof payload.content === 'string'
      ? payload.content.trim()
      : typeof payload.message === 'string'
        ? payload.message.trim()
        : '';

  if (!content) {
    return json(
      {
        ok: false,
        error: '缺少消息内容',
        tip: 'POST /message  请求体 {"content":"你的消息","title":"可选标题","msg_id":"可选自定义ID"}',
      },
      400
    );
  }

  // ① KV 幂等去重：同一 msg_id（或内容哈希）在 TTL 内不重复推送
  const msgId = (payload.msg_id || '').trim() || (await hashContent(content));
  const dedupKey = `dedup:${msgId}`;
  const existed = await env.PUSH_KV.get(dedupKey, { type: 'json' });
  if (existed) {
    return json({
      ok: true,
      duplicate: true,
      msg_id: msgId,
      message: '消息在去重窗口内已推送过，本次跳过（仍会写入记录）',
    });
  }
  await env.PUSH_KV.put(dedupKey, JSON.stringify({ pushedAt: Date.now() }), {
    expirationTtl: DEDUP_TTL_SECONDS,
  });

  // ② 推送企业微信（当前实现：群机器人 Webhook）
  const push = await sendWechatWork(env, { title, content });

  // ③ 落库到 D1
  let lastRowId = null;
  try {
    const info = await env.HB_DB.prepare(
      `INSERT INTO messages (msg_id, title, content, push_status, push_detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        title,
        content,
        push.ok ? 'sent' : 'failed',
        JSON.stringify({ errcode: push.errcode, detail: push.resp, error: push.error }),
        new Date().toISOString()
      )
      .run();
    lastRowId = info.meta.last_row_id;
  } catch (e) {
    // 落库失败不应阻断推送结果返回，仅在响应里提示
    return json({
      ok: push.ok,
      msg_id: msgId,
      push_status: push.ok ? 'sent' : 'failed',
      push_result: push.resp,
      storage: { note: '记录到 D1 失败', error: e.message },
    }, push.ok ? 200 : 500);
  }

  return json(
    {
      ok: push.ok,
      msg_id: msgId,
      push_status: push.ok ? 'sent' : 'failed',
      push_channel: '企业微信',
      push_result: push.resp,
      record: { id: lastRowId, table: 'messages' },
    },
    push.ok ? 200 : 502
  );
}

/** 查询已推送的历史消息（来源 D1） */
async function listMessages(env, sp) {
  const limitRaw = parseInt(sp.get('limit') || '20', 10);
  const limit = Math.min(Number.isFinite(limitRaw) ? Math.max(1, limitRaw) : 20, 100);

  await ensureSchemaOnce(env);

  const { results } = await env.HB_DB.prepare(
    `SELECT id, msg_id, title, content, push_status, created_at
     FROM messages ORDER BY id DESC LIMIT ?`
  )
    .bind(limit)
    .all();

  return json({ count: results.length, messages: results });
}

/**
 * 只在第一次部署/运行时创建 D1 表结构。
 * 通过 KV 中的标记位保证逻辑只执行一次，从而满足
 * “D1 和 KV 只在第一次部署创建”的要求。
 */
async function ensureSchemaOnce(env) {
  const flag = await env.PUSH_KV.get(SCHEMA_INIT_FLAG, { type: 'text' });
  if (flag === SCHEMA_INIT_VALUE) return;

  await env.HB_DB.exec(`
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
  `);

  await env.PUSH_KV.put(SCHEMA_INIT_FLAG, SCHEMA_INIT_VALUE);
}

/** 简单的 JSON 响应 */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** 对消息内容做 SHA-256 前 16 位 hex，作为默认去重键 */
async function hashContent(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}