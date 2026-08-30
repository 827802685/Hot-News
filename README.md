<div align="center">

# 🔥 Hot-News 实时新闻聚合与推送

**一个 Cloudflare Worker 同时承载：newsnow 风格的主页（卡片新闻墙）+ 旧后台（订阅抓取 / 多源 / AI 翻译 / 企业微信推送 / 四时段定时）**

`Cloudflare Workers` · `D1` · `KV` · `newsnow` · `企业微信群机器人`

</div>

---

> ### ⚠️ 线上真实形态（务必先读）
> 线上主站 **`news.zjkl.qzz.io`（hot-news Worker）** 现在跑的是**整合版**：
> - **主页**（`/`）= newsnow 卡片式新闻墙（纯 SPA，前端读 `NEWSNOW_DB` 的 `cache` 表）；首页右下角有「⚙ 管理」浮动入口。
> - **旧后台**（`/setting` 及 `/setting/api/*`）= 旧的 hot-news 控制面板（订阅、推送、AI 配置），账号密码存在 **KV**（`hotnews:auth:*`）。
> - **定时任务** `*/15 * * * *` → 走 `legacy.scheduled` 跑 采集→筛选→翻译→四时段推送 管线。

> 整合入口见 [`integration/index.js`](integration/index.js)，按路径把请求分流到 newsnow 或 legacy。

---

## 目录

- [架构总览](#架构总览)
- [项目结构](#项目结构)
- [两套系统的分工](#两套系统的分工)
- [账号密码存在哪](#账号密码存在哪)
- [构建与部署](#构建与部署)
- [绑定与配置](#绑定与配置)
- [定时任务](#定时任务)

---

## 架构总览

```text
                          news.zjkl.qzz.io  →  hot-news Worker (整合版)
┌────────────────────────────────────────────────────────────────────┐
│ integration/index.js（路径分流）                                    │
│   ├─ / 、 /api/*（newsnow 侧）  → newsnow 前端 SPA + api            │
│   └─ /setting 、 /api/pull …     → legacy-worker.js（旧后台+推送）    │
└───────┬────────────────────────────────────────────────────────────┘
        │
        ├─ assets = dist/output/public   → newsnow 前端静态资源(SPA)
        ├─ NEWSNOW_DB (D1)              → newsnow 的 cache 表(网页数据)
        ├─ DB (D1 hot-news-db)          → 旧后台的 rss_items / push_records
        ├─ KV                          → 账号密码(hotnews:auth:*)、去重、流水线锁
        └─ AI (Workers AI) + AI_API_KEY → 英文→中文翻译 / AI 筛选
```

## 项目结构

```text
Hot-News/
├── README.md
├── integration/               # 整合入口（路径分流逻辑）
│   └── index.js
├── legacy/                    # 旧 hot-news 后台 + 抓取 + 推送（唯一形态为编译 bundle）
│   └── worker.js              # 259KB bundle：/setting、订阅、AI、企业微信、四时段
├── newsnow-src/               # newsnow 前端 + API（上游 ourongxing/newsnow 移植）
│   ├── server/  src/  shared/ # TS 源码（数据源 / api / 前端组件）
│   ├── nitro.config.ts        # 支持 cloudflare_module(单 Worker D1) 预设
│   ├── wrangler.hotnews.toml  # ★ 本仓库部署用配置（main + assets + 绑定 + cron）
│   ├── integration-worker.js  # 构建产物：整合后可直接部署的 Worker（纳入仓库便于复现）
│   └── dist/output/public/    # 构建产物：前端静态 assets（纳入仓库便于复现）
├── deployed/                  # 部署历史快照与 metadata（回滚参考）
├── migrations/0000_init.sql   # D1 建表迁移参考
├── DEPLOYMENT.md              # 历次线上改动记录
└── ARCHITECTURE.md            # 深度架构说明
```

> `node_modules` 与会漂移的构建中间产物已 gitignore；`dist/output/public` 与 `integration-worker.js` 特意保留，确保 clone 后能直接用 wrangler 复现线上。

## 两套系统的分工

| 能力 | 归属 | 数据存储 |
| ---- | ---- | ---- |
| 新闻主页（卡片墙，newsnow 风） | newsnow 前端 + api | `NEWSNOW_DB` 的 `cache` 表 |
| 控制面板（`/setting`） | legacy | 配置在 KV `hotnews:config` |
| 订阅源 / RSS / TG 频道抓取 | legacy | `DB` 的 `rss_items` |
| 英文→中文翻译（TG 直译） | legacy（`AI` / `AI_API_KEY`） | 翻译缓存 KV `tr:v1:*` |
| AI 新闻筛选 / 每日总结 | legacy | KV / D1 |
| 企业微信 / 多通道推送（含四时段：08/12/17/20） | legacy | `push_records` |
| 热点榜单多平台抓取 | legacy（`DOUYIN_COOKIE` 等） | `DB` |

## 账号密码存在哪

**存在 Cloudflare KV，不是 D1，也不是环境变量。**

| KV Key | 内容 |
| ---- | ---- |
| `hotnews:auth:email` | 管理员邮箱（登录账号） |
| `hotnews:auth:password_hash` | 密码的 SHA-256 哈希（加盐，不存明文） |
| `hotnews:session:*` | 登录会话（7 天） |
| `hotnews:config` | 全部运行配置 |

> 密码只存哈希，无法反推明文。登录即用「原邮箱 + 原密码」；你在 `/setting` 首次设置的账号就一直存在 KV 里（`needsSetup=false` 即代表已设置）。

## 构建与部署

前置：登录 Cloudflare（token 或 `wrangler login`）。

```bash
cd newsnow-src

# 1) 若改过前端/源码，先构建出 dist + integration-worker.js
#   （线上当前产物已在仓库，如果只是部署可跳过构建）
npm run build            # 生成 dist/output/public 与 nitro cloudflare_module 产物
node scripts/bundle.mjs  # （可选）把整合入口重新打成 integration-worker.js

# 2) 部署到 hot-news 主站（含 assets + D1 + KV + cron）
CLOUDFLARE_API_TOKEN=你的token npx wrangler deploy -c wrangler.hotnews.toml
```

> 部署会把 `main=integration-worker.js`、静态 `assets=dist/output/public`、三个绑定（`NEWSNOW_DB`/`DB`/`KV`）与 `*/15` 定时一起推上去。

## 绑定与配置

`newsnow-src/wrangler.hotnews.toml` 中已声明：

| 类型 | 名 | 说明 |
| ---- | ---- | ---- |
| D1 | `NEWSNOW_DB` | newsnow 数据（`newsnow-db`） |
| D1 | `DB` | 旧后台数据（`hot-news-db`） |
| KV | `KV` | 账号 / 去重 / 配置 / 流水线锁 |
| assets | `ASSETS` | newsnow 前端静态资源 |
| vars | `AI_API_BASE/KEY/MODEL` | 翻译与 AI 筛选 |
| vars | `NEWSNOW_API_URL` | newsnow 官方 API 兜底 |
| vars | `S3_*` | 可选 S3 归档 |
| vars | `DOUYIN/WEIBO_COOKIE` | 微博/抖音热榜 Cookie |

## 定时任务

- **cron**：`*/15 * * * *`（每 15 分钟）
- **执行体**：`legacy.scheduled`（见 `legacy/worker.js`）
- **行为**：每轮均抓取入库；仅在 **08:00 / 12:00 / 17:00 / 20:00** 四个整点组装并推送完整消息（非整点只入库、不推送）。

---

## 免责声明

本项目为个人新闻聚合与消息推送工具，仅用于学习与日常使用。请合理使用第三方数据源与推送渠道（均有频率限制）。