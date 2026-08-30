# 自定义拉取源清单（临时记录）

> 本文件为**运行时配置快照**，列出用户在线上配置中实际启用的自定义拉取源，随仓库一并推送以便审计。非部署必需文件，可随时删除。
> 数据来源：Cloudflare KV `hotnews:config`、`hotnews:subscriptions`（命名空间 `422b526e-…`）。

## 1. 自定义 RSS / 新闻源

| 来源 | 类型 | 地址 | 归属 | 状态 |
| ---- | ---- | ---- | ---- | ---- |
| FreeDiDi（零度博客） | RSS | https://www.freedidi.com/feed | newsnow 前端源（`server/sources/freedidi.ts`） | ✅ 已启用 |
| Hacker News | RSS | https://hnrss.org/frontpage | legacy `rss.feeds` | ✅ 已启用 |
| Yahoo Finance | RSS | （历史 `hotnews:dedup:rss:yahoo-finance` 记录存在） | legacy | ⚠️ 有去重记录，是否仍在启用待确认 |

## 2. Telegram 频道订阅（legacy 推送，英文直译中文）

`hotnews:subscriptions` 中共 6 条，均 `enabled=true`，抓取地址为 `https://t.me/s/<channel>`：

| # | 频道 | 主题（推测） |
| ---- | ---- | ---- |
| 1 | FireflyLeak | 游戏爆料 |
| 2 | cyrleak | 游戏爆料 |
| 3 | HXG_Channel | 游戏爆料 |
| 4 | notdim | 爆料/杂项 |
| 5 | Galaxy_leak | 游戏爆料（崩坏：星穹铁道） |
| 6 | Seele_Leaks | 游戏爆料（崩坏：星穹铁道） |

> 文案策略：这些 TG 频道的英文内容**不做特殊对待，统一直译成中文**后推送。

## 3. 平台热榜源（legacy `platforms.sources`，共 11 个）

今日头条、百度热搜、华尔街见闻、澎湃新闻、bilibili 热搜、财联社热门、凤凰网、贴吧、微博、抖音、知乎。

## 4. 关联配置说明

- 推送时机：每天 **08:00 / 12:00 / 17:00 / 20:00** 四时段整点组装完整消息推送；其余 cron（每 15 分钟）只抓取入库、不推送。
- FIFO 去重指纹：`push_fp:v2:<日期>`；翻译缓存：`tr:v1:*`；平台热榜去重：`hotnews:dedup:*`。