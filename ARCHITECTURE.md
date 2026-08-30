# Hot News Worker 架构梳理与优化方案

> 对象：`worker.js`（cloudflare worker，线上 `news.zjkl.qzz.io`）
> 目的：整合既有改动与部署记录，梳理完整数据流，定位"消息烦、不精、排版乱、重复多"的具体根因，并给出分优先级优化方案。

---

## 一、整体架构与数据流

Worker 采用"定时 cron 触发 + 单态 `runPipeline` 流水线 + 多通道推送"的单体结构。入口在文件末尾：

```
worker_default = { fetch: app/handler, scheduled: runPipeline(cron) }
```

### 1.1 触发入口

| 入口 | 路径 | 说明 |
| --- | --- | --- |
| `scheduled` | `worker.js:6600` | 按 cron（约 15 分钟）触发，仅调 `runPipeline(trigger:"cron")`，结果写入 KV `hotnews:pipeline:last` |
| `fetch` | `app` 路由 | 提供手动 `/api/pull`、`/rss/telegram/channel/:user`、配置编辑等 HTTP 接口 |

### 1.2 单轮流水线 `runPipeline`（worker.js:4389）

每次触发按顺序执行，单函数内串联全部职责：

```
getConfig
  ├─ ensureSchema (建表)
  ├─ 平台抓取 (cfg.platforms.enabled 且达到间隔) → todayNews(每日池)
  ├─ 订阅抓取 fetchSub → rssNewItems(本轮新抓,rss)/subNewItems(本轮新订阅,sub)
  ├─ 筛选
  │    ├─ AI 模式 filterByAI / 关键词模式 filterByKeywords → matchedHot
  │    └─ 关键词筛选 rssNewItems → matchedRss(only 本轮新抓)
  ├─ top = dedupeItems(flatToday).slice(0, top_count)
  ├─ rssAlways = subNewItems
  ├─ hotGroups(平台/关键词分组)
  ├─ aiAnalyze(每天一次, KV 记忆 ANALYSIS_KEY=today) → analysis
  ├─ 翻译 translateItems(matchedRss + rssAlways)  → _zh/_zhSummary (KV "tr:v1:" 缓存)
  ├─ renderParts(cfg, data) → parts[]
  │     ├─ 【热点资讯】按分类(综合/AI/科技/游戏/财经/时政) 每类一个 part，行=fmtItem
  │     ├─ 【订阅更新】按 feed_name 分组，每个频道一个 part
  │     └─ 【AI今日总结】analysis
  ├─ aiTidySubscriptions → 【订阅速览】digest，unshift 到 parts 首位
  └─ 推送
        ├─ 每个 part → push() 独立消息 (feishu/dingtalk/wework)
        └─ wework 图片消息(每轮 ≤9 张,URL 去重)
```

渲染核心 `renderParts`（worker.js:3037）与单条格式 `fmtItem`（worker.js:2911）、正文清洗 `cleanSubText`（worker.js:2892）。

### 1.3 去重现状（已有三层，但仍有漏洞）

1. `upsertRssItems` 按 guid 入库去重 → 同一订阅条目仅首次抓取进 `rssNewItems`。
2. `rssNewItems` 定义为"本轮新抓"，`matchedRss` 只取它 → 已修"订阅混入热点并跨轮重推"（十五次改动）。
3. `renderParts` 内 `seen` 集合做**全 push 统一判重**（`itemDedupKey`，worker.js:2816/3037）：普通消息按标题，纯媒体按图片 URL。

---

## 二、现存问题（按影响排序）

### 🔴 P0 — 就"消息烦、重复多"而言的根因

**问题 1：订阅"速览 digest"与"更新明细"内容双重冗余（最核心）**
- 同一批本轮新订阅 `rssAlways`：
  - 先被 `aiTidySubscriptions` 精炼成【订阅速览】digest，`unshift` 到推送首位（worker.js:4615-4620）；
  - 又被 `renderParts` 逐个频道逐条渲染成【订阅更新】(worker.js:3085) 发出来。
- `seen` 去重只作用于明细，**digest 完全绕过**。于是用户同一时段先收到"AI 速览"版的爆料，又收到逐条直译明细，同内容出现两次，且互为不同文案 → "无用重复消息过多"的直接来源。

**问题 2：每轮被拆成多屏独立消息，造成刷屏**
- `parts` 里 digest + 每个分类 + 每个订阅频道 + analysis 各自 `push` 一条。约 15 分钟一轮、一天几十轮，用户收到的是"一屏一屏"的短消息（尤其纯媒体频道折叠后每条还配图单独推）。"排版乱""刷屏"很大程度来自**拆分粒度**而非单条文案。

**问题 3：跨轮重复未根治**
- `seen` 是 `renderParts` 的内存态，**不跨 cron 轮次**。
- `top = dedupeItems(flatToday)`：只要条目今日仍在库里、下轮平台到期重抓时仍在，就会被再推；
- 翻译缓存使 `_zh` 稳定，标题去重 key 跨轮相同；若同一 item 下轮再次进 `matchedRss`/`top`，会再次整条推送。

### 🟠 P1 — 就"不精、排版乱"而言

**问题 4：「一段就几个字」**
- `fmtItem` 对摘要做硬截断：订阅 60 字、热点 100 字（worker.js:2932），中文被按字节/字符硬切，段落断裂成"半句"。
- 订阅有标题无摘要时输出仅 `• [平台] 标题`；标题与摘要经 `cleanSubText` 后又互相裁剪，经常只剩几个字。
- 句子用 `—` 拼接"标题 — 摘要"，视觉上一条条都很短促。

**问题 5：cleanSubText 误伤**
- worker.js:2901 把 `—`/`–`/`…`/`·`/`*`/`_` 一律折叠/替换为顿号 `、`，**会破坏人名与版本号之间的 `·` 分隔**（如 `5.2卡芙卡·夜织`、`丹恒·溯渊`），导致姓名被 `、` 连成一句，语义与排版双受损。
- 对外链、`【标签】`、`投稿者:` 的清理较硬，部分英文内文残留碴子，导致短句、"不精"。

**问题 6：平台标签不全**
- `platformLabel`（worker.js:2910）只映射少数 ID；未知平台回退原始 id（如 `bilibili-search`、长英文 id），正文出现"英文乱码 id"，排版观感差。

**问题 7：纯媒体图连续刷屏**
- 整频道折叠成一行 `媒体消息 ×N` 已改善（十五次改动），但 N 张真实图仍每轮 ≤9 张分批作为 `image` 单独推送，纯图频道依旧占满多屏。

### 🟡 P2 — 结构性

**问题 8：runPipeline 单函数过重**
- 抓取+筛选+渲染+翻译+分析+推送全堆在一个函数（4389–4700+ 行），改一处牵动全局，回归面大。

**问题 9：去重依赖标题字符串**
- `itemDedupKey` 用规范化标题比较，转发/轻微改写/加标签的重复难以命中；应引入"推送指纹 hash"持久层。

**问题 10：历史遗留**
- 流水线锁 `RUNNING_KEY` 曾在 `waitUntil` 超时被强杀后残留 `1` 阻塞调度（已人工复位）；长任务超 subrequest 限制（已加翻译缓存与 MAX_NEW=16 缓解）。

---

## 三、优化方案

### P0 优先（直接对应用户"重复多、刷屏"痛点）

**优化 1：订阅【速览 vs 明细】二选一（根治 digest 重复）**
- `sub_digest=true` 时：只发【订阅速览】，不再渲染【订阅更新】明细；`renderParts` 内跳过 `rssAlways` 明细块。
- `sub_digest=false` 时：再保留逐条明细。
- 由 `cfg.ai_analysis.sub_digest` 布尔控制，default 保持当前开启。

**优化 2：跨轮持久去重（根治重复推送）**
- 新增 KV "推送指纹"：`push_fp:v1:<sha256(规范化正文/图片URL)> → <today>`，TTL 48h。
- push 前/渲染前检查：当天已推则整条跳过；新增、更新的条目才发。基于内容哈希，可识别跨轮重推。

**优化 3：热点"增量推送"，不整榜重推**
- 只推 `top`/`matchedHot` 相对上次**新增**的条目；榜单内容稳定时本轮少发或不发，仍保留"配图、榜单类"不被误杀。
- 对纯媒体频道：将"每轮 ≤9 图逐个推"改为"首轮发代表性 1–2 图，其余仅计数"，抑制图片刷屏。

### P1 优先（对应用户"不精、排版乱"）

**优化 4：智能化摘要**
- 截断改为按标点/词边界断句，优先在 `，。；！、` 处收尾，避免半句；
- 摘要过短（<N 字）或与标题高度重合时**并入标题省略**，不再拼 `标题 — 摘要`。

**优化 5：cleanSubText 细化**
- 只清理行首 `———`/装饰符与 `【标签】`/`投稿者:`/外链噪音；
- **保留人名/版本分隔 `·`**，不再折叠为顿号；顿号连续仅当确为列表时合并。

**优化 6：平台标签补全 + 兜底**
- 补全 `platformLabel` 全部平台 id，未知 id 统一回退中文"其它/热榜"，杜绝英文 id 乱码。

### P2 结构性

**优化 7：拆流水线**
- 拆 `crawl` / `select` / `render` / `push` 多函数，统一入参 `ctx`，便于独立测试与回滚。

**优化 8：digest 改为"全天增量综合"**
- 由"每轮都生成"改为"当天首次有增量才生成一次、后续轮次只补新差异"，避免一天内 digest 内容高度重叠。

---

## 四、落地优先级建议

| 优先级 | 动作 | 期望效果 |
| --- | --- | --- |
| P0 | digest 与明细二选一 + 跨轮持久去重 | 直接消灭"同内容推两遍、跨轮重推" |
| P0 | 热点增量推送 + 媒体图限量 | 单轮消息数大幅下降，不再刷屏 |
| P1 | 智能摘要 + cleanSubText 细化 + 平台标签兜底 | 每条消息完整精炼、排版干净 |
| P2 | 拆分流水线 | 降低维护与回归成本 |

### 已落地（worker.js 已改，待部署验证）

- **订阅【速览 vs 明细】二选一**：`renderParts` 在 `ai_analysis.sub_digest=true` 时跳过逐条订阅明细，避免与 AI 速览重复刷屏。
- **跨轮持久去重**：新增 KV 指纹 `push_fp:v2:<日期>`（48h TTL），`runPipeline` 对 top/热点/订阅做当日去重，杜绝同一新闻因仍在库中被跨 cron 轮次整条重推。
- **智能摘要 `smartClip`**：按句末/逗号/顿号等自然断点截断，替代硬切，解决"一段几个字"。
- **cleanSubText 细化**：保留人名/版本号中间 `·` 与有意义连字符，只折叠分隔性破折号；补齐 `via t.me` 外链与 `投稿:…` 去噪。
- **平台标签补全 + 兜底**：扩充映射，未知/超长 id 回退中文，消除英文 id 乱码。
- 语法校验通过、`test_v3.mjs` 13 项行为测试全绿，待生产部署与下一轮 cron 复核。

> 部署与版本历史见 `DEPLOYMENT.md`；单测/验证脚本见工作目录 `test_*.mjs`。