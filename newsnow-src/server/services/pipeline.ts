import { ensureUnifiedSchema } from "../database/schema"
import { ItemTable } from "../database/items"
import { RecordTable } from "../database/records"
import { getDb } from "../database/db"
import { loadConfig } from "./config"
import { crawlAll } from "./crawl"
import { runUrgentPush } from "./urgent"
import { pushDigest } from "./digest"
import { todayStr, nowClock, localToTs } from "./format"
import { logger } from "../utils/logger"

/**
 * 统一推送管线入口（scheduled cron / 手动 API 共用）
 *
 * 每 15 分钟一轮：
 *   1) 抓取：平台热榜 + 自定义源 → items 表
 *   2) 紧急消息：AI 按可配置类型研判，命中即即时推送（KV 当日去重）
 *   3) 四时段整合推送：08:00 / 12:00 / 17:00 / 20:00
 *   4) 日报 / 周报：按 report.daily / report.weekly 定时推送（保留）
 *   5) 记录 + 清理旧数据
 */

export interface PipelineEnv {
  /** 统一 D1（newsnow 主库，合并后单库） */
  NEWSNOW_DB?: any
  /** 旧库兜底（迁移期） */
  DB?: any
  /** KV：会话/锁/去重/翻译缓存 */
  KV?: any
}

export interface PipelineOptions {
  trigger?: "cron" | "manual"
  /** 测试时跳过定时判断（手动触发） */
  forceDigest?: boolean
  forceUrgent?: boolean
}

const DIGEST_TIMES = ["08:00", "12:00", "17:00", "20:00"]

export async function runPipeline(env: PipelineEnv, opts: PipelineOptions = {}): Promise<any> {
  const trigger = opts.trigger || "cron"
  const kv = env?.KV
  const db = getDb(env)

  // 分布式锁：防止 cron 与手动触发并发
  const RUNNING_KEY = "hotnews:pipeline:running"
  try {
    const running = kv ? await kv.get(RUNNING_KEY) : null
    if (running === "1") return { ok: true, running: true, message: "流水线已在运行" }
    if (kv) await kv.put(RUNNING_KEY, "1", { expirationTtl: 900 })
  } catch { /* KV 不可用时不锁 */ }

  const results: any = { trigger, startedAt: new Date().toISOString(), errors: [] }
  try {
    await ensureUnifiedSchema(db)
    const cfg = await loadConfig(db)
    const tz = cfg.app.timezone || "Asia/Shanghai"
    const today = todayStr(tz)
    const clock = nowClock(tz)

    // 1) 统一抓取
    try {
      results.crawl = await crawlAll(cfg, db)
    } catch (e: any) {
      results.errors.push(`crawl: ${e.message}`)
    }

    // 2) 紧急消息即时推送（每轮）
    if (opts.forceUrgent || cfg.urgent?.enabled) {
      try {
        results.urgent = await runUrgentPush(cfg, env, db)
      } catch (e: any) {
        results.errors.push(`urgent: ${e.message}`)
      }
    }

    // 3) 四时段整合推送
    const isDigestTime = opts.forceDigest || DIGEST_TIMES.includes(clock)
    if (isDigestTime) {
      const hour = clock.slice(0, 2)
      const label = Number(hour) < 10 ? "早报" : Number(hour) < 14 ? "午报" : Number(hour) < 18 ? "晚报" : "夜报"
      try {
        results.digest = await pushDigest(cfg, env, db, { kind: "digest", days: 1, title: `${today.replace(/-/g, "/")} ${label}`, withAnalysis: true })
      } catch (e: any) {
        results.errors.push(`digest: ${e.message}`)
      }
    }

    // 4) 日报 / 周报（保留）
    const daily = cfg.report?.daily || {}
    if (daily.enabled && (opts.forceDigest || clock === (daily.time || "21:00"))) {
      try {
        results.daily = await pushDigest(cfg, env, db, { kind: "daily", days: 1, title: "热点日报", withAnalysis: true })
      } catch (e: any) {
        results.errors.push(`daily: ${e.message}`)
      }
    }
    const weekly = cfg.report?.weekly || {}
    const wkday = new Date(localToTs(`${today} 12:00`, tz)).getUTCDay()
    if (weekly.enabled && wkday === (weekly.day === 7 ? 0 : weekly.day) && (opts.forceDigest || clock === (weekly.time || "20:00"))) {
      try {
        results.weekly = await pushDigest(cfg, env, db, { kind: "weekly", days: 7, title: "热点周报", withAnalysis: true })
      } catch (e: any) {
        results.errors.push(`weekly: ${e.message}`)
      }
    }

    // 5) 清理旧数据 + 记录
    try {
      const purged = await new ItemTable(db).purgeBefore(cfg.retention?.news_days || 30)
      results.purged = purged
    } catch { /* ignore */ }
    try {
      await new RecordTable(db).addCrawlRecord({ crawl_time: new Date().toISOString(), kind: "all", total_items: results.crawl?.platform?.added + results.crawl?.custom?.added || 0, detail: JSON.stringify(results.errors.slice(0, 10)) })
    } catch { /* ignore */ }

    results.ok = true
    results.finishedAt = new Date().toISOString()
    try {
      if (kv) await kv.put("hotnews:pipeline:last", JSON.stringify({ time: Date.now(), ok: true, urgentPushed: results.urgent?.pushed ?? 0, digest: !!results.digest, daily: !!results.daily, weekly: !!results.weekly, errors: results.errors?.length ?? 0 }))
    } catch { /* ignore */ }
  } catch (e: any) {
    logger.error("pipeline failed", e)
    results.ok = false
    results.error = e.message
  } finally {
    try {
      if (kv) await kv.put(RUNNING_KEY, "0")
    } catch { /* ignore */ }
  }
  return results
}
