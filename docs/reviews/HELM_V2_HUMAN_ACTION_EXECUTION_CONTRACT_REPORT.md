---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Human Action Execution Contract Report

## 目标

把 `approved draft / approved shadow recommendation` 之后的人工作用层收成统一 contract，而不是让每个页面临时发明下一步动作语义。

## Contract 核心语义

- `executionActionType`
- `executionSourceArtifact`
- `executionOwner`
- `executionIntent`
- `executionBoundary`
- `executionPrerequisite`
- `executionDependency`
- `executionRiskLevel`
- `executionAcknowledgementStatus`
- `executionProofType`
- `executionProofPayload`
- `executionWritebackTarget`

## 当前覆盖的 action type

- `manual_email_send`
- `manual_calendar_send`
- `manual_customer_followup`
- `manual_internal_collab`
- `manual_exec_brief_share`
- `manual_crm_step`
- `manual_handoff_delivery`
- `manual_handoff_customer_success`

## 当前边界

- approved draft 只表示允许你人工执行下一步
- approved shadow delta 只表示允许 shadow consume，不表示 official update
- internal brief / exec brief 只允许 internal-only human execution
- customer-facing human execution 只出现在 approved draft 之后
- blocked by boundary 的动作不会被 execution surface 隐藏

## 当前状态

已经完整成立：

- Human Action Execution contract 已清楚
- Sprint 5 的 UI / audit / memory / eval 都基于同一套 contract

已成形但仍需下一层：

- connector-backed delivery receipt
- richer role-specific execution intents
- external outcome acknowledgement

刻意未做：

- send authority
- auto booking
- official CRM writeback
- workflow control
