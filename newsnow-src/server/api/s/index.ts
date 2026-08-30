import type { NewsItem, SourceID, SourceResponse } from "@shared/types"
import { getters } from "#/getters"
import { getCacheTable } from "#/database/cache"
import type { CacheInfo } from "#/types"
import { SourceTable } from "#/database/sources"
import { ItemTable } from "#/database/items"
import { getDb } from "#/database/db"

const info = {
  LICENCE: "MIT",
  Github: "https://github.com/ourongxing/newsnow",
  Sponsorship: "If you rely on this service, sponsorship is welcome to help it run for the long term. Scan the QR code https://raw.githubusercontent.com/ourongxing/newsnow/main/screenshots/reward.gif",
}

function getEnvDb(event: any): any {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  return getDb(env)
}

/** 自定义源条目 → NewsItem */
function itemToNews(item: any): NewsItem {
  const news: NewsItem = {
    id: item.id,
    title: item.title || "(无标题)",
    url: item.url || "#",
    mobileUrl: item.mobile_url || item.url || "#",
    pubDate: item.published_at || item.first_seen || "",
  }
  const extra: NewsItem["extra"] = {}
  if (item.summary) extra.info = String(item.summary).replace(/\s+/g, " ").slice(0, 80) || false
  if (item.image) extra.icon = item.image
  news.extra = extra
  return news
}

/** 自定义源：从统一 items 表取该源最新条目 */
async function fetchCustomSource(db: any, id: string): Promise<SourceResponse> {
  const itemTable = new ItemTable(db)
  const items = await itemTable.listBySource(id, 30)
  const srcTable = new SourceTable(db)
  const src = await srcTable.get(id)
  return {
    status: "success",
    id: id as SourceID,
    updatedTime: Date.now(),
    items: items.map(itemToNews),
    info: src ? { name: src.name } : info,
  }
}

export default defineEventHandler(async (event): Promise<SourceResponse> => {
  try {
    const query = getQuery(event)
    const latest = query.latest !== undefined && query.latest !== "false"
    const id = String(query.id || "")

    // 内置源走原有逻辑；否则尝试自定义源
    const isBuiltin = !!id && !!sources[id as SourceID] && !!getters[id as SourceID]
    if (!isBuiltin) {
      const db = getEnvDb(event)
      if (db) {
        const srcTable = new SourceTable(db)
        const src = await srcTable.get(id)
        if (src && (src.kind === "rss" || src.kind === "telegram" || src.kind === "custom")) {
          return fetchCustomSource(db, id)
        }
      }
      throw new Error("Invalid source id")
    }

    const cacheTable = await getCacheTable()
    // Date.now() in Cloudflare Worker will not update throughout the entire runtime.
    const now = Date.now()
    let cache: CacheInfo | undefined
    if (cacheTable) {
      cache = await cacheTable.get(id as SourceID)
      if (cache) {
        // interval 刷新间隔，对于缓存失效也要执行的。本质上表示本来内容更新就很慢，这个间隔内可能内容压根不会更新。
        // 默认 10 分钟，是低于 TTL 的，但部分 Source 的更新间隔会超过 TTL，甚至有的一天更新一次。
        if (now - cache.updated < sources[id as SourceID].interval) {
          return {
            status: "success",
            id: id as SourceID,
            updatedTime: now,
            items: cache.items,
            info,
          }
        }

        // 而 TTL 缓存失效时间，在时间范围内，就算内容更新了也要用这个缓存。
        // 复用缓存是不会更新时间的。
        if (now - cache.updated < TTL) {
          // 有 latest
          // 没有 latest，但服务器禁止登录
          if (!latest || (!event.context.disabledLogin && !event.context.user)) {
            return {
              status: "cache",
              id: id as SourceID,
              updatedTime: cache.updated,
              items: cache.items,
              info,
            }
          }
        }
      }
    }

    try {
      const newData = (await getters[id as SourceID]()).slice(0, 30)
      if (cacheTable && newData.length) {
        if (event.context.waitUntil) event.context.waitUntil(cacheTable.set(id as SourceID, newData))
        else await cacheTable.set(id as SourceID, newData)
      }
      logger.success(`fetch ${id} latest`)
      return {
        status: "success",
        id: id as SourceID,
        updatedTime: now,
        items: newData,
        info,
      }
    } catch (e) {
      if (cache!) {
        return {
          status: "cache",
          id: id as SourceID,
          updatedTime: cache.updated,
          items: cache.items,
          info,
        }
      } else {
        throw e
      }
    }
  } catch (e: any) {
    logger.error(e)
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : "Internal Server Error",
    })
  }
})
