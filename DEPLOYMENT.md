# 线上部署快照（2026-08-27）

本目录是 **`news.zjkl.qzz.io`（hot-news Worker）当前线上运行版本**的完整快照，用于版本可回溯与故障回滚。

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
