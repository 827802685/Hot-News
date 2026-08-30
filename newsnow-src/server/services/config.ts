import { ConfigTable } from "../database/config"

/**
 * 统一配置模型
 * - 从 legacy KV hotnews:config 迁到 D1 config 表
 * - ai 改为标准 OpenAI 兼容格式：base_url / api_key / model（删掉名存实亡的 provider）
 * - 新增 urgent：紧急消息（可配置关注类型，由 AI 筛选，15 分钟轮即时推送）
 * - report.daily / report.weekly 保留（日报/周报）
 */

export interface ChannelCfg {
  [k: string]: any
}

export interface HotNewsConfig {
  app: {
    timezone: string
    title: string
  }
  platforms: {
    enabled: boolean
    interval_minutes: number
    sources: { id: string; name: string; expected_domain?: string }[]
  }
  rss: {
    enabled: boolean
    max_age_days: number
  }
  filter: {
    method: "keyword" | "ai"
    keywords: string[]
    max_news_per_keyword: number
    rank_threshold: number
    min_score: number
    interests: string
  }
  ai: {
    enabled: boolean
    /** 服务提供商：workersai（Cloudflare Workers AI 免费模型）| openai（任意 OpenAI 兼容端点） */
    provider: "workersai" | "openai"
    /** openai 提供商下生效：任意 OpenAI 兼容端点，如 https://api.deepseek.com/v1 */
    base_url: string
    api_key: string
    /** 模型：workersai 下为 @cf/...（如 @cf/meta/llama-3.1-8b-instruct） */
    model: string
    temperature: number
    max_tokens: number
  }
  ai_analysis: {
    enabled: boolean
    language: string
    max_news_for_analysis: number
    include_rss: boolean
  }
  ai_translation: {
    enabled: boolean
    language: string
  }
  /** 紧急消息：15 分钟轮由 AI 按指定类型筛选，命中即推 */
  urgent: {
    enabled: boolean
    /** 关注的紧急类型/主题，如 ["重大突发事件","股市异动","重大科技发布","时政","游戏爆料"] */
    types: string[]
    /** AI 判定紧急的最低分数 0-1 */
    min_score: number
    /** 每轮最多推送条数 */
    max_per_round: number
  }
  report: {
    mode: "daily" | "current" | "incremental"
    display_mode: "keyword" | "platform"
    top_count: number
    daily: { enabled: boolean; time: string }
    weekly: { enabled: boolean; day: number; time: string }
    categories: string[]
    category_keywords: Record<string, string[]>
  }
  notification: {
    enabled: boolean
    channels: Record<string, ChannelCfg>
  }
  retention: {
    news_days: number
    rss_days: number
  }
  advanced: {
    debug: boolean
  }
}

const PLATFORM_DEFAULT = [
  { id: "toutiao", name: "今日头条", expected_domain: "toutiao.com" },
  { id: "baidu", name: "百度热搜", expected_domain: "baidu.com" },
  { id: "wallstreetcn-hot", name: "华尔街见闻", expected_domain: "wallstreetcn.com" },
  { id: "thepaper", name: "澎湃新闻", expected_domain: "thepaper.cn" },
  { id: "bilibili-hot-search", name: "bilibili 热搜", expected_domain: "bilibili.com" },
  { id: "cls-hot", name: "财联社热门", expected_domain: "cls.cn" },
  { id: "ifeng", name: "凤凰网", expected_domain: "ifeng.com" },
  { id: "tieba", name: "贴吧", expected_domain: "baidu.com" },
  { id: "weibo", name: "微博", expected_domain: "weibo.com" },
  { id: "douyin", name: "抖音", expected_domain: "douyin.com" },
  { id: "zhihu", name: "知乎", expected_domain: "zhihu.com" },
]

export const DEFAULT_CONFIG: HotNewsConfig = {
  app: { timezone: "Asia/Shanghai", title: "Hot News 热点速递" },
  platforms: {
    enabled: true,
    interval_minutes: 60,
    sources: PLATFORM_DEFAULT,
  },
  rss: { enabled: true, max_age_days: 1 },
  filter: {
    method: "keyword",
    keywords: ["AI", "人工智能", "OpenAI", "大模型", "芯片", "英伟达", "华为", "iPhone", "苹果", "小米", "特斯拉", "比亚迪", "新能源", "A股", "股市", "美联储", "比特币", "加密货币"],
    max_news_per_keyword: 5,
    rank_threshold: 5,
    min_score: 0.7,
    interests: "科技、AI、财经、汽车、互联网行业的重要新闻",
  },
  ai: {
    enabled: true,
    // 默认用 Cloudflare Workers AI 免费模型（免费账户无需 key）
    provider: "workersai",
    base_url: "https://api.deepseek.com/v1",
    api_key: "",
    model: "@cf/meta/llama-3.1-8b-instruct",
    temperature: 0.8,
    max_tokens: 4000,
  },
  ai_analysis: {
    enabled: true,
    language: "中文",
    max_news_for_analysis: 100,
    include_rss: true,
  },
  ai_translation: {
    enabled: true,
    language: "中文",
  },
  urgent: {
    enabled: true,
    types: ["重大突发事件", "股市异动", "重大科技发布", "时政要闻", "游戏爆料"],
    min_score: 0.8,
    max_per_round: 5,
  },
  report: {
    mode: "current",
    display_mode: "keyword",
    top_count: 10,
    daily: { enabled: true, time: "21:00" },
    weekly: { enabled: false, day: 7, time: "20:00" },
    categories: ["综合", "AI", "科技", "游戏", "财经", "时政", "其他"],
    category_keywords: {
      AI: ["AI", "人工智能", "大模型", "GPT", "Claude", "Gemini", "Llama", "ChatGPT", "OpenAI", "Anthropic", "xAI", "Grok", "算力", "GPU", "NVIDIA", "英伟达", "Cursor"],
      科技: ["开源", "GitHub", "机器人", "自动驾驶", "量子", "航天", "卫星", "芯片", "半导体", "手机", "苹果", "华为", "小米", "OPPO", "vivo", "百度", "字节", "腾讯", "阿里", "京东", "拼多多"],
      游戏: ["游戏", "Steam", "原神", "崩铁", "星穹铁道", "魔兽世界", "PUBG", "APEX", "LOL", "英雄联盟", "CS", "FPS", "RPG", "Switch", "PS5", "Xbox", "Epic", "暴雪", "米哈游", "吉卜力"],
      财经: ["股市", "A股", "基金", "比特币", "加密货币", "以太坊", "美联储", "美元", "油价", "黄金", "期货", "证券", "上市", "IPO", "财报", "融资", "估值", "汇率", "通胀", "降息"],
      时政: ["总统", "国会", "外交", "战争", "制裁", "联合国", "北约", "拜登", "特朗普", "普京", "主席", "国务院", "部长", "峰会", "谈判", "台海", "朝鲜", "韩国", "日本", "乌克兰"],
    },
  },
  notification: {
    enabled: true,
    channels: {
      feishu: { webhook_url: "" },
      dingtalk: { webhook_url: "" },
      wework: { webhook_url: "", msg_type: "markdown" },
      telegram: { bot_token: "", chat_id: "" },
      email: { resend_api_key: "", from: "", to: "" },
      ntfy: { server_url: "https://ntfy.sh", topic: "", token: "" },
      bark: { url: "" },
      slack: { webhook_url: "" },
      generic_webhook: { webhook_url: "", payload_template: "" },
      qq: { app_id: "", app_secret: "", target_type: "group", target_id: "" },
    },
  },
  retention: { news_days: 30, rss_days: 30 },
  advanced: { debug: false },
}

/** 深度合并（仅对象递归），用于 defaults 之上叠加已存配置 */
export function mergeDeep<T>(target: any, source: any): T {
  if (!source) return target
  for (const k of Object.keys(source)) {
    const v = source[k]
    if (v === undefined || v === null) continue
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
      mergeDeep(target[k], v)
    } else {
      target[k] = v
    }
  }
  return target
}

/** 加载配置：D1 config 表 + defaults 合并 */
export async function loadConfig(db: { prepare: (sql: string) => any } | undefined): Promise<HotNewsConfig> {
  const base = structuredClone(DEFAULT_CONFIG)
  if (!db) return base
  const store = new ConfigTable(db as any)
  const stored = await store.getJSON<Partial<HotNewsConfig>>("hotnews:config")
  if (stored && typeof stored === "object") {
    return mergeDeep<HotNewsConfig>(base, stored)
  }
  return base
}

/** 保存整份配置（保留 defaults 之外的键） */
export async function saveConfig(db: { prepare: (sql: string) => any } | undefined, config: Partial<HotNewsConfig>) {
  if (!db) return
  const store = new ConfigTable(db as any)
  const base = structuredClone(DEFAULT_CONFIG)
  const merged = mergeDeep<HotNewsConfig>(base, config)
  await store.setJSON("hotnews:config", merged)
  return merged
}

/** 脱敏：隐藏 api_key / secret / token，返回给控制面板 */
export function maskConfig(cfg: HotNewsConfig): HotNewsConfig {
  const c = structuredClone(cfg)
  if (c.ai?.api_key) c.ai.api_key = "********"
  if (c.notification?.channels) {
    for (const [, ch] of Object.entries(c.notification.channels as Record<string, ChannelCfg>)) {
      for (const secretKey of ["api_key", "app_secret", "resend_api_key", "bot_token", "token"]) {
        if (ch && ch[secretKey]) ch[secretKey] = "********"
      }
    }
  }
  return c
}

/** 反脱敏合并：把 "********" 占位保留为原值 */
export function unmaskMerge<T extends object>(stored: any, incoming: any): T {
  const merged = structuredClone(stored ?? {})
  if (!incoming) return merged
  for (const k of Object.keys(incoming)) {
    const v = incoming[k]
    if (v === undefined || v === null) continue
    if (v && typeof v === "object" && !Array.isArray(v) && merged[k] && typeof merged[k] === "object" && !Array.isArray(merged[k])) {
      merged[k] = unmaskMerge(merged[k], v)
    } else if (v === "********" && merged[k] !== undefined) {
      // 保持原秘密值
    } else {
      merged[k] = v
    }
  }
  return merged
}
