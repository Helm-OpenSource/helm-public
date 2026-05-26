---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Shadow Consume Path Report

## Scope

Sprint 4 让 confirmed opportunity judgement 不再停留在 artifact，而是进入系统的 `shadow layer`。

## Current Consume Path

当前经过 review confirm 后，系统会写入：

- `shadowStage`
- `shadowRiskLevel`
- `shadowNextAction`
- `shadowBlockersSummary`
- `shadowManagerAttentionFlag`
- `shadowStageConfidence`
- `nextStepSummary`
- `lastProgressAt`

同时补充：

- timeline / audit trace
- checkpoint memory
- consumed artifact posture

## What Still Does Not Happen

- no official CRM writeback
- no external send
- no workflow control
- no hidden consume without review

## Result

Sprint 4 现在已经把 judgement 闭环从 `artifact exists` 推进到 `shadow summary exists`，但仍然严格停在 shadow-only 边界内。
