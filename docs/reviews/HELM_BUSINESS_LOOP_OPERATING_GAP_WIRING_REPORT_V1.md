---
status: archived
owner: helm-core
created: 2026-04-08
review_after: 2026-10-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_LOOP_OPERATING_GAP_WIRING_REPORT_V1

状态：Implementation Completed  
Owner：Helm Core  
日期：2026-04-08

## 1. 本轮目标

把 `OperatingGap` 从 `PR102` 的统一 operator queue，推进到一条更具体的 business-loop gap：当 KPI 链没有接上时，`/operating` 首屏要先显示这个缺口，而不是继续被说明性内容淹没。

## 2. 当前 established truth

- `missing-kpi-link` 已作为 business-loop `OperatingGap` kind 成立
- `CoordinationMetricsDaily` 缺失会被投影成 `critical` gap
- `CoordinationMetricsDaily` stale 会被投影成 `high` gap
- `buildWorkspaceRuntimeOperatorOverview` 已会把这条 gap 收进 `operatingGaps`
- `/operating` 首屏已会优先把这条 gap 放到：
  - `阻塞`
  - `待决策`
  - `下一步动作`
- 首屏仍然只保留四类信息，没有新增第五类 summary

## 3. 当前 unresolved truth

- `OperatingGap` 仍不是 canonical persisted object
- 当前还没有 canonical KPI object
- 当前还没有把这条 gap 扩到 dashboard 或更多 operator-heavy surface
- 当前 stale threshold 仍是 contract-level 默认值，不是线上校准值

## 4. 当前刻意未做

- schema migration
- dashboard query 扩面
- broader business-loop gap registry
- ontology platform
- execution plane 扩权

## 5. 验证

本轮要求完整验证链全绿。
