import type { HotNewsConfig } from "./config"
import { chatAI, getEnvAI } from "./ai"

const M2M100_MODEL = "@cf/meta/m2m100-1.2b"

const LANG_MAP: Record<string, string> = {
  中文: "zh", 简体中文: "zh", 英文: "en", 英语: "en",
  日语: "ja", 韩语: "ko", 法语: "fr", 德语: "de",
  西班牙语: "es", 俄语: "ru", 葡萄牙语: "pt", 意大利语: "it",
  阿拉伯语: "ar", 荷兰语: "nl", 波兰语: "pl", 土耳其语: "tr",
}

/** Cloudflare Workers AI 免费翻译模型（m2m100，非 chat 形态） */
async function translateWorkersAI(text: string, targetLang: string): Promise<string> {
  const AI = getEnvAI()
  if (!AI) throw new Error("Workers AI 未绑定")
  const target = LANG_MAP[targetLang] || "zh"
  const res = await AI.run(M2M100_MODEL, {
    text,
    source_lang: "en",
    target_lang: target,
  })
  const out = res?.translated_text || res?.result || ""
  if (!out) throw new Error("翻译模型未返回内容")
  return String(out).trim()
}

/**
 * 英文 → 中文 直译，带 KV 翻译缓存（tr:v1:*）
 */
export async function translateToZh(cfg: HotNewsConfig, text: string, kv?: any): Promise<string> {
  const targetLang = cfg.ai_translation?.language || "中文"
  if (!text || !/[\x00-\x7F]/.test(text) === false) return text

  // 检测是否需要翻译：纯 ASCII 内容较多才翻译
  const ascii = text.replace(/[^\x00-\x7F]/g, "")
  if (ascii.length < text.length * 0.4) return text

  // KV 缓存
  if (kv) {
    const key = `tr:v1:${await sha256(text.slice(0, 800))}`
    try {
      const cached = await kv.get(key)
      if (cached) return cached
    } catch { /* 忽略 */ }
  }

  if (!cfg.ai.enabled) return text
  try {
    const translated = cfg.ai.provider === "workersai"
      ? await translateWorkersAI(text, targetLang)
      : await chatAI(cfg, [
        { role: "system", content: `你是翻译助手，把下面的内容翻译成${targetLang}，只输出译文，不要解释。保留人名、品牌、数字与链接。` },
        { role: "user", content: text },
      ], { temperature: 0.3, max_tokens: 2000 })

    if (kv) {
      try {
        await kv.put(`tr:v1:${await sha256(text.slice(0, 800))}`, translated, { expirationTtl: 86400 * 30 })
      } catch { /* 忽略 */ }
    }
    return translated
  } catch {
    return text
  }
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16)
}
