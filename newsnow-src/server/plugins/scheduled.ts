import { runPipeline } from "#/services/pipeline"
import { logger } from "../utils/logger"

/**
 * 定时触发接入：nitro cloudflare_module preset 会在 scheduled 事件时调用
 * `cloudflare:scheduled` hook（携带 { controller, env, context }）。
 * 这里统一执行抓取 + 紧急推送 + 四时段/日报/周报管线。
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }: { env: any }) => {
    logger.info("scheduled event fired, running pipeline")
    const result = await runPipeline(env || {}, { trigger: "cron" })
    logger.info(`scheduled pipeline done: ${JSON.stringify({ ok: result.ok, urgent: result.urgent?.pushed, digest: !!result.digest, daily: !!result.daily, weekly: !!result.weekly, errors: result.errors?.length }) }`)
  })
})
