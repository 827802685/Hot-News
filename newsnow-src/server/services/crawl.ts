import { getters } from "#/getters"
import { myFetch } from "../utils/fetch"
import { rss2json } from "../utils/rss2json"
import type { ItemRow } from "../database/items"
import { ItemTable } from "../database/items"
import { SourceTable } from "../database/sources"
import { contentFingerprint } from "./dedup"
import { logger } from "../utils/logger"
import type { HotNewsConfig } from "./config"

/**
 * 统一抓取管线
 * - 平台热榜：调用 newsnow 内置 getters（cfg.platforms.sources）→ items(kind=hotlist)
 * - 自定义源：sources 表 kind∈(rss|telegram|custom) → items(kind=rss|telegram|custom)
 * 所有条目幂等 upsert 进统一 items 表（按 source_id+url 去重）。
 */

export interface CrawlResult {
  platform: { fetched: number; added: number; errors: string[] }
  custom: { fetched: number; added: number; errors: string[] }
}

export async function crawlPlatforms(cfg: HotNewsConfig, db: any): Promise<{ fetched: number; added: number; errors: string[] }> {
  const table = new ItemTable(db)
  const list = (cfg.platforms?.sources || []).filter(s => s?.id)
  let fetched = 0
  let added = 0
  const errors: string[] = []
  for (const s of list) {
    const getter = (getters as any)[s.id]
    if (!getter) {
      errors.push(`[${s.id}] 无内置抓取器`)
      continue
    }
    try {
      const news = await getter()
      const slice = (news || []).slice(0, 30)
      for (let i = 0; i < slice.length; i++) {
        const it = slice[i]
        fetched++
        const r = await table.upsert({
          source_id: s.id,
          kind: "hotlist",
          title: it.title || "",
          url: it.url || "",
          mobile_url: it.mobileUrl || "",
          rank: i + 1,
          published_at: it.pubDate ? new Date(it.pubDate).toISOString() : "",
          fingerprint: contentFingerprint(it.title || "", ""),
        })
        if (r.added) added++
      }
    } catch (e: any) {
      errors.push(`[${s.id}] ${e.message}`)
    }
  }
  return { fetched, added, errors }
}

/** 自定义 Telegram 频道抓取（t.me/s/... 公开预览页） */
export async function fetchTelegram(url: string): Promise<{ title: string; url: string; summary: string; image: string; created: string }[]> {
  const m = String(url).match(/t\.me\/s\/([^/?#]+)/i)
  const base = m ? `https://t.me/s/${m[1]}` : String(url).replace(/\/$/, "")
  const html = await myFetch(base, { responseType: "text" })
  const items: { title: string; url: string; summary: string; image: string; created: string }[] = []
  const blocks = String(html).split(/class="tgme_widget_message_wrap/)
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i]
    const post = b.match(/data-post="([^"]+)"/)?.[1] || ""
    const textMatch = b.match(/class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
    const rawText = textMatch ? textMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim() : ""
    const text = rawText.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    const image = b.match(/class="tgme_widget_message_photo_wrap[^"]*"\s*style="background-image:url\('([^']+)'\)/)?.[1]
      || b.match(/background-image:url\('([^']+)'\)/)?.[1] || ""
    const created = b.match(/datetime="([^"]+)"/)?.[1] || ""
    const link = b.match(/<a class="tgme_widget_message_date[^"]*"[^>]*href="([^"]+)"/)?.[1] || (base + "/" + post)
    const firstLine = text.split("\n")[0].trim()
    const title = firstLine ? firstLine.slice(0, 200) : "(无标题)"
    items.push({ title, summary: text, url: link, image, created })
  }
  return items
}

export async function crawlCustomSources(cfg: HotNewsConfig, db: any): Promise<{ fetched: number; added: number; errors: string[] }> {
  const srcTable = new SourceTable(db)
  const itemTable = new ItemTable(db)
  const rows = await srcTable.list({ enabled: true })
  const custom = rows.filter(r => r.kind === "rss" || r.kind === "telegram" || r.kind === "custom")
  let fetched = 0
  let added = 0
  const errors: string[] = []
  for (const src of custom) {
    if (!src.url) continue
    try {
      const isRss = src.kind === "rss" || /\.(xml|rss|atom)(\?|#|$)/i.test(src.url)
      if (isRss) {
        const rss = await rss2json(src.url)
        const items = (rss?.items || []).slice(0, 30)
        for (const it of items) {
          fetched++
          const r = await itemTable.upsert({
            source_id: src.id,
            kind: "rss",
            title: it.title || "",
            url: it.link || "",
            summary: it.description || "",
            published_at: it.created ? new Date(it.created).toISOString() : "",
            fingerprint: contentFingerprint(it.title || "", ""),
          })
          if (r.added) added++
        }
      } else {
        const items = await fetchTelegram(src.url)
        for (const it of items) {
          fetched++
          const r = await itemTable.upsert({
            source_id: src.id,
            kind: src.kind === "telegram" ? "telegram" : "custom",
            title: it.title,
            url: it.url,
            summary: it.summary,
            image: it.image,
            published_at: it.created ? new Date(it.created).toISOString() : "",
            fingerprint: contentFingerprint(it.title, it.image || ""),
          })
          if (r.added) added++
        }
      }
    } catch (e: any) {
      errors.push(`[${src.name}] ${e.message}`)
    }
  }
  return { fetched, added, errors }
}

/** 统一抓取：平台热榜 + 自定义源 */
export async function crawlAll(cfg: HotNewsConfig, db: any): Promise<CrawlResult> {
  const [platform, custom] = await Promise.all([
    cfg.platforms?.enabled === false ? Promise.resolve({ fetched: 0, added: 0, errors: [] }) : crawlPlatforms(cfg, db),
    cfg.rss?.enabled === false ? Promise.resolve({ fetched: 0, added: 0, errors: [] }) : crawlCustomSources(cfg, db),
  ])
  if (platform.added || platform.fetched) logger.success(`crawl platforms +${platform.added} (${platform.fetched} fetched)`)
  if (custom.added || custom.fetched) logger.success(`crawl custom +${custom.added} (${custom.fetched} fetched)`)
  return { platform, custom }
}

/** 把 ItemRow 附加来源展示信息，供渲染/筛选使用 */
export function decorate(items: ItemRow[], sourceNames: Record<string, string> = {}): Array<ItemRow & { platform_id?: string; platform_name?: string; feed_id?: string; feed_name?: string; source_kind?: string }> {
  return items.map(it => {
    const d: any = { ...it }
    if (it.kind === "hotlist") {
      d.platform_id = it.source_id
      d.platform_name = sourceNames[it.source_id] || it.source_id
    } else {
      d.feed_id = it.source_id
      d.feed_name = sourceNames[it.source_id] || it.source_id
      d.source_kind = it.kind === "rss" ? "rss" : "sub"
    }
    return d
  })
}
