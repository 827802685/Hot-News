# 线上部署快照（2026-08-27）

本目录是 **`news.zjkl.qzz.io`（hot-news Worker）当前线上运行版本**的完整快照，用于版本可回溯与故障回滚。

## 2026-08-28 十二次改动（复推成功/翻译缓存/配图修复/AI 订阅速览·当前线上）

> 十一次改动后在线上发现"推送中断"（用户反馈"怎么不发了"）：每 15 分钟 cron 会把约 119 条英文 Telegram 订阅内容重复翻译，导致单次 Worker 调用 subrequest 数远超默认上限，运行被平台强杀（`Too many subrequests by single Worker invocation`），推送 `wework ok:false`，且流水线锁 `hotnews:pipeline:running` 残留为 `1` 阻塞后续调度。本次一并修复并新增功能。

1. **翻译 KV 缓存 + 单轮条数上限（根治 subrequest 超限）**（`translateItems`/`translateOne`）：新增 `tr:v1:<sha256前28位>` 缓存（7 天 TTL），相同英文文本不再重复翻译；单轮新翻译条数上限 `MAX_NEW=16`。修复后遥测 `hotnews:last:tr` 显示 `need:119 → done:16(cap:16) cacheHit:0`，subrequest 从数百降到个位，推送恢复。
2. **清理卡死流水线锁并验证**：删除 `hotnews:pipeline:running` 后，08:16 cron 用新代码运行成功——`push` 8 个责任方全部 `ok:true`、`imagesSent:4`、`errors:[]`，锁正确复位。
3. **修复 Telegram 配图误抓频道头像**（`parseTelegram`）：t.me 每条消息块顶部都有频道头像 `<img>`（class 在外层 `<i class=...user_photo>`），原逻辑取"第一个 img"导致文字爆料也被配上频道头像图。改为：先取真实媒体（视频 `poster` / 配图 `photo_wrap` 的 `background-image`，并兼容 `&#39;/&quot;/&#x27;` 实体与字面引号），兜底仅接受带 `message_photo` 类名的媒体 `<img>`；纯文字消息不再发图。
4. **AI 整理自定义订阅（`aiTidySubscriptions` + 配置开关）**：新增在每次推送前调用 AI，把本轮订阅（6 个游戏爆料频道）新内容去重、按主题归类，浓缩为中文"订阅速览"并作为推送第一条（配置 `ai_analysis.sub_digest=true` 开启，已在运行配置启用）。纯提示不会刷屏。
5. **部署版本**：本轮在线 deployment 依次 `117e30e3…`（翻译缓存）、`d42e5f2d…`（+AI 订阅速览）、`4b512615…`（+配图修复，即当前线上）。

## 2026-08-28 十一次改动（翻译改走 Workers AI m2m100·当前线上）

> 十次改动后线上遥测仍为 `done:0/need:71`：免密钥 Google 翻译 `translate.googleapis.com`（`client=gtx`）会封锁数据中心 CDN 出口 IP（实测 status 000/429），在 Worker 生产环境不可用。故翻译主通道改为 Cloudflare 原生 **Workers AI `@cf/meta/m2m100-1.2b`**，走 `env.AI` 绑定（免密钥、计入账号 AI 配额、不依赖外部服务、绝不 429 配额耗尽），已用账号 AI REST 接口实测返回 `{"translated_text":"OpenAI为开发人员推出新模型,…"}`。

1. **翻译通道重构**（`translateItems` + `translateOne`）：未再使用 `title || summary` 拼一段再切分（m2m100 对 "||" 分隔符不稳定），改为**标题、摘要分别逐条翻译**；并发 6。
2. **主通道 Workers AI m2m100**：`env.AI.run("@cf/meta/m2m100-1.2b",{text,source_lang:"english",target_lang:"chinese"})`，读 `translated_text`；摘要截前 800 字符防超 token。
3. **兜底 MyMemory**（keyless）：m2m100 失败自动回退 `api.mymemory.translated.net`（免费、有并发限流，非主用），再失败回退原文；翻译绝不影响推送。
4. **遥测升级**：KV `hotnews:last:tr` 增加 `via`（`m2m100`/`mymemory`）字段，便于核对实际使用通道。
5. **部署与验证**：最终 clean deployment `6b3644c7af1f4ead864e7a92ea979057`（已移除诊断探针同步线上）。验证三连（生产 worker 内部实测）：单条探针返回真实中文、30 路并发 `ok=30/30`、8 条真实 Telegram 文本批次 `ok=8/8`；账号 AI API 对全部标题+摘要 `74/74`。说明翻译确已生效。历史 deployment 依次为 `b7851ec…`（m2m100 首跑 04:01 `done:42/need:71`）、`eab1c69…`（并发 6→3 + 重试）、`108ac48…`（批次诊断）。

## 2026-08-28 十次改动（去掉行内署名 + 修复翻译·当前线上）

> 落实用户反馈（截图）："可以把署名删了，有点乱啊，而且翻译呢"。

1. **去掉行内来源署名**（`fmtItem`）：原每条资讯末尾 `（HXG_Channel）`/`（FireflyLeak）` 字样删除，避免重复刷屏显得乱；频道归属仍在各订阅板块头部标注。
2. **摘要去重**（`fmtItem`）：Telegram 解析常把整句同时写入标题与摘要，导致 `[HSR 4.6 BETA] Skins — [HSR 4.6 BETA] SkinsEvanescia…` 这类"摘要以标题开头"的重复；现自动剥离该前缀。
3. **翻译改免密钥 Google 翻译**（`translateItems`）：原走自建 AI（deepseek）批量翻译，其近期持续 429 配额耗尽 → 翻译静默回退原文，用户一直看到英文。现改用 `translate.googleapis.com/translate_a/single`（keyless、稳定、不受 AI 配额限），并发 6 逐条翻译标题+摘要为中文；失败仅回退原文，绝不拖垮推送。
4. **翻译遥测**：写 KV `hotnews:last:tr`（`done` 成功条数/`need` 需要条数/样例），便于核对交付。
5. **部署**：deployment `2946f27df3c540bf89a74fedeebb31b5`（首版）、`07668a35c14c4d459ab799e2ae6d3998`（加遥测），tag `949dfb1f…`，modified_on `2026-08-28T03:20:34Z`。

## 2026-08-28 九次改动（企业微信直接推送图片·当前线上）

> 落实用户反馈"图片能不能发过来 / 能不能直接发图片"，由"图片直链"升级为"直接推送图片消息"。

1. **企业微信图片消息**（`worker.js`）：新增 `arrayToBinaryString`、`md5`（纯 JS 标准 MD5，已用 node 对照官方向量验证全部通过）、`sendWeworkImage`。抓取 Telegram/热点图片 → 校验 ≤2MB → base64 + md5 → 走 `weworkThrottle` 限流，POST `{ msgtype:"image", image:{ base64, md5 } }`，让图片直接显示在群内，无需点开链接。
2. **正文不再塞冗长直链**：`fmtItem` 去掉原 `🖼️ <图片直链>` 行；`renderParts` 在分类板与订阅板分别收集 `part.images`，供发送。
3. **推送循环**（`runPipeline`）：推完每个板块正文后，紧跟在企业微信发送该板块图片；去重、全程每推≤4张防限流；发不出（超 2MB/抓图失败）统一收尾追加一条"请点链接查看"文本兜底，绝不中断推送。
4. **图片落库**（`rss_items` 新增 `image` 列，`ensureSchema` 对旧表 ALTER 补齐）：`upsertRssItems` 随条目录入 `image` 直链并回填旧行；`getRssByDate` 用 `SELECT *` 自动带回。此前 `image` 只存在于"本次新抓到"的内存条目，导致每轮推送仅首次抓到才带图；落库后基于"今日已入库"条目的每轮推送都能稳定直发该日 Telegram 图片。
5. **图片直发遥测**：每轮推送后写 KV `hotnews:last:imgs`（`imagesSent`/失败列表），便于核对交付。
6. **部署**：最终 deployment `61ac0619ba884fa286919a630d82b262`（含图片落库），tag `949dfb1f…`，etag `03814822…`，modified_on `2026-08-28T02:51:19Z`；此前 deployment `763e2eaf…`（首版图片直发）、`74b2a979…`（加遥测）。

## 2026-08-28 八次改动（Telegram 翻译 + 图片解析·当前线上）

> 修复用户反馈的"订阅内容全是英文、想要中文翻译和图片"问题。

1. **`ai_translation` 正式接线**（`worker.js` + `config`）：新增 `isEnglishText` 与 `translateItems`，在每次推送装配前对订阅/Telegram 条目批量翻译标题与摘要为中文；AI 失败（如 429）自动回退原文，绝不影响推送。配置 `hotnews:config` 的 `ai_translation.enabled` 置为 `true`。注意：AI 接口近期 429 配额耗尽时翻译会短暂不可用、只显示原文。
2. **`parseTelegram` 提取图片直链**：新增 `image` 字段，从消息块抓取 `<img src>` / `<video poster>` / `background-image:url()` 的 cdn 直链；`fmtItem` 对带图条目附一行 `🖼️ <图片直链>`，可在企业微信里点开查看。已通过正则用例验证（img/photo bind/video poster 均命中）。
3. **部署**：deployments `fe6d30b3…`、`c739c286…`，tag `949dfb1f…`，modified_on `2026-08-28T01:14:52Z`。

## 2026-08-28 七次改动（Telegram 订阅内容修复·当前线上）

> 修复用户反馈的"从第 3 块起内容变少、订阅的 Telegram 频道消息没进推送"问题。

1. **`parseTelegram` URL/guid 修复**（`worker.js`）：`data-post` 本身已含 `频道/消息号`（如 `FireflyLeak/9418`），旧代码拼成 `https://t.me/${username}/${dataPost}` 得到 `t.me/cyrleak/cyrleak/750`、`url` 还为空 → 触发 D1 唯一索引 `(url,feed_id,date)` 冲突，每个频道 50 条只存下 1 条。现改为 `https://t.me/${dataPost}`，并补 `url` 字段。`rss_items` 的 tg 条目由每条 1 条增至 114 条。
2. **`matchedRss` 改为今日已入库 RSS/订阅条目**（`runPipeline`）：原来只匹配"本次新抓到的" RSS/订阅，Telegram 内容只在首次抓到那次推送出现一次，之后消失 → 表现为第 N 块之后变少。现在基于 `todayRss`（含已入库 Telegram 频道）做关键词筛选，Telegram 内容每次推送都持续可见。
3. **配置扩充**（`hotnews:config` + `deployed/config.json`）：`filter.keywords` 与"游戏"分类关键词补充 `HSR/Genshin/Honkai/Zenless/Hoyoverse/Acheron/星穹/绝区` 等；`report.platform_defaults` 新增"游戏"映射（`tg-`/`telegram`），使 Telegram 频道内容稳定归入游戏板块。线上 `filter.keywords` 对 114 条 tg 条目命中 44 条。
4. **AI 请求超时 120s→60s、重试 1→0 次**（`chat`）：AI 接口近期持续返回 429（配额耗尽），慢响应 + 长超时会拖垮整条流水线；改为快速失败并回退关键词。
5. **流水线锁 TTL 1800→900 秒**：手动触发（`/api/pull`）走 `waitUntil` 后台执行，若全量热点抓取 + 6 个 Telegram 拉取超过后台任务窗口会被杀掉、`finally` 未执行从而锁残留。缩短锁 TTL 使异常后可更快恢复。
6. **部署**：deployment `ef7f44a6fe724c349b7c519dd1c9377b`，tag `949dfb1f…`，modified_on `2026-08-28T00:29:37Z`。

## 2026-08-27 五次改动（板块覆盖优化·当前线上）

> 修复用户反馈的"国际时事/游戏板块简陋、其他板块缺失"问题。已通过 Cloudflare API 重新部署，并同步更新 `hotnews:config`。

1. **分类兜底优化**（`worker.js` 的 `classifyItem`）：
   - 问题：原逻辑未命中分类关键词时直接归入首个分类（时政与社会），今日 475 条中有 388 条（82%）因此堆积在"时政与社会"，而国际时事仅 6 条、游戏 9 条、教育 4 条、体育 3 条，其他板块近乎空白。
   - 修复：未命中关键词时先按**来源平台**（`report.platform_defaults`）归入默认板块，例如华尔街见闻/财联社→财经、知乎/HackerNews→科技、凤凰网→国际、微博/bilibili/贴吧→文化娱乐；再兜底到首分类。实测时政占比由 84% 降至 36%，各板块均有内容。
2. **关键词大幅扩充**（`report.category_keywords`）：国际时事 19→70 个（新增美国/特朗普/欧盟/日韩/俄乌/大选/白宫/军事/导弹/关税等），游戏 29→76 个（新增手游/内测/公测/皮肤/赛季/定档/赛事/育碧等），其余板块同步扩充。
3. **AI 兴趣提示强化**（`filter.interests`）：明确要求覆盖全部九大板块、国际时事与游戏板块的重点方向，减少 AI 只选少数板块的偏差。
4. **文件清单变更**：HTML 模块名随本次部署更新为 `e5a694f7…-setting.html`、`8a656678…-404.html`、`c806c5c4…-help.html`（旧文件名 15e9b0f1/16244ae3/791e70e1 已作废）。

## 2026-08-27 六次改动（AI 候选兜底·当前线上）

> 修复"热点榜单未抓取时段推送只有 top10（单板块）"的问题，使每次推送都能跨板块覆盖。

1. **`runPipeline` 增加 AI 候选兜底**：
   - 问题：热点榜单每小时抓取一次，其余 15 分钟 cron 触发时 `results.hotlist` 为空 → `hotCandidates` 为空 → AI 无候选可筛（`filterByAI` 返回空）→ 推送仅剩 `top` 10 条，集中在少数板块（如 08-28 02:15–03:00 多次推送 `item_count=10`）。
   - 修复：`hotCandidates` 为空时，改用**今日已入库条目**（`todayNews`）去重后取前 200 条作为 AI 候选，保证各板块都有机会被筛选进推送。
   - 效果：与 `pushNow` 函数行为一致；已验证 DB 侧 08-28 条目 9 大板块全覆盖（时政 167 / 文娱 179 / 科技 41 / 财经 34 / 国际 26 / 体育 20 / 游戏 19 / 健康 17 / 教育 7）。
2. **部署**：tag `949dfb1f…`，modified_on `2026-08-27T23:18:49Z`。
3. **AI 筛选 max_tokens 提升**（23:44 二次部署，deployment `1e8c9997…`）：`filterByAI` 的 `max_tokens` 由 2000 提升至 4000，避免模型推理消耗 token 导致筛选列表被 `finish_reason=length` 截断、只选出少数条目。
4. **AI 兴趣提示再强化**（同步上传 KV `hotnews:config`）：在"尽量覆盖九大板块"基础上，明确要求"每个板块至少选择 2 条代表条目（教育、体育可酌情少选）"，进一步保证推送板块齐全。

## 本次改动（相对 08-25 线上版本）

1. **流水线锁加自动过期（防死锁复发）**
   - 问题：`hotnews:pipeline:running` 标记曾因某次异常退出残留为 `1`，导致 cron 每次触发 `runPipeline` 时在入口直接 `return`，既不抓取也不推送（08-24 09:00 → 08-27 13:00 停摆 3 天）。
   - 修复：锁写入改为 `writeKV(env, RUNNING_KEY, "1", 1800)`，即带 **30 分钟 TTL**；即使进程异常退出，锁也会在 30 分钟后自动解除，不会再次卡死。

2. **新增即时推送接口 `POST /message`**
   - 可把任意"我手工输入的消息"立即推送到所有已配置通知通道（含企业微信）。
   - 请求（JSON）：`{"content":"消息正文","title":"可选标题"}`
   - 也支持纯文本 body（整段文本作为消息）。
   - 响应：`{"success":true,"received":{"title","content"},"push":[{"channel":"wework","ok":true}]}`
   - 示例：
     ```bash
     curl -X POST https://news.zjkl.qzz.io/message \
       -H "Content-Type: application/json" \
       -d '{"title":"提醒","content":"记得写周报"}'
     ```

## 文件清单

| 文件 | 说明 |
| ---- | ---- |
| `worker.js` | Worker 主 bundle（ES Module 入口），含上述两处改动 |
| `15e9b0f1…-setting.html` | 控制面板模板（worker 运行时 import） |
| `16244ae3…-404.html` | 404 页面模板 |
| `791e70e1…-help.html` | 帮助页模板 |
| `metadata.json` | 部署 metadata（main_module、11 个绑定、每 15 分钟 cron、nodejs_compat） |

## 绑定（metadata 中包含）

- `DB`（D1，id `12a7a8d3-…`）、`KV`（kv_namespace，id `422b526e-…`）
- `AI`、`AI_API_BASE`、`AI_API_KEY`、`AI_MODEL`
- `NEWSNOW_API_URL`、`S3_BUCKET`、`S3_ENDPOINT`、`S3_PATH_PREFIX`、`S3_REGION`

## 回滚方法

若需还原到上一版本，可用上一版本 bundle 覆盖部署：

```bash
# 用 Cloudflare API 重新上传（4 个模块 part + metadata），procedure 参见 scripts/upload.md
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/<account>/workers/scripts/hot-news" \
  -H "Authorization: Bearer <token>" \
  -F "metadata=@metadata.json;type=application/json" \
  -F "worker.js=@PREV_worker.js;type=application/javascript+module;filename=worker.js" \
  -F "./15e9b0f1…-setting.html=@…;type=text/plain" \
  -F "./16244ae3…-404.html=@…;type=text/plain" \
  -F "./791e70e1…-help.html=@…;type=text/plain"
```

> 注意：任何回滚/更新都必须同时提交 `worker.js` 与 3 个 HTML 资源模块，否则 worker 会因找不到 `import` 的模块而部署失败。

## 2026-08-27 二次改动

1. **AI 今日总结单独一条且置顶(置后)**:`renderParts` 不再把总结嵌进「综合」条目,改为在所有热点/订阅消息**之后**追加独立一条 `【AI 今日总结】`。
2. **热点资讯加入游戏**:确认分类列表含「游戏」,并补强线上配置 `filter.interests` / `filter.keywords` 的游戏关键词,使游戏新闻更易被 AI 筛选捞进热点。

## 2026-08-27 三次改动（含完整板块设计·当前线上）

> 按完整「每日热点板块设计」重排热点分类,线上 `hotnews:config` 已更新,归档见 [`deployed/config.json`](deployed/config.json)。

1. **热点分类扩展为 9 大板块**(`report.categories`)：
   1. 时政与社会　2. 财经与商业　3. 科技与互联网　4. 国际时事　5. 文化与娱乐　6. 教育　7. 体育　8. 游戏　9. 健康与生活
   同时删除旧的「综合 / AI / 其他」占位分类。
2. **逐板块配置关键词**(`report.category_keywords`)：为上述 9 类分别维护独立关键词集,`顶级`(top) 条目将据其归类到对应板块输出；「游戏」分类含 29 个关键词(新游、版本更新、新赛季、电竞 LPL/KPL 等)。
3. **筛选兴趣与关键词同步更新**(`filter.interests` / `filter.keywords`)：扩大为覆盖 9 大板块,并重点强调游戏与各板块热点,确保 AI 筛选阶段即能捞取各板块新闻。

## 2026-08-27 四次改动（推送限流优化 + 手机端适配·当前线上）

> 修复改 9 板块后批量推送被企业微信限流(429)、以及控制面板/首页在手机上错位的问题。已通过 wrangler 重新部署（wrangler 自动把 `worker.js` 引用的 HTML 当文本模块打包,`metadata` 需含 `modules:[{name:'...setting.html',type:'text'}]` 才不报 `Cannot use import statement`）。

1. **企业微信推送限流(429)**,`src/push/wework.js`：
   - 新增按 `webhook_url` 的**全局节流队列** `weworkThrottle`：同一 webhook 两次发送至少间隔 4 秒（折算每 20 秒最多 5 条）,批量推送时自动排队,避免一次 10 条超限。
   - 命中 429 / `errcode 45009` 时**自动退避重试**(递增 6s/12s/18s/24s,最多 4 次)，仍失败则返回明确错误。
2. **控制面板手机端适配**(`...-setting.html`)：补 `@media (max-width:720px)` 响应式——侧栏由固定 200px 改顶部横滑导航、卡片单列、按钮/输入换行,解决手机上错位与横向溢出；顺带 `main/panel/auth` 内边距收窄。
3. **首页 dashboard 手机端适配**(`renderDashboard` 内联 CSS)：header 允许换行、操作链接紧凑换行、条目列表在窄屏可折行,避免头部挤压错位。
