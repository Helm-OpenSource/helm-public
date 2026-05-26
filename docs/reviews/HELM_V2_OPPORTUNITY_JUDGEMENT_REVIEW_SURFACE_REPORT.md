---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Opportunity Judgement Review Surface Report

## Scope

Sprint 4 补上了最小但真实的 `opportunity judgement review surface`，位置在：

- [meeting-v2-opportunity-judge-card.tsx](../../features/meetings/meeting-v2-opportunity-judge-card.tsx)

## Supported Review Modes

- `confirm`
- `edit_confirm`
- `reject`
- `keep_draft`
- `block_boundary`
- `insufficient_evidence`

## Surface Shows

- current shadow stage
- proposed shadow delta
- blockers
- next best action
- manager attention flags
- evidence refs
- confidence / open questions
- current boundary notes
- review status

## Boundary

- `confirm` 只表示允许进入 `shadow consume`
- `confirm` 不代表 official CRM writeback
- `confirm` 不代表 customer-facing commitment
- review path 现在是 shadow consume 的唯一合法入口
