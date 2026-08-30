/**
 * 统一去重层
 * - 跨 cron 轮次持久去重：KV push_fp:v2:<日期> 存该日已推送的内容指纹（48h TTL）
 * - 紧急消息 / 四时段整合 / 图片 三路共用，同一内容当天只推一次
 */

export type DedupScope = "urgent" | "digest" | "image"

export class DedupStore {
  constructor(private kv: any) {}

  private key(dateStr: string) {
    return `push_fp:v2:${dateStr}`
  }

  /** 读取当日已推指纹集合 */
  private async load(dateStr: string): Promise<Set<string>> {
    if (!this.kv) return new Set()
    try {
      const raw = await this.kv.get(this.key(dateStr))
      return new Set(raw ? raw.split("\n").filter(Boolean) : [])
    } catch {
      return new Set()
    }
  }

  private async save(dateStr: string, set: Set<string>) {
    if (!this.kv) return
    try {
      await this.kv.put(this.key(dateStr), [...set].join("\n"), { expirationTtl: 172800 })
    } catch {
      // 忽略
    }
  }

  /** 是否当日已推 */
  async isPushed(scope: DedupScope, fingerprint: string, dateStr: string): Promise<boolean> {
    if (!fingerprint) return false
    const set = await this.load(dateStr)
    return set.has(`${scope}:${fingerprint}`)
  }

  /** 标记已推；返回 true=首次标记（可推），false=重复 */
  async markPushed(scope: DedupScope, fingerprint: string, dateStr: string): Promise<boolean> {
    if (!fingerprint) return true
    const set = await this.load(dateStr)
    const key = `${scope}:${fingerprint}`
    if (set.has(key)) return false
    set.add(key)
    await this.save(dateStr, set)
    return true
  }
}

/**
 * 计算内容指纹：
 * - 普通消息：规范化标题（去空格/标点/小写）
 * - 纯媒体/图片：图片 URL
 */
export function contentFingerprint(title: string, image = ""): string {
  if (image) return `img:${image.trim()}`
  const norm = String(title || "")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[，。！？、；：""''（）【】《》.,!?;:()\[\]{}]/g, "")
    .slice(0, 64)
  return `t:${norm}`
}
