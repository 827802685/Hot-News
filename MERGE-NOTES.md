# newsnow 前端 → 单个 Cloudflare Worker 合并追踪（2026-08-30）

目标：按用户要求，把 newsnow（React19+Nitro）作为前端主体，**合并成单个 Cloudflare Worker**（不拆 Pages 双服务），再把现有 hot-news 的独有能力并入。

## ✅ 已验证里程碑
- 工具链：node v22 / pnpm 10.5 / git 可用，GitHub 可达。
- 源码：`/workspace/hn_repo/newsnow-src`（`827802685/newsnow`，v0.0.41）。
- 依赖：`pnpm install` 约 43s 装完。
- 构建：`nitro.config.ts` 新增 `CF_WORKER=1` → `preset:"cloudflare_module"` + `NEWSNOW_DB`(D1)。
  已跑通 `CF_WORKER=1 npx vite build`，产物在：
  - Worker 入口：`dist/output/public/_worker.js/index.mjs`（export default fetch）
  - 前端静态（index.html/assets/PWA/图标）：`dist/output/public/`
  - 部署：`npx wrangler --cwd dist/output/ deploy`（assets + D1 binding `NEWSNOW_DB`）

## 部署形态
`cloudflare_module` preset：单个 Worker + `assets binding`（托管 newsnow 前端）+ D1。正好"合并成单个 Worker"。

## ⏳ 剩余（下一阶段，需持续推进）
1. **并入独有能力**：把现有 hot-news（`/workspace/hn_repo/deployed/worker.js`）的 fetch 逻辑（honor app：`/setting`、`/api/pull`、`/api/status`、`/rss`）+ scheduled（四时段推送）接入该 Worker 的统一入口，按路径分流：`/`,`/c/*`,`/api/s`,`assets` → newsnow nitro；其余 → 现有逻辑。
2. **D1/KV 决策**：现有独有能力用 HB_DB(KV PUSH_KV)+自建表；newsnow 用 NEWSNOW_DB(cache 表)。需决定复用现有 DB 还是新增，并把 schema 对齐。
3. **cron**：cloudflare-module 默认只有 fetch；需为四时段推送补 scheduled handler（wrapper 或 nitro plugin）。
4. **数据源**：newsnow 自带 `server/sources/*` 抓取；freedidi/RSS、TG 订阅、关键词、AI 摘要作为额外 api/定时并入 Nitro server。
5. **回归 + 部署**：先本地/测试验证，再替换生产 `hot-news` worker（避免停机），修复原"加载中"根因（数据未抓上岸）。

## 已上线改动（独立于合并，先行交付）
- freedidi 源：`https://www.freedidi.com/feed` 已加入 `rss.feeds`（worker.js:2276）。
- TG 英文直译中文：`isEnglishText` 放宽（不搞特殊性），`MAX_NEW` 16→22。
- deployment `10298cdf…`，14/14 测试全绿。