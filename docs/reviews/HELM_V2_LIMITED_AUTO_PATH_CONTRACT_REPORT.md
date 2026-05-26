---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Limited Auto Path Contract Report

## 结论

Limited Auto Path contract 已清楚。

当前 contract 已把 `approved guarded write intent` 之后的极窄自动执行路径单独收成：

- `limitedAutoIntentId`
- `sourceWriteIntentId`
- `limitedAutoEligibilityStatus`
- `limitedAutoEligibilityReason`
- `limitedAutoActionType`
- `limitedAutoApprovalRequired`
- `limitedAutoApprovalStatus`
- `limitedAutoExecutionStatus`
- `limitedAutoAckStatus`
- `limitedAutoFailureStatus`
- `limitedAutoRollbackStatus`
- `limitedAutoAuditRef`

## 当前白名单

当前 Sprint 8 只对白名单 action type 建立 limited auto contract：

- `crm.attach_note`
- `crm.attach_handoff_summary`

其中：

- `crm.attach_note` 可以进入 `eligible`
- `crm.attach_handoff_summary` 当前只允许进入 `eligible_but_manual_only`

## 当前明确 blocked / deferred 的动作

以下 action type 本轮不进入 limited auto executable path：

- `crm.update_official_stage`
- `crm.update_next_action`
- `crm.update_blockers`

这些动作仍停留在 Sprint 6 的 guarded manual path，原因是：

- 风险更高
- 影响 official state 更直接
- rollback / reconciliation posture 仍不足
- pilot 默认不应把这类动作纳入 limited auto

## 当前 contract truth

- limited auto 不是 broad auto-write
- limited auto 不等于 send authority
- limited auto 不等于 commitment
- limited auto 只承接 approved guarded write intent，不直接从 shadow recommendation 跳写 official
- Force manual path remains available

## 通过标准结果

已经满足：

- Limited Auto Path contract 已清楚
- allowed / blocked / deferred action type 已清楚
- runtime / eval / audit 可以按统一 contract 实现
