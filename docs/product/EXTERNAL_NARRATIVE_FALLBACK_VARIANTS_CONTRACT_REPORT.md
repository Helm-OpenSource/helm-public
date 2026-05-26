---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# External Narrative Fallback Variants Contract Report

本轮把 `external narrative fallback` 收成了一套独立 reporting contract，核心语义已经固定为：

- `narrativeFallbackJudgement`
- `narrativeFallbackReason`
- `narrativeFallbackBoundary`
- `narrativeFallbackNextAction`
- `narrativeFallbackEvidence`
- `narrativeFallbackLevel`
- `narrativeFallbackAudience`
- `narrativeFallbackSendability`
- `narrativeFallbackMode`
- `narrativeFallbackReviewMode`

当前最小 fallback mode 已成立：

- `non-commitment-fallback`
- `boundary-only-fallback`
- `review-before-send-fallback`
- `blocked-narrative`
- `exploratory-only-narrative`
- `customer-visible-light-fallback`
- `internal-only-fallback`

当前 contract 的放置规则也已经收清：

- 首屏：`judgement / reason / boundary / next action / decision request`
- 次级摘要：`level / audience / sendability / fallback mode / review mode`
- EvidenceDrawer：`replay / audit / memory / worker output / boundary trace / sendability trace / narrative trace / fallback trace / historical changes`
- internal-only：任何会把 fallback-safe wording 误读成 promise 的强化表述
- customer-facing：只允许进入 `customer-visible-light-fallback` 且必须继续显式保留 boundary

短表：

| 项目 | 分类 | 说明 |
| --- | --- | --- |
| External narrative fallback contract | 已经完整成立 | 核心字段、最小 mode、evidence grouping 和降级规则已明确 |
| 完整 conversation / narrative engine | 刻意未做 | 本轮不扩成 messaging platform 或完整 commercial conversation engine |
| 更细 fallback trees | 已成形但仍需下一层 | 当前只有第一轮 detail contract，还没细到更多 scene families |
