---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Official Exception State Machine Report

## 结论

Sprint 10 已把 exception / reconciliation 状态机收成统一语义。  
当前 exception / reconciliation 状态机已经成立。

## 当前状态

- `open`
- `investigating`
- `awaiting_manual_action`
- `awaiting_external_receipt`
- `reconciled`
- `resolved`
- `closed_no_change`
- `blocked_by_boundary`

## 当前 exceptionClass

- `ack_failure`
- `ack_unknown`
- `stale_receipt`
- `partial_success`
- `target_conflict`
- `policy_conflict`
- `approval_mismatch`
- `manual_override_required`

## 当前迁移规则

- `open` 可进入 `investigating / awaiting_manual_action / awaiting_external_receipt / resolved / closed_no_change / blocked_by_boundary`
- `investigating` 可进入 `awaiting_manual_action / awaiting_external_receipt / reconciled / resolved / blocked_by_boundary`
- `awaiting_manual_action` 可进入 `investigating / resolved / closed_no_change / blocked_by_boundary`
- `awaiting_external_receipt` 可进入 `investigating / reconciled / resolved / blocked_by_boundary`
- `reconciled` 可进入 `resolved / closed_no_change`

## 当前 boundary

- 不是完整 ticketing 平台
- 不是自动运维
- `resolved` 只表示 follow-through 已收口，不自动等于 external outcome success
- 只有 `acknowledged_success` 才可代表 official write 成功

## 短表

| 项目 | 已经完整成立 | 已成形但仍需下一层 | 刻意未做 | 风险项 |
| --- | --- | --- | --- | --- |
| 状态机 | open / investigating / awaiting / reconciled / resolved / closed / blocked 已清楚 | richer per-role permissions 仍需下一层 | full ticket workflow engine | transition 漂移会直接伤害审计一致性 |
| Exception taxonomy | failure / unknown / stale / partial / override 已清楚 | richer target_conflict mapping 仍需下一层 | auto close without note | exception close without audit 是高风险行为 |

