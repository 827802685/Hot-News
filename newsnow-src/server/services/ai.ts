import type { HotNewsConfig } from "./config"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ChatOptions {
  temperature?: number
  max_tokens?: number
  /** 覆盖配置（如紧急筛选用更高阈值） */
  model?: string
}

/** 获取 Cloudflare Worker 环境绑定（含 Workers AI）。 */
export function getEnvAI(): any {
  return (globalThis as any).__env__?.AI
}

/** AI 是否已可调用：workersai 只需绑定，openai 需要 base_url + api_key */
export function aiReady(cfg: HotNewsConfig): boolean {
  if (!cfg.ai?.enabled) return false
  if (cfg.ai.provider === "workersai") return !!getEnvAI()
  return !!(cfg.ai?.base_url && cfg.ai?.api_key)
}

/** 兼容多种 Workers AI 返回结构，抽取文本 */
function extractText(res: any): string {
  if (typeof res === "string") return res
  const candidates = [res?.response, res?.result, res?.translated_text]
  for (const c of candidates) {
    if (typeof c === "string" && c) return c
  }
  const out = res?.output
  if (out && typeof out === "object") {
    for (const c of [out.response, out.result, out.text]) {
      if (typeof c === "string" && c) return c
    }
  }
  return ""
}

/** 调用 Cloudflare Workers AI 免费模型（chat 形态） */
async function workersAIChat(model: string, messages: ChatMessage[], temperature: number, max_tokens: number): Promise<string> {
  const AI = getEnvAI()
  if (!AI) throw new Error("Workers AI 未绑定（需要在 wrangler 配置 [[ai_bindings]]）")
  const res = await AI.run(model, {
    messages,
    temperature,
    max_tokens,
    stream: false,
  })
  const content = extractText(res)
  if (!content) throw new Error("Workers AI 响应缺少内容")
  return content.trim()
}

/**
 * 统一 AI 调用：
 * - provider=workersai → env.AI.run（免费模型，无需 key）
 * - provider=openai    → 任意 OpenAI 兼容 API（/v1/chat/completions）
 */
export async function chatAI(cfg: HotNewsConfig, messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const temperature = opts.temperature ?? cfg.ai.temperature ?? 0.8
  const maxTokens = opts.max_tokens ?? cfg.ai.max_tokens ?? 4000
  const model = opts.model || cfg.ai.model

  if (cfg.ai.provider === "workersai") {
    return workersAIChat(model, messages, temperature, maxTokens)
  }

  const base = (cfg.ai.base_url || "").replace(/\/+$/, "")
  if (!base || !cfg.ai.api_key) {
    throw new Error("AI 未配置 base_url 或 api_key")
  }
  const url = `${base}/chat/completions`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.ai.api_key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`AI HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = await res.json() as any
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== "string") {
    throw new Error("AI 响应缺少 content")
  }
  return content.trim()
}

/**
 * AI 筛选「紧急消息」：按指定关注类型判断紧急程度，返回 0-1 分数与是否命中。
 * 要求模型只输出 JSON：{"is_urgent":bool,"score":0-1,"type":"..."}
 */
export async function aiJudgeUrgent(cfg: HotNewsConfig, news: { title: string; summary?: string; source?: string }[]): Promise<{ index: number; score: number; type: string }[]> {
  const list = news.map((n, i) => `${i}. [${n.source || "未知"}] ${n.title}${n.summary ? ` — ${n.summary.slice(0, 80)}` : ""}`).join("\n")
  const system = [
    `你是紧急新闻研判助手。根据给定的关注类型，判断每条新闻是否属于「紧急/突发」级别，并给出紧急程度分数。`,
    `关注类型：${cfg.urgent.types.join("、")}`,
    `紧急级别定义：重大突发事件、市场剧烈波动、重大产品/政策发布、业界重磅爆料等，属于普通用户需要立刻知道的消息。`,
    `严格只输出 JSON 数组，不要任何其他文字，格式：[{"index":0,"score":0.9,"type":"重大突发事件"}, ...]，只包含判定为紧急（score>=${cfg.urgent.min_score}）的条目。`,
  ].join("\n")
  const answer = await chatAI(cfg, [
    { role: "system", content: system },
    { role: "user", content: list },
  ], { temperature: 0.2, max_tokens: 2000 })
  try {
    const start = answer.indexOf("[")
    const end = answer.lastIndexOf("]")
    const arr = JSON.parse(answer.slice(start, end + 1)) as { index: number; score: number; type: string }[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 通用 AI 筛选（按兴趣/关键词），返回命中的条目原文（逐条输出 json 或 true/false 列表） */
export async function aiFilter(cfg: HotNewsConfig, titles: string[]): Promise<boolean[]> {
  const system = `你是新闻筛选助手。根据用户兴趣：${cfg.filter.interests}，判断每条新闻是否值得关注。严格只输出 JSON 布尔数组，如 [true,false,true]，不要其他文字。`
  const answer = await chatAI(cfg, [
    { role: "system", content: system },
    { role: "user", content: titles.map((t, i) => `${i}. ${t}`).join("\n") },
  ], { temperature: 0.2, max_tokens: 1000 })
  try {
    const arr = JSON.parse(answer) as boolean[]
    return titles.map((_, i) => Boolean(arr[i]))
  } catch {
    return titles.map(() => false)
  }
}
