import { runPipeline } from "#/services/pipeline"

/** 手动触发完整管线（调试/控制面板用） */
export default defineEventHandler(async (event) => {
  const env = (event.context as any).cloudflare?.env || (globalThis as any).__env__ || {}
  const body = await readBody(event).catch(() => ({}))
  const result = await runPipeline(env, {
    trigger: "manual",
    forceDigest: body?.forceDigest === true,
    forceUrgent: body?.forceUrgent === true,
  })
  return result
})
