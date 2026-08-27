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