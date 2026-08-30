// 整合入口：newsnow 主站 + hot-news 旧后台(/setting /rss /api/pull) + 定时抓取推送
import newsnow from "./newsnow-entry.mjs"
import legacy from "./legacy-worker.js"

// 旧后台/订阅/推送相关路径 → 走 hot-news 逻辑；其余 → newsnow
const LEGACY_PREFIXES = [
  "/setting", "/rss", "/qq", "/debug", "/help", "/api/pull",
  "/api/today", "/api/status", "/api/health",
]

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const p = url.pathname
    const useLegacy = LEGACY_PREFIXES.some((x) => p === x || p.startsWith(x + "/"))
    if (useLegacy) {
      try {
        return await legacy.fetch(request, env, ctx)
      } catch (e) {
        return new Response("legacy route error: " + e.message, { status: 500 })
      }
    }
    return newsnow.fetch(request, env, ctx)
  },

  async scheduled(controller, env, ctx) {
    return legacy.scheduled(controller, env, ctx)
  },
}