import type { HotNewsConfig } from "./config"
import type { ItemRow } from "../database/items"

/**
 * 文本/日期格式化工具：统一给 抓取→筛选→渲染→推送 使用。
 * 时区相关全部用 Intl 实现（Cloudflare Workers 可用，不依赖 node 时区数据库）。
 */

const DEFAULT_TZ = "Asia/Shanghai"

// ---- 时区工具 ----
export function tzParts(date: Date, tz: string = DEFAULT_TZ): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date || new Date())
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  if (map.hour === "24") map.hour = "00"
  return map
}

function tzOffsetMinutes(tz: string, date?: Date): number {
  const p = tzParts(date || new Date(), tz)
  const asUTC = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  const now = date ? date.getTime() : Date.now()
  return Math.round((asUTC - now) / 60000)
}

export function todayStr(tz: string = DEFAULT_TZ): string {
  const p = tzParts(new Date(), tz)
  return `${p.year}-${p.month}-${p.day}`
}

export function nowMinuteStr(tz: string = DEFAULT_TZ): string {
  const p = tzParts(new Date(), tz)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}

export function nowClock(tz: string = DEFAULT_TZ): string {
  const p = tzParts(new Date(), tz)
  return `${p.hour}:${p.minute}`
}

export function localToTs(localStr: string, tz: string = DEFAULT_TZ): number {
  const m = String(localStr).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return Date.now()
  const [, y, mo, d, h, mi] = m
  const offset = tzOffsetMinutes(tz)
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)) - offset * 60000
}

export function isoToDateStr(iso: string, tz: string = DEFAULT_TZ): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const p = tzParts(d, tz)
  return `${p.year}-${p.month}-${p.day}`
}

/** N 天前（含今天）的日期列表，如 days=7 → [今天-6 … 今天] */
export function recentDateStrs(tz: string, days: number): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(isoToDateStr(new Date(Date.now() - i * 86400000).toISOString(), tz))
  }
  return out
}

// ---- 文本处理 ----
export function normalizeTitle(t: string): string {
  return String(t || "").trim().replace(/\s+/g, " ").replace(/[。．.!！?？…]+$/g, "").toLowerCase()
}

export function isMediaPlaceholder(title: string): boolean {
  return /^[\[\uFF08(]?(\u5A92\u4F53\u6D88\u606F|\u65E0\u6807\u9898)[\s@\]\uFF09)]?/.test((title || "").trim())
}

/** 同篇去重键：媒体占位优先用图片/URL 身份，普通内容用规范化标题 */
export function itemDedupKey(it: { title?: string; image?: string; url?: string }): string | null {
  if (isMediaPlaceholder(it.title || "")) {
    if (it.image) return `img:${it.image}`
    if (it.url) return `url:${it.url}`
    return `media-title:${normalizeTitle(it.title || "")}`
  }
  const t = normalizeTitle(it.title || "")
  if (t) return `title:${t}`
  if (it.url) return `url:${it.url}`
  if (it.image) return `img:${it.image}`
  return null
}

/** 智能摘要截断：优先在句末/逗号/顿号等自然断点收尾，避免硬切 */
export function smartClip(t: string, max: number): string {
  t = String(t || "").trim()
  if (t.length <= max) return t
  const windowSize = t.length < max + 60 ? t.length : max + 40
  const part = t.slice(0, windowSize)
  const s = part.search(/[。；;！!？?…\n]/)
  if (s > 6 && s <= max) return part.slice(0, s + 1)
  const p = Math.max(part.lastIndexOf("，"), part.lastIndexOf(","), part.lastIndexOf("、"), part.lastIndexOf(" "))
  const len = p > 6 && p <= max ? p + 1 : max
  return t.slice(0, len).replace(/[、，,;；\s]+$/, "") + "…"
}

/** 清洗 Telegram 原文排版噪音（【标签】/——/投稿者/外链） */
export function cleanSubText(t: string): string {
  if (!t) return ""
  let s = String(t).trim()
  s = s.replace(/^\s*[•·,*\-–—]+\s*/, "")
  s = s.replace(/^\s*【[^】]{0,40}】\s*/, "")
  s = s.replace(/\s*[（(](?:via\s+)?(?:t\.me|http|https|telegram|外部链接|来源|摘自)[^）)]*[）)]/gi, "")
  s = s.replace(/\s*[—–…]+\s*/g, "、")
  s = s.replace(/[、，,;；]{2,}/g, "、")
  s = s.replace(/[、，,;；\s]*投稿(?:者|人)?\s*[:：]?[^\s、，,;；]*/g, "")
  s = s.replace(/\s+/g, " ")
  s = s.replace(/^[、，,;；：:\s]+/, "")
  s = s.replace(/[、，,;；：:\s]+$/, "")
  return s.trim()
}

// ---- 筛选 ----
export function keywordMatch(text: string, keyword: string): boolean {
  const k = String(keyword || "").trim()
  if (!k) return false
  return String(text || "").toLowerCase().includes(k.toLowerCase())
}

export interface MatchedItem {
  keyword: string
  item: ItemRow
}

export function filterByKeywords(items: ItemRow[], keywords: string[]): { matched: MatchedItem[] } {
  const matched: MatchedItem[] = []
  const seen = new Set<string>()
  const kwList = (keywords || []).filter(k => k && String(k).trim())
  for (const item of items) {
    const title = item.title || ""
    for (const kw of kwList) {
      if (keywordMatch(title, kw)) {
        const key = kw + "|" + (item.url || item.title)
        if (!seen.has(key)) {
          seen.add(key)
          matched.push({ keyword: kw, item })
        }
      }
    }
  }
  return { matched }
}

/** 按规范化标题去重，合并跨平台重复条目，并保留最小 rank */
export function dedupeItems(items: Array<ItemRow & { platform_name?: string; platform_id?: string }>) {
  const map = new Map<string, any>()
  for (const it of items || []) {
    const k = normalizeTitle(it.title)
    if (!k) continue
    const pn = it.platform_name || it.platform_id || ""
    if (map.has(k)) {
      const ex = map.get(k)
      if (ex.rank != null && it.rank != null) ex.rank = Math.min(ex.rank, it.rank)
      else if (ex.rank == null && it.rank != null) ex.rank = it.rank
      if (pn && !ex.platforms.includes(pn)) ex.platforms.push(pn)
      if (!ex.url && it.url) ex.url = it.url
      continue
    }
    map.set(k, { ...it, rank: it.rank != null ? it.rank : null, platforms: pn ? [pn] : [] })
  }
  const out = [...map.values()].map(it => {
    it.platform = it.platforms.join("/")
    delete it.platforms
    return it
  })
  out.sort((a, b) => (a.rank == null ? 9999 : a.rank) - (b.rank == null ? 9999 : b.rank))
  return out
}

// ---- 分类 / 渲染 ----
const platformLabel: Record<string, string> = {
  "bilibili-hot-search": "B站", bilibili: "B站", "bilibili-search": "B站",
  "weibo-hot": "微博", weibo: "微博", "douyin-hot": "抖音", douyin: "抖音",
  "zhihu-hot": "知乎", zhihu: "知乎", "baidu-hot": "百度", "baidu-search": "百度", baidu: "百度",
  "163-news": "网易", netease: "网易", "today-news": "今日头条", "tencent-news": "腾讯",
  tencent: "腾讯", toutiao: "今日头条", sina: "新浪", "kuaishou-hot": "快手", kuaishou: "快手",
  "qq-news": "腾讯新闻", douban: "豆瓣", thepaper: "澎湃", "cls-hot": "财联社", cls: "财联社",
  wallstreetcn: "华尔街见闻", "wallstreetcn-hot": "华尔街见闻", ifeng: "凤凰", tieba: "贴吧",
}

export function classifyItem(item: ItemRow & { platform_id?: string; platform_name?: string; feed_id?: string; feed_name?: string }, cfg: HotNewsConfig): string {
  const text = ((item.title || "") + " " + (item.summary || "")).toLowerCase()
  const cats = cfg.report.categories || []
  const kw = cfg.report.category_keywords || {}
  for (const cat of cats) {
    if (cat === "综合" || cat === "其他") continue
    const keywords = (kw as Record<string, string[]>)[cat] || []
    if (keywords.some(k => text.includes(String(k).toLowerCase()))) return cat
  }
  const pid = String(item.platform_id || item.feed_id || "").toLowerCase()
  const pname = String(item.platform_name || item.feed_name || "").toLowerCase()
  const fb = (cfg.report as any).platform_defaults || {}
  for (const cat of Object.keys(fb)) {
    if ((fb[cat] || []).some((id: string) => pid.includes(String(id).toLowerCase()) || pname.includes(String(id).toLowerCase()))) return cat
  }
  return cats.length ? cats[0] : "其他"
}

/** 单条推送文本（含平台标签 + 摘要），来源信息由调用方在板块头部标注 */
export function fmtItem(it: ItemRow & { platform?: string; platform_name?: string; platform_id?: string; feed_name?: string; source_kind?: string; _zh?: string; _zhSummary?: string }): string {
  const isSub = it.source_kind === "sub" || String(it.feed_name || "").toLowerCase().startsWith("tg-")
  const pRaw = it.platform || it.platform_name || it.platform_id || "热榜"
  const p = platformLabel[String(pRaw).toLowerCase()] || (String(pRaw).length <= 8 ? pRaw : "热榜")
  let title = (it._zh || it.title || "").trim() || "(无标题)"
  let raw = (it._zhSummary || it.summary || "").replace(/\n/g, " ").replace(/<[^>]+>/g, "").trim()
  if (isSub) {
    title = cleanSubText(title) || "(无标题)"
    raw = cleanSubText(raw).replace(/^[、，,;；：:\s]+/, "")
    if (raw && title.length > 2 && raw.startsWith(title)) {
      raw = raw.slice(title.length).replace(/^[-—:…，,。.\s•·（(【、[]+/, "")
    }
  } else {
    const origTitle = (it.title || "").trim()
    if (raw && origTitle && origTitle.length > 2 && raw.startsWith(origTitle)) {
      raw = raw.slice(origTitle.length).replace(/^[-—:…，,。.\s•·（(【、[]+/, "")
    }
  }
  let summary = ""
  if (raw) summary = smartClip(raw, isSub ? 80 : 120)
  if (summary && summary.length <= 4 && title.length > 4) summary = ""
  if (isMediaPlaceholder(it.title || "") && it.image) {
    return `• [${p}] 🖼 媒体消息`
  }
  return summary ? `• [${p}] ${title} — ${summary}` : `• [${p}] ${title}`
}

export interface DigestPart {
  type: string
  category?: string
  subName?: string
  text: string
  itemsCount: number
  images: string[]
}

export interface DigestData {
  title: string
  timeStr: string
  top: any[]
  topCount: number
  hotlist?: { groups: Record<string, any[]>; mode: string } | null
  rss: any[]
  rssAlways: any[]
  analysis?: string | null
  footnote?: string
}

/** 渲染推送正文（多板块，共用一个全篇去重集合） */
export function renderParts(cfg: HotNewsConfig, data: DigestData): DigestPart[] {
  const { timeStr, top, hotlist, rss, rssAlways, analysis, footnote } = data
  const categories = cfg.report.categories || ["综合", "AI", "科技", "游戏", "财经", "时政"]
  const parts: DigestPart[] = []
  const seen = new Set<string>()
  const keepUnique = (it: any): boolean => {
    const k = itemDedupKey(it)
    if (!k) return true
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }

  const hotItems: any[] = []
  if (top && top.length) hotItems.push(...top.map(it => ({ ...it, _source: "top" })))
  if (hotlist && hotlist.groups) {
    for (const key of Object.keys(hotlist.groups)) {
      for (const it of hotlist.groups[key]) hotItems.push({ ...it, _source: "hotlist" })
    }
  }
  if (rss && rss.length) hotItems.push(...rss.map(it => ({ ...it, _source: "rss" })))
  const deduped = hotItems.filter(keepUnique)
  const grouped: Record<string, any[]> = {}
  for (const cat of categories) grouped[cat] = []
  for (const it of deduped) {
    const c = classifyItem(it, cfg)
    ;(grouped[c] = grouped[c] || []).push(it)
  }
  const nonEmpty = categories.filter(cat => (grouped[cat] || []).length)
  const totalParts = nonEmpty.length || 1
  let idx = 0
  for (const cat of categories) {
    const items = grouped[cat] || []
    if (!items.length) continue
    idx++
    const lines: string[] = []
    lines.push(`【热点资讯】${timeStr}  ·  ${idx}/${totalParts}  ${cat}`)
    const max = 30
    const sliceItems = items.slice(0, max)
    sliceItems.forEach(it => lines.push(fmtItem(it)))
    if (items.length > max) lines.push(`… 共 ${items.length} 条`)
    lines.push("")
    lines.push("💡 数据来源：热榜抓取")
    const catImgs = sliceItems.map(it => it.image).filter(Boolean)
    parts.push({ type: "part", category: cat, text: lines.join("\n"), itemsCount: items.length, images: catImgs })
  }

  if (rssAlways && rssAlways.length) {
    const bySub: Record<string, any[]> = {}
    for (const it of rssAlways) {
      if (!keepUnique(it)) continue
      const name = it.feed_name || it.source_id || "未知订阅"
      ;(bySub[name] = bySub[name] || []).push(it)
    }
    for (const name of Object.keys(bySub)) {
      const items = bySub[name]
      const lines: string[] = []
      lines.push(`【订阅更新】${timeStr}  ·  ${name}`)
      const max = 20
      const sliceItems = items.slice(0, max)
      const sliceMedia = sliceItems.filter(it => /^• \[[^\]]+\] 🖼 媒体消息/.test(fmtItem(it))).length
      const mergedLines: string[] = []
      for (const it of sliceItems) {
        const li = fmtItem(it)
        if (/^• \[[^\]]+\] 🖼 媒体消息/.test(li)) continue
        mergedLines.push(li)
      }
      if (sliceMedia > 0) mergedLines.push(`• [热榜] 🖼 媒体消息${sliceMedia > 1 ? ` ×${sliceMedia}` : ""}`)
      const pushLines = mergedLines.length ? mergedLines : sliceItems.map(it => fmtItem(it))
      pushLines.forEach(l => lines.push(l))
      if (items.length > max) lines.push(`… 共 ${items.length} 条`)
      lines.push("")
      lines.push("💡 数据来源：自定义订阅")
      const subImgs = sliceItems.map(it => it.image).filter(Boolean)
      parts.push({ type: "sub", subName: name, text: lines.join("\n"), itemsCount: items.length, images: subImgs })
    }
  }

  if (analysis) {
    const alines: string[] = []
    alines.push(`【AI 今日总结】${timeStr}`)
    alines.push("")
    alines.push(analysis)
    alines.push("")
    alines.push("🤖 数据来源：AI 分析")
    parts.push({ type: "analysis", text: alines.join("\n"), itemsCount: 0, images: [] })
  }

  if (footnote) {
    parts.push({ type: "footnote", text: footnote, itemsCount: 0, images: [] })
  }
  return parts
}
