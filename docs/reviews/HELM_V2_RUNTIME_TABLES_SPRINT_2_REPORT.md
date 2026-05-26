---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_RUNTIME_TABLES_SPRINT_2_REPORT

## 目标

把 Helm v2 Sprint 1 的 contract-only runtime object，推进成能够真实承载 `meeting -> action pack` 闭环的最小持久化层。

## 本轮落地

本轮已经新增并接入以下最小 runtime tables：

- `RuntimeEvent`
- `WorkerRun`
- `ArtifactBundle`
- `MemoryItem`
- `ApprovalRequest`
- `ArtifactReview`

同时把 `Opportunity` 补上了 shadow-only 写入字段：

- `shadowStage`
- `shadowRiskLevel`
- `shadowNextAction`
- `shadowBlockersSummary`
- `shadowManagerAttentionFlag`
- `shadowStageConfidence`
- `shadowUpdatedAt`

对应 migration：

- [202604020001_helm_v2_runtime_sprint2/migration.sql](../../prisma/migrations/202604020001_helm_v2_runtime_sprint2/migration.sql)

## 关系 truth

这些对象都继续挂在当前 main truth 上：

- `Workspace` 仍是唯一运行边界
- `Meeting` 仍是 Sprint 2 的第一触发对象
- `Opportunity` 只新增 shadow write path，不新增 official write path
- `Company` / `Meeting` / `Opportunity` 只是 runtime refs，不引入第二套 tenant / object tree

## 当前最小状态集

- Runtime：
  - `queued / running / completed / failed`
- Artifact：
  - `draft / reviewed / confirmed / consumed / rejected`
- Memory：
  - `draft / confirmed / promoted / deprecated`
- Approval：
  - `pending / approved / rejected`

## 本轮结论

最小持久化 runtime tables 已经成立，而且已经被 Sprint 2 的真实 meeting runtime 消费。  
当前这条链不再依赖纯内存 contract 模拟。

## 刻意未做

- 没有一次性把所有 planned v2 tables 全落完
- 没有 official CRM writeback table/path
- 没有 team mode runtime table
- 没有 sandbox/runtime isolation layer

## 风险项

- 当前 runtime tables 只覆盖 Sprint 2 的最小闭环，还不是完整 Helm v2 全域 runtime schema
- `ArtifactReview` 仍是 meeting-first 的最小 review object，不是通用审批平台
