<div align="center">

# 🔥 Hot-News 消息推送

**把收到的所有消息 —— 包括你手工输入的那条 —— 全部实时推送到企业微信**

一个运行在 Cloudflare Workers 上的轻量级「消息接收 → 企业微信推送」服务。
你只需向它的接口发一条消息（新闻/告警/自己敲的备忘……），它就会把消息立刻推送给你绑定的企业微信群，并自动把每条消息记录到数据库。

`Cloudflare Workers` · `D1` · `KV` · `企业微信群机器人`

</div>

---

## 目录

- [功能特性](#功能特性)
- [架构总览](#架构总览)
- [工作流程](#工作流程)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [企业微信机器人配置](#企业微信机器人配置)
- [部署到 Cloudflare](#部署到-cloudflare)
- [调用方式（API）](#调用方式api)
- [数据存储：D1 与 KV](#数据存储d1-与-kv)
- [常见问题 FAQ](#常见问题-faq)

---

## 功能特性

- 📩 **接收一切消息**：接受外部程序、脚本、网页甚至你手工 `curl` 发来的任意文本消息。
- 🔔 **推送企业微信**：每收到一条消息，立刻推送到你绑定的企业微信群（群机器人 Webhook），实现手机实时通知。
- 🗂 **D1 历史记录**：每条被接收/推送的消息都会自动写入 D1 数据库，可用 `GET /messages` 随时回溯。
- 🔁 **KV 幂等去重**：同一 `msg_id`（或内容相同）在 7 天去重窗口内不会重复推送，避免刷屏。
- 🔐 **单次初始化**：D1 与 KV 只在**首次部署**时创建（由一键脚本 + KV 标记双重保证），重复部署不会重复建库。
- ⚡ **免服务器**：部署在 Cloudflare 边缘网络，自带 HTTPS，无需购买 VPS。

---

## 架构总览

```text
        ┌────────────┐     POST /message      ┌────────────────────────────┐
        │ 消息来源     │ ─────────────────────▶ │   Cloudflare Workers        │
        │ ·脚本/程序    │    {content, title}   │   ·Hot-News Worker          │
        │ ·网页/爬虫    │                        │   ├─ 幂等去重 ──▶ KV (PUSH_KV) │
        │ ·人工 curl   │                        │   ├─ 推送企微 ──▶ 企业微信群机器人 │
        │ (你输入的)   │                        │   └─ 历史记录 ──▶ D1 (HB_DB)   │
        └────────────┘                        └────────────────────────────┘
                                                          │
                                                          ▼
                                               ┌────────────────────────────┐
                                               │   企业微信 · 你的手机收到通知  │
                                               └────────────────────────────┘
```

组件说明：

| 组件 | 名称 | 作用 |
| ---- | ---- | ---- |
| Cloudflare Worker | `hot-news` | 唯一的计算入口，负责接收消息、推送、记录 |
| D1 数据库 | `HB_DB`（`hot-news-db`） | 存储每一条被接收/推送的消息（`messages` 表） |
| KV 命名空间 | `PUSH_KV` | ①消息幂等去重；②数据库初始化标记 |
| 企业微信群机器人 | webhook key | 把消息推送到微信（手机通知） |

---

## 工作流程

1. **接收**：任何来源（脚本、爬虫、网页，或你手工输入）向 `POST /message` 发送一条消息。
2. **去重**：Worker 先用 `msg_id`（缺省则取内容哈希）写入 KV 去重键；若在去重窗口内重复，则跳过推送。
3. **首次建表**：若过去未初始化过，KV 中的标记位会让 Worker 只在**第一次**运行/部署时创建 D1 表结构（之后不再执行）。
4. **推送**：调用企业微信群机器人 Webhook 把消息推送到你的微信群，手机即可收到通知。
5. **落库**：推送结果（成功/失败）随消息一并写入 D1，便于事后查询。

---

## 项目结构

```text
Hot-News/
├── wrangler.toml            # Cloudflare Worker 配置 + D1/KV 绑定
├── package.json             # 依赖与脚本（setup / dev / deploy / migrate）
├── .gitignore               # 忽略 node_modules、wrangler 本地状态、密钥
├── template.dev.vars        # 本地开发时的环境变量模板（复制为 .dev.vars）
├── migrations/
│   └── 0000_init.sql        # D1 首次建表迁移（messages）
├── scripts/
│   └── setup.mjs            # 一键初始化：首次创建 D1+KV 并回填 ID、应用迁移
└── src/
    ├── index.js             # Worker 主入口：路由 + 消息接收/推送/落库
    └── wecom.js             # 企业微信群机器人推送封装
```

---

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone git@github.com:827802685/Hot-News.git
cd Hot-News
npm install
```

### 2. 一键初始化（只在首次部署创建 D1 与 KV）

```bash
npm run setup
```

> 脚本会**自动创建** D1 数据库 `hot-news-db` 与 KV 命名空间 `push_kv`，把真实 ID 回填到 `wrangler.toml`，并应用建表迁移。
> 它的幂等逻辑保证了：**只有 ID 仍是占位符时才会创建**，二次运行会直接跳过，完全符合你对“D1/KV 只在第一次部署创建”的要求。
>
> 前置：先登录 Cloudflare `npx wrangler login`。

### 3. 设置企业微信机器人密钥

```bash
npx wrangler secret put WECOM_WEBHOOK_KEY
# 粘贴你在企业微信群机器人 Webhook 里 ?key= 后面的那串字符
```

### 4. 部署

```bash
npm run deploy
```

部署完成后，会输出一个形如 `https://hot-news.<你的账号>.workers.dev` 的地址，即你的消息推送入口。

### 本地开发

```bash
cp template.dev.vars .dev.vars   # 填好 WECOM_WEBHOOK_KEY
npm run dev                      # 本地起服务，地址 http://localhost:8787
```

---

## 企业微信机器人配置

1. 打开你要接收通知的**企业微信群**（可以是只有你自己的群）。
2. 点击右上角 **⋮（更多）→ 群机器人 → 添加机器人**。
3. 创建一个机器人，复制它的 **Webhook 地址**，例如：
   `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=693axxx6-...`
4. 把 `?key=` 后面那串 `693axxx6-...` 作为 `WECOM_WEBHOOK_KEY` 设置给 Worker。

> 群机器人无需 `corpid` / `AgentId` / `secret`，配置最简单，且能直接推送消息到你的微信。

---

## 调用方式（API）

核心入口是把任意消息（**包含你手工输入的**）推送出去：

```bash
# JSON 形式（推荐）
curl -X POST https://hot-news.<你的账号>.workers.dev/message \
  -H "Content-Type: application/json" \
  -d '{"title":"今日热点","content":"今天是2026年8月24日，这条消息来自我的手工输入。"}'

# 纯文本形式（整段文本当作消息）
curl -X POST https://hot-news.<你的账号>.workers.dev/push \
  -d '我随手记一条：记得给 Hot-News 写文档'
```

你也可以指定 `msg_id` 来控制去重：

```bash
curl -X POST https://hot-news.<你的账号>.workers.dev/message \
  -H "Content-Type: application/json" \
  -d '{"msg_id":"order-20260824-001","title":"订单提醒","content":"用户下单成功，请及时发货"}'
```

**请求体字段：**

| 字段 | 必填 | 说明 |
| ---- | ---- | ---- |
| `content` / `message` | ✅ | 消息正文，会推送到企业微信 |
| `title` | ❌ | 可选标题，会以 `【标题】正文` 的形式展示 |
| `msg_id` | ❌ | 自定义去重 ID，缺省时自动用内容哈希代替 |

**其它端点：**

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `GET` | `/` | 服务概览与端点提示 |
| `GET` | `/health` | 健康检查 |
| `GET` | `/messages?limit=20` | 查询最近推送的历史消息（来自 D1） |

**响应示例（成功推送）：**

```json
{
  "ok": true,
  "msg_id": "a1b2c3d4e5f6a7b8",
  "push_status": "sent",
  "push_channel": "企业微信",
  "push_result": { "errcode": 0, "errmsg": "ok" },
  "record": { "id": 3, "table": "messages" }
}
```

`push_result.errcode === 0` 即表示企业微信推送成功。

---

## 数据存储：D1 与 KV

### KV 命名空间 `PUSH_KV`

| 键 | 用途 | 保存内容 |
| --- | ---- | ---- |
| `dedup:<msg_id>` | 幂等去重，默认 7 天 | JSON：`{"pushedAt": 时间戳}` |
| `db:schema_init` | 首次部署建表标记 | `"done"` |

**KV 的 `db:schema_init` 标记**正是“D1/KV 只在第一次部署创建”的实现：Worker 每次启动会先读这个标记，若不存在才创建表结构并写回标记，之后永远跳过。

### D1 数据库 `HB_DB`（数据表 `messages`）

| 字段 | 类型 | 说明 |
| ---- | ---- | ---- |
| `id` | INTEGER PK自增 | 主键 |
| `msg_id` | TEXT UNIQUE | 消息去重 ID |
| `title` | TEXT | 可选标题 |
| `content` | TEXT | 消息正文 |
| `push_status` | TEXT | `sent` / `failed` |
| `push_detail` | TEXT | 企业微信返回结果 JSON |
| `created_at` | TEXT | 记录时间 |

---

## 常见问题 FAQ

**Q：企业微信提示「网页接口配置错误」或推不出去？**
A：确认 `WECOM_WEBHOOK_KEY` 已通过 `wrangler secret put` 正确设置，且 key 是 `?key=` 后面那一串，不含整段 URL；同时确认目标群还在且机器人未被移出。

**Q：我已经部署过一次了，再部署会重复建库吗？**
A：不会。`npm run setup` 只在 `wrangler.toml` 仍是占位符时创建资源；且运维层有 KV 标记位兜底，保证 D1 建表逻辑只执行一次。

**Q：想让消息也能被某人/某程序订阅而非只有企业微信推送？**
A：本项目聚焦「全部推送企业微信」这一个目标。如需扩展，可在 `src/index.js` 的路由里追加新的推送渠道（如 Bark / Server酱 / 飞书），复用同一套接收与落库逻辑。

**Q：如何查看已经推送过哪些消息？**
A：请求 `GET /messages?limit=50`，返回最近 50 条记录（来源 D1）。

---

## 免责声明

本项目为个人消息推送工具，仅用于学习与日常提醒。请勿用于发送垃圾信息、营销广告或任何违法内容。企业微信群机器人有频率限制（每分钟 20 次），请合理使用。