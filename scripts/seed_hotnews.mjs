// 生成 D1 seed SQL：config / sources / users（一次性脚本）
import { createHash } from "node:crypto"

const SALT = "::hotnews_salt_v1"
const sha = (s) => createHash("sha256").update(s).digest("hex")

const ADMIN_EMAIL = "827802685@qq.com"
const ADMIN_PASS = "yh090630"
const ADMIN_HASH = sha(ADMIN_PASS + SALT)

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"

// ---------- sources: 6 TG + HN + freedidi ----------
const tg = [
  ["tg_fireflyleak", "FireflyLeak", "https://t.me/s/FireflyLeak", "游戏爆料"],
  ["tg_cyrleak", "cyrleak", "https://t.me/s/cyrleak", "游戏爆料"],
  ["tg_hxg", "HXG_Channel", "https://t.me/s/HXG_Channel", "游戏爆料"],
  ["tg_notdim", "notdim", "https://t.me/s/notdim", "爆料/杂项"],
  ["tg_galaxyleak", "Galaxy_leak", "https://t.me/s/Galaxy_leak", "游戏爆料"],
  ["tg_seele", "Seele_Leaks", "https://t.me/s/Seele_Leaks", "游戏爆料"],
]
const rss = [
  ["hacker-news", "Hacker News", "https://hnrss.org/frontpage", "科技"],
  ["freedidi", "FreeDiDi 零度博客", "https://www.freedidi.com/feed", "科技"],
]

let sql = ""
// ---------- config ----------
const cfg = {
  app: { timezone: "Asia/Shanghai", title: "Hot News 热点速递" },
  platforms: {
    enabled: true,
    interval_minutes: 60,
    sources: [
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
    ],
  },
  rss: { enabled: true, max_age_days: 1 },
  filter: {
    method: "ai",
    keywords: ["AI","人工智能","OpenAI","大模型","芯片","英伟达","华为","iPhone","苹果","小米","特斯拉","比亚迪","新能源","A股","股市","美联储","比特币","加密货币","游戏","电竞","Steam","原神","星穹铁道","绝区零","米哈游","崩坏","HSR","Genshin","Honkai","Zenless","Hoyoverse","王者荣耀","英雄联盟","版号","新游"],
    max_news_per_keyword: 5,
    rank_threshold: 5,
    min_score: 0.7,
    interests: "请从新闻中选出与用户兴趣相关且重要的条目：科技、AI、财经、汽车、互联网行业的重要新闻，以及游戏行业（米哈游/原神/崩坏星穹铁道/绝区零/Steam/任天堂/暴雪等）的爆料与重要动态。",
  },
  ai: {
    enabled: true,
    provider: "workersai",
    base_url: "https://api.deepseek.com/v1",
    api_key: "",
    model: "@cf/meta/llama-3.1-8b-instruct",
    temperature: 0.8,
    max_tokens: 4000,
  },
  ai_analysis: { enabled: true, language: "中文", max_news_for_analysis: 100, include_rss: true },
  ai_translation: { enabled: true, language: "中文" },
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
    weekly: { enabled: true, day: 7, time: "20:00" },
    categories: ["综合", "AI", "科技", "游戏", "财经", "时政", "其他"],
    category_keywords: {
      AI: ["AI","人工智能","大模型","GPT","Claude","Gemini","Llama","ChatGPT","OpenAI","Anthropic","xAI","Grok","算力","GPU","NVIDIA","英伟达","Cursor"],
      科技: ["开源","GitHub","机器人","自动驾驶","量子","航天","卫星","芯片","半导体","手机","苹果","华为","小米","OPPO","vivo","百度","字节","腾讯","阿里","京东","拼多多"],
      游戏: ["游戏","Steam","原神","崩铁","星穹铁道","魔兽世界","PUBG","APEX","LOL","英雄联盟","CS","FPS","RPG","Switch","PS5","Xbox","Epic","暴雪","米哈游","吉卜力","绝区零","崩坏","Honkai","Genshin","Zenless","Hoyoverse","版号","新游"],
      财经: ["股市","A股","基金","比特币","加密货币","以太坊","美联储","美元","油价","黄金","期货","证券","上市","IPO","财报","融资","估值","汇率","通胀","降息"],
      时政: ["总统","国会","外交","战争","制裁","联合国","北约","拜登","特朗普","普京","主席","国务院","部长","峰会","谈判","台海","朝鲜","韩国","日本","乌克兰"],
    },
  },
  notification: {
    enabled: true,
    channels: {
      feishu: { webhook_url: "" },
      dingtalk: { webhook_url: "" },
      wework: { webhook_url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=3da35028-aa9c-46de-8273-3f78a1edd8b4", msg_type: "text" },
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
sql += `INSERT INTO config (key, value) VALUES ('hotnews:config', ${q(JSON.stringify(cfg))})
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`

// ---------- sources ----------
const now = Date.now()
for (const [id, name, url, topic] of [...tg, ...rss]) {
  const kind = url.includes("t.me") ? "telegram" : "rss"
  const meta = JSON.stringify({ topic })
  sql += `INSERT INTO sources (id, kind, name, title, icon, url, column, color, interval, enabled, pull_enabled, pull_times, meta, created, updated)
  VALUES (${q(id)}, ${q(kind)}, ${q(name)}, ${q(name)}, '', ${q(url)}, 'focus', 'primary', 600000, 1, 1, '[]', ${q(meta)}, ${now}, ${now})
  ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, name=excluded.name, url=excluded.url, meta=excluded.meta, updated=excluded.updated;\n`
}

// ---------- admin user ----------
sql += `INSERT INTO users (id, email, role, password_hash, data, type, created, updated)
  VALUES ('admin_${now.toString(36)}', ${q(ADMIN_EMAIL)}, 'admin', ${q(ADMIN_HASH)}, '{}', 'email', ${now}, ${now})
  ON CONFLICT(id) DO UPDATE SET email=excluded.email, password_hash=excluded.password_hash, role='admin', updated=excluded.updated;\n`

console.log(sql)
console.error("ADMIN_HASH=" + ADMIN_HASH)
