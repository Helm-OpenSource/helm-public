---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm BI Report Skill Push Dry-Run Skeleton Report V1

更新时间：2026-04-13  
结论：Implementation Completed

注：

这份文档保留 PR 初始 dry-run skeleton 里程碑，同时记录当前主干已经继续推进到 Guangpu-scoped real outbound seam。文件名不改，只用于保留这条演进链的历史锚点。

## 本轮落地

本轮把 `BI report intelligent analysis push` 从纯设计推进到一条可本地 dry-run 的代码骨架：

- 新增了 `BiReportSubscription / BiReportRun / BiReportDelivery` 的 Prisma 草案与 migration skeleton
- 新增了 file-based `report-skills/` contract，并附带 `bi_revenue_daily` 示例包
- 新增了 `skill-loader / schema-validator / metric-engine / result-evaluator / message-renderer / run-service`
- 新增了 `BI_REPORT_ANALYSIS` LLM task type、prompt registry 和 workflow
- 新增了 `scripts/run-bi-report-push.ts`
- 新增了 dry-run delivery adapter skeleton：
  - `DINGTALK_GROUP_WEBHOOK`
  - `DINGTALK_APP_MESSAGE`
- 新增了最小测试，覆盖 skill 读取、schema 校验、指标判级、message render 和 run-service
- 补齐了几条关键 fail-fast：
  - 空结果不再被当作正常报表继续判级
  - subscription 与 skill key/version 不一致时直接报错
  - delivery channel 超出 skill 支持范围时直接报错
  - skill 自带 `prompt.md` 现在会真正进入 BI LLM workflow

## 当前成立 truth

当前已经成立的是：

- `ODPS report -> deterministic metric evaluation -> LLM explanation -> DingTalk push` 这条链的 file-based contract
- workspace subscription / run / delivery 的数据模型草案
- 本地 dry-run execution skeleton
- Guangpu-scoped real DingTalk outbound seam
- Guangpu `/reports` readout surface / API
- `bi_revenue_daily` 这份 end-to-end 示例 skill

## 当前仍未成立

当前仍未成立的是：

- 真实 ODPS 查询 runtime
- subscription UI
- 手动重跑页面
- persisted run / delivery runtime write path

## 当前诚实边界

- 这仍然不是完整 BI 平台
- 这仍然不是 auto-remediation / auto-execution plane
- 这条线是独立 outbound delivery seam，不把现有 DingTalk read-only connector 写成 send/write-back 已成立
- `LLM` 仍然只负责解释，不负责定级
- 当前 outbound 只在 Guangpu BI runtime 范围内成立，不代表 broad send/write-back platform 已完整成立

## 本轮没有扩张

- 没有接真实 ODPS credential/runtime
- 没有把现有 DingTalk connector 扩成 broader send/write-back platform
- 没有新增页面或 broader orchestration surface
- 没有开放 arbitrary SQL editor

## 验证

尝试运行：

- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`

当前环境未通过，原因不是代码报错，而是本地 dev dependencies 缺失：

- `tsx: command not found`
- `tsc: command not found`
- `eslint: command not found`

因此本轮只能完成：

- diff 自检
- `git diff --check`

## 演进后下一步

1. 先把本地依赖装齐，跑 `self-check / boundary-check / typecheck / lint / test`
2. 把 `run-service` 接到真实 persisted run/delivery write path
3. 把 ODPS 查询 bridge 从 sample-input 切到真实 query adapter
4. 把 schedule / retry / dedupe runtime 接上真实 subscription orchestration
