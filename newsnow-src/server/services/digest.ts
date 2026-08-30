import { ItemTable } from "../database/items"
import { RecordTable } from "../database/records"
import { aiFilter, aiReady, chatAI } from "./ai"
import { translateToZh } from "./translate"
import { push } from "./channels"
import { DedupStore, contentFingerprint } from "./dedup"
import { renderParts, filterByKeywords, dedupeItems, todayStr, nowMinuteStr, recentDateStrs } from "./format"
import { decorate } from "./crawl"
import { logger } from "../utils/logger"
import type { HotNewsConfig } from "./config"

/**
 * 四时段整合推送 + 日报/周报
 * - 四时段（08:00/12:00/17:00/20:00）推送当日整合消息
 * - 日报（默认 21:00，days=1）/ 周报（每周定时，days=7）保留，均带 AI 总结
 * - 内容与紧急消息共用 KV 去重（scope=digest / urgent），同一天同一条只推一次
 */

export type DigestKind = "digest" | "daily" | "weekly"

export interface DigestResult {
  kind: DigestKind
  parts: number
  itemCount: number
  push: { channel: string; ok: boolean; error?: string }[]
}

export async function pushDigest(cfg: HotNewsConfig, env: any, db: any, opts: {
  kind: DigestKind
  days: number
  title: string
  withAnalysis?: boolean
}): Promise<DigestResult | null> {
  const { kind, days, title, withAnalysis } = opts
  const tz = cfg.app.timezone || "Asia/Shanghai"
  const today = todayStr(tz)
  const timeStr = nowMinuteStr(tz)
  const kv = env?.KV
  const dedup = new DedupStore(kv)

  const table = new ItemTable(db)
  const platformIds = (cfg.platforms?.sources || []).map(s => s.id)
  const since = new Date(Date.now() - days * 86400000).toISOString()

  // 拉取区间内数据
  const [platformRows, allRows] = await Promise.all([
    table.listSourceSince(platformIds, since, 300),
    table.listSince(since, 500),
  ])
  const customIds = new Set(allRows.map(r => r.source_id).filter(id => !platformIds.includes(id)))
  const customRows = allRows.filter(r => customIds.has(r.source_id))
  const customRowsSince = customRows.slice(0, 200)

  // 跨轮去重：当日已在紧急/整合推过的不再重复
  const notPushed = async (it: any) => {
    const fp = contentFingerprint(it.title || "", it.image || "")
    if (await dedup.isPushed("urgent", fp, today)) return false
    if (await dedup.isPushed("digest", fp, today)) return false
    await dedup.markPushed("digest", fp, today)
    return true
  }
  const filteredPlatform = []
  for (const it of platformRows) {
    if (await notPushed(it)) filteredPlatform.push(it)
  }
  const filteredCustom = []
  for (const it of customRowsSince) {
    if (await notPushed(it)) filteredCustom.push(it)
  }

  const flat = decorate(filteredPlatform)
  const rss = decorate(filteredCustom)

  // Top：跨平台去重后按 rank 排序取前 N
  const top = dedupeItems(flat).slice(0, cfg.report.top_count || 10)
  const topTitles = new Set(top.map(it => it.title))

  // 关键词 / AI 筛选「热点资讯」
  let matchedHot = filterByKeywords(flat, cfg.filter.keywords).matched.map(m => m.item)
  if (cfg.filter.method === "ai" && aiReady(cfg) && cfg.filter.interests) {
    try {
      const picks = await aiFilter(cfg, flat.slice(0, 100).map(it => it.title))
      matchedHot = flat.filter((_, i) => picks[i])
    } catch (e: any) {
      logger.warn(`AI 筛选失败，回退关键词: ${e.message}`)
    }
  }
  const matchedRss = filterByKeywords(rss, cfg.filter.keywords).matched.map(m => m.item)

  // 热点分组（按平台/关键词）
  const hotGroups: Record<string, any[]> = {}
  if (cfg.report.display_mode === "platform") {
    for (const it of matchedHot) {
      if (topTitles.has(it.title)) continue
      const key = it.platform_name || it.platform_id || "其他"
      ;(hotGroups[key] = hotGroups[key] || []).push(it)
    }
  } else {
    for (const it of matchedHot) {
      if (topTitles.has(it.title)) continue
      const key = it.platform_name || it.platform_id || "其他"
      ;(hotGroups[key] = hotGroups[key] || []).push(it)
    }
  }
  for (const k of Object.keys(hotGroups)) hotGroups[k] = dedupeItems(hotGroups[k])
  const hasHot = Object.keys(hotGroups).length > 0

  // 英文订阅翻译为中文
  if (cfg.ai_translation?.enabled) {
    const toTranslate = [...top, ...matchedHot, ...matchedRss, ...rss]
    for (const it of toTranslate.slice(0, 40)) {
      if (/[\x00-\x7F]/.test(it.title || "")) it._zh = await translateToZh(cfg, it.title || "", kv)
      if (it.summary && /[\x00-\x7F]/.test(it.summary)) it._zhSummary = await translateToZh(cfg, it.summary, kv)
    }
  }

  // AI 总结（日报/周报，每日首推生成）
  let analysis: string | null = null
  if (withAnalysis && cfg.ai_analysis?.enabled && aiReady(cfg)) {
    try {
      analysis = await aiAnalyze(cfg, flat.slice(0, cfg.ai_analysis.max_news_for_analysis || 100))
    } catch (e: any) {
      logger.warn(`AI 总结失败: ${e.message}`)
    }
  }

  const hasContent = top.length > 0 || hasHot || matchedRss.length > 0 || rss.length > 0 || !!analysis
  if (!hasContent) {
    logger.info(`digest[${kind}] 无内容，跳过`)
    return null
  }

  const parts = renderParts(cfg, {
    title: `${cfg.app.title || "Hot News"} ${title}`,
    timeStr,
    top,
    topCount: cfg.report.top_count || 10,
    hotlist: hasHot ? { groups: hotGroups, mode: cfg.report.display_mode } : null,
    rss: matchedRss,
    rssAlways: rss,
    analysis,
    footnote: days >= 7 ? `${recentDateStrs(tz, days)[0]} ~ ${recentDateStrs(tz, days)[days - 1]} 数据汇总` : undefined,
  })

  const pushResults: { channel: string; ok: boolean; error?: string }[] = []
  for (const part of parts) {
    try {
      pushResults.push(...await push(cfg, part.text, { env, subject: title }))
    } catch (e: any) {
      pushResults.push({ channel: "all", ok: false, error: e.message })
    }
  }

  const itemCount = top.length + matchedHot.length + matchedRss.length + rss.length
  try {
    await new RecordTable(db).addPushRecord({ date: today, push_time: new Date().toISOString(), channel: "all", kind, item_count: itemCount })
  } catch { /* ignore */ }

  logger.success(`digest[${kind}] ${title} pushed ${parts.length} parts / ${itemCount} items`)
  return { kind, parts: parts.length, itemCount, push: pushResults }
}

/** AI 总结当日热点（2-3 句） */
export async function aiAnalyze(cfg: HotNewsConfig, items: any[]): Promise<string | null> {
  if (!items.length) return null
  const list = items.slice(0, 80).map((it, i) => `${i + 1}. [${it.platform_name || it.source_id}] ${it.title}`).join("\n")
  const system = `你是热点新闻分析助手。根据下列当日热点，用中文输出 2-3 句话的总结：先点出 1-2 件最重要的事，再给一句趋势判断。不要用列表。`
  try {
    const answer = await chatAI(cfg, [
      { role: "system", content: system },
      { role: "user", content: list },
    ], { temperature: 0.6, max_tokens: 500 })
    return answer.trim() || null
  } catch {
    return null
  }
}
