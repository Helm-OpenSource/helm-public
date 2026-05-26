---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Richer Official Approval Matrix Report

## 结论

Sprint 9 已把 richer official coverage 的 whitelist / eligibility / approval matrix 收紧到 current-main truth。

## 当前矩阵

- `crm.attach_note`
  - tier: `A3`
  - approvals: `owner`
  - Risk Guard: required
  - pilot: enabled
  - limited auto: `eligible`
- `crm.update_next_action`
  - tier: `A3`
  - approvals: `owner`
  - Risk Guard: required
  - pilot: enabled
  - limited auto: `eligible`
- `crm.update_blockers`
  - tier: `A3`
  - approvals: `owner`
  - Risk Guard: required
  - pilot: disabled for limited auto expansion
  - limited auto: `eligible_but_manual_only`
- `crm.attach_handoff_summary`
  - tier: `A4`
  - approvals: `owner`, `manager`
  - Risk Guard: required
  - pilot: disabled
  - limited auto: `eligible_but_manual_only`
- `crm.update_official_stage`
  - tier: `A4`
  - approvals: `owner`, `manager`
  - Risk Guard: required
  - pilot: disabled
  - limited auto: `blocked`

## 为什么这轮仍然安全

- richer coverage 没有复用 draft-only 的宽松规则
- 每个 action type 的 eligibility / approval / acknowledgment 都单独定义
- `crm.update_blockers` 虽然继续支持 guarded path，但 current main 明确不把它推进到 executable limited auto
- `crm.update_official_stage` 继续停在 blocked posture

## 当前结论

已经完整成立：

- whitelist
- eligibility posture
- official approval tier
- owner / manager / Risk Guard 边界

已成形但仍需下一层：

- per-adapter capability matrix
- connector-backed approval escalation
- richer org-specific policy overrides
