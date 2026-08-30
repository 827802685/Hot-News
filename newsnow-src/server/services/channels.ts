import type { ChannelCfg, HotNewsConfig } from "./config"

/**
 * 10 个推送渠道：飞书 / 钉钉 / 企业微信 / Telegram / 邮件(Resend) / ntfy / Bark / Slack / 通用Webhook / QQ官方机器人
 * 全部保留（QQ 留作将来使用）。
 */

export interface PushResult {
  channel: string
  ok: boolean
  error?: string
}

/** 轻量 fetch，带超时 */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeout = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ---- 飞书 ----
async function sendFeishu(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { webhook_url } = ch
  if (!webhook_url) return { channel: "feishu", ok: false, error: "未配置 Webhook" }
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: "text", content: { text } }),
    })
    const data = await res.json().catch(() => null)
    const ok = res.ok && data && data.code === 0
    return { channel: "feishu", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "feishu", ok: false, error: e.message }
  }
}

// ---- 钉钉 ----
async function sendDingtalk(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { webhook_url } = ch
  if (!webhook_url) return { channel: "dingtalk", ok: false, error: "未配置 Webhook" }
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "text", text: { content: text } }),
    })
    const data = await res.json().catch(() => null)
    const ok = res.ok && data && data.errcode === 0
    return { channel: "dingtalk", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "dingtalk", ok: false, error: e.message }
  }
}

// ---- 企业微信（带频率限制与 429 重试）----
const weworkRateLast = new Map<string, number>()
const WEWORK_PER_MIN = 5
async function weworkThrottle(url: string) {
  const now = Date.now()
  const last = weworkRateLast.get(url) || 0
  const gap = 20 * 1000 / WEWORK_PER_MIN
  const wait = last + gap - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  weworkRateLast.set(url, Date.now())
}
async function sendWework(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { webhook_url, msg_type = "markdown" } = ch
  if (!webhook_url) return { channel: "wework", ok: false, error: "未配置 Webhook" }
  const body = msg_type === "markdown"
    ? { msgtype: "markdown", markdown: { content: text } }
    : { msgtype: "text", text: { content: text } }
  const maxTry = 4
  for (let attempt = 0; attempt <= maxTry; attempt++) {
    await weworkThrottle(webhook_url)
    try {
      const res = await fetchWithTimeout(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      const is429 = res.status === 429 || (data && data.errcode === 45009)
      if (is429) {
        await new Promise(r => setTimeout(r, 6000 * (attempt + 1)))
        continue
      }
      const ok = res.ok && data && data.errcode === 0
      return { channel: "wework", ok, error: ok ? undefined : `HTTP ${res.status}` }
    } catch (e: any) {
      return { channel: "wework", ok: false, error: e.message }
    }
  }
  return { channel: "wework", ok: false, error: "HTTP 429 (过多请求)" }
}

// ---- Telegram ----
async function sendTelegram(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { bot_token, chat_id } = ch
  if (!bot_token || !chat_id) return { channel: "telegram", ok: false, error: "未配置 Bot Token/Chat ID" }
  try {
    const res = await fetchWithTimeout(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text: escapeHtml(text), parse_mode: "HTML", disable_web_page_preview: true }),
    })
    const data = await res.json().catch(() => null)
    const ok = !!(data && data.ok)
    return { channel: "telegram", ok, error: ok ? undefined : (data?.description || "发送失败").slice(0, 200) }
  } catch (e: any) {
    return { channel: "telegram", ok: false, error: e.message }
  }
}

// ---- 邮件（Resend）----
async function sendEmail(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { resend_api_key, from, to } = ch
  if (!resend_api_key || !to) return { channel: "email", ok: false, error: "未配置 Resend Key/收件人" }
  try {
    const res = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend_api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: from || "HotNews <onboarding@resend.dev>",
        to: String(to).split(",").map(s => s.trim()).filter(Boolean),
        subject: "热点速报",
        text,
      }),
    })
    const data = await res.json().catch(() => null)
    const ok = !!(data && data.id)
    return { channel: "email", ok, error: ok ? undefined : (data?.message || "发送失败").slice(0, 200) }
  } catch (e: any) {
    return { channel: "email", ok: false, error: e.message }
  }
}

// ---- ntfy ----
async function sendNtfy(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { server_url, topic, token } = ch
  if (!topic) return { channel: "ntfy", ok: false, error: "未配置 Topic" }
  const url = (server_url || "https://ntfy.sh").replace(/\/$/, "") + "/" + topic
  const headers: Record<string, string> = { "Content-Type": "text/plain" }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetchWithTimeout(url, { method: "POST", headers, body: text })
    const ok = res.ok
    return { channel: "ntfy", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "ntfy", ok: false, error: e.message }
  }
}

// ---- Bark ----
async function sendBark(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { url } = ch
  if (!url) return { channel: "bark", ok: false, error: "未配置 URL" }
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "热点速报", body: text }),
    })
    const ok = res.ok
    return { channel: "bark", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "bark", ok: false, error: e.message }
  }
}

// ---- Slack ----
async function sendSlack(ch: ChannelCfg, text: string): Promise<PushResult> {
  const { webhook_url } = ch
  if (!webhook_url) return { channel: "slack", ok: false, error: "未配置 Webhook" }
  try {
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    const ok = res.ok
    return { channel: "slack", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "slack", ok: false, error: e.message }
  }
}

// ---- 通用 Webhook ----
async function sendGeneric(ch: ChannelCfg, text: string, subject?: string): Promise<PushResult> {
  const { webhook_url, payload_template } = ch
  if (!webhook_url) return { channel: "generic_webhook", ok: false, error: "未配置 Webhook" }
  try {
    const template = payload_template || '{"content":"{content}"}'
    const payload = template.replace(/\{title\}/g, subject || "热点速报").replace(/\{content\}/g, text)
    const res = await fetchWithTimeout(webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    })
    const ok = res.ok
    return { channel: "generic_webhook", ok, error: ok ? undefined : `HTTP ${res.status}` }
  } catch (e: any) {
    return { channel: "generic_webhook", ok: false, error: e.message }
  }
}

// ---- QQ 官方机器人（token 缓存于 KV）----
const QQ_TOKEN_KEY = "hotnews:qq:token"
async function getQQToken(env: any, ch: ChannelCfg): Promise<string> {
  if (env?.KV) {
    const cached = await env.KV.get(QQ_TOKEN_KEY, "json").catch(() => null)
    if (cached && cached.access_token && cached.expires_at > Date.now()) return cached.access_token
  }
  const res = await fetch("https://bots.qq.com/app/getAppAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: ch.app_id, clientSecret: ch.app_secret }),
  })
  const data = await res.json() as any
  if (!data || !data.access_token) throw new Error(data.message || "获取 token 失败")
  if (env?.KV) {
    await env.KV.put(QQ_TOKEN_KEY, JSON.stringify({
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in || 7200) * 1000 - 300000,
    }))
  }
  return data.access_token
}
async function sendQQ(ch: ChannelCfg, text: string, env?: any): Promise<PushResult> {
  const { app_id, app_secret, target_type, target_id } = ch
  if (!app_id || !app_secret || !target_id) return { channel: "qq", ok: false, error: "未配置 App ID/Secret/目标" }
  try {
    const token = await getQQToken(env, ch)
    const base = target_type === "c2c"
      ? `/v2/users/${target_id}/messages`
      : target_type === "channel"
        ? `/v2/channels/${target_id}/messages`
        : `/v2/groups/${target_id}/messages`
    const res = await fetchWithTimeout("https://api.sgroup.qq.com" + base, {
      method: "POST",
      headers: { Authorization: `Bot ${app_id}.${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, msg_type: 0 }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { channel: "qq", ok: false, error: `HTTP ${res.status} ${(body?.message || body?.msg || "").trim()}`.trim() }
    }
    if (body?.code && body.code !== 0) {
      return { channel: "qq", ok: false, error: `QQ ${body.code} ${(body.message || body.msg || "").trim()}`.trim() }
    }
    return { channel: "qq", ok: true }
  } catch (e: any) {
    return { channel: "qq", ok: false, error: e.message }
  }
}

const CHANNELS: Record<string, (ch: ChannelCfg, text: string, env?: any, subject?: string) => Promise<PushResult>> = {
  feishu: sendFeishu,
  dingtalk: sendDingtalk,
  wework: sendWework,
  telegram: sendTelegram,
  email: sendEmail,
  ntfy: sendNtfy,
  bark: sendBark,
  slack: sendSlack,
  generic_webhook: sendGeneric,
  qq: sendQQ,
}

/** 渠道是否已配置 */
export function isConfigured(name: string, ch: ChannelCfg): boolean {
  switch (name) {
    case "feishu":
    case "dingtalk":
    case "wework":
    case "slack":
      return !!ch.webhook_url
    case "telegram":
      return !!ch.bot_token && !!ch.chat_id
    case "email":
      return !!ch.resend_api_key && !!ch.to
    case "ntfy":
      return !!ch.topic
    case "bark":
      return !!ch.url
    case "generic_webhook":
      return !!ch.webhook_url
    case "qq":
      return !!ch.app_id && !!ch.app_secret && !!ch.target_id
    default:
      return false
  }
}

/** 已配置的渠道名列表 */
export function configuredChannels(cfg: HotNewsConfig): string[] {
  if (!cfg.notification?.enabled) return []
  const list: string[] = []
  for (const [name, ch] of Object.entries(cfg.notification.channels || {})) {
    if (isConfigured(name, ch)) list.push(name)
  }
  return list
}

/** 统一推送：向所有已配置渠道发送 */
export async function push(cfg: HotNewsConfig, text: string, opts: { subject?: string; env?: any } = {}): Promise<PushResult[]> {
  if (!cfg.notification?.enabled) return []
  const results: PushResult[] = []
  for (const [name, ch] of Object.entries(cfg.notification.channels || {})) {
    if (!isConfigured(name, ch)) continue
    try {
      const r = await CHANNELS[name](ch, text, opts.env, opts.subject)
      results.push(r)
    } catch (e: any) {
      results.push({ channel: name, ok: false, error: e.message })
    }
  }
  return results
}
