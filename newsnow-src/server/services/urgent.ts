import { ItemTable } from "../database/items"
import { aiJudgeUrgent, aiReady } from "./ai"
import { translateToZh } from "./translate"
import { push } from "./channels"
import { DedupStore, contentFingerprint } from "./dedup"
import { todayStr, nowMinuteStr } from "./format"
import { logger } from "../utils/logger"
import type { HotNewsConfig } from "./config"

/**
 * 紧急消息即时推送（15 分钟轮）
 * - 从统一 items 表取「上一轮之后新入库」的条目作为候选
 * - 由 AI 按可配置的关注类型（cfg.urgent.types）研判紧急程度
 * - 命中且当日未推（KV 去重 scope=urgent）→ 立即推送到所有已配置渠道
 */

export interface UrgentResult {
  skipped?: boolean
  candidates: number
  hits: number
  pushed: number
  errors: string[]
  push: { channel: string; ok: boolean; error?: string }[]
}

export async function runUrgentPush(cfg: HotNewsConfig, env: any, db: any): Promise<UrgentResult> {
  const res: UrgentResult = { candidates: 0, hits: 0, pushed: 0, errors: [], push: [] }
  if (!cfg.urgent?.enabled) {
    res.skipped = true
    return res
  }
  if (!cfg.ai?.enabled) {
    res.skipped = true
    return res
  }
  if (!aiReady(cfg)) {
    res.skipped = true
    return res
  }
  const kv = env?.KV
  const tz = cfg.app.timezone || "Asia/Shanghai"
  const today = todayStr(tz)

  // 上一轮紧急检查时间（KV）
  let since = new Date(Date.now() - 15 * 60000).toISOString()
  try {
    const last = kv ? await kv.get("hotnews:urgent:last") : null
    if (last) since = new Date(Math.max(Date.parse(last) - 60000, Date.now() - 60 * 60000)).toISOString()
  } catch { /* ignore */ }

  const table = new ItemTable(db)
  let candidates: any[] = []
  try {
    candidates = await table.listSince(since, 80)
  } catch (e: any) {
    res.errors.push(`查询候选失败: ${e.message}`)
    return res
  }
  res.candidates = candidates.length
  if (!candidates.length) {
    await saveLastUrgent(kv)
    return res
  }

  const judged = await aiJudgeUrgent(cfg, candidates.map(n => ({ title: n.title, summary: n.summary, source: n.source_id })))
  const hits = judged
    .filter(j => j && j.score >= (cfg.urgent.min_score ?? 0.8))
    .slice(0, cfg.urgent.max_per_round || 5)
  res.hits = hits.length

  const dedup = new DedupStore(kv)
  for (const hit of hits) {
    const it = candidates[hit.index]
    if (!it) continue
    const fp = contentFingerprint(it.title || "", it.image || "")
    if (!(await dedup.markPushed("urgent", fp, today))) continue // 当日已推过

    // 英文内容先翻译成中文（失败回退原文）
    let title = it.title || "(无标题)"
    let summary = it.summary || ""
    if (cfg.ai_translation?.enabled && /[\x00-\x7F]/.test(title)) {
      title = await translateToZh(cfg, title, kv)
    }
    if (summary && cfg.ai_translation?.enabled && /[\x00-\x7F]/.test(summary)) {
      summary = await translateToZh(cfg, summary, kv)
    }

    const type = hit.type || "紧急消息"
    const score = Math.round(hit.score * 100)
    const lines = [
      `🚨 紧急 · ${nowMinuteStr(tz)} · ${type} (${score})`,
      `【${it.source_id}】${title}`,
    ]
    const s = String(summary || "").replace(/\n+/g, " ").trim()
    if (s) lines.push(s.slice(0, 160))
    if (it.url) lines.push(`🔗 ${it.url}`)
    const text = lines.join("\n")

    try {
      const pr = await push(cfg, text, { env })
      res.push.push(...pr)
      res.pushed++
      logger.success(`urgent push #${res.pushed} [${it.source_id}] ${title.slice(0, 40)}`)
    } catch (e: any) {
      res.errors.push(`推送失败: ${e.message}`)
    }
  }

  // 记录（有推送才记，避免刷记录表）
  if (res.pushed) {
    try {
      const r = new (await import("../database/records")).RecordTable(db)
      await r.addPushRecord({ date: today, push_time: new Date().toISOString(), channel: "all", kind: "urgent", item_count: res.pushed })
    } catch { /* ignore */ }
  }
  await saveLastUrgent(kv)
  return res
}

async function saveLastUrgent(kv: any) {
  try {
    if (kv) await kv.put("hotnews:urgent:last", new Date().toISOString())
  } catch { /* ignore */ }
}
