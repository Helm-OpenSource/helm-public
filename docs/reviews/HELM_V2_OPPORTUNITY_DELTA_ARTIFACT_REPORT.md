---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Opportunity Delta Artifact Report

## Scope

Sprint 4 把 `opportunity shadow delta` 收成统一 artifact，而不是由页面临时拼 judgement 结构。

## Artifact Shape

`opportunity_delta.json` 当前至少包含：

- `stage_shadow_from`
- `stage_shadow_to`
- `probability_delta`
- `decision_criteria`
- `champion_status`
- `blockers`
- `risk_flags`
- `next_best_action`
- `manager_attention_required`

## Layering Rules

- `factDerived` 明确标出 fact-derived judgement basis
- `inferredAssumptions` 明确标出 inferred assumptions
- `suggestionFields` 明确标出仍属于 suggestion 的字段
- 只有经过 review 的 judgement 才能进入 shadow consume

## Result

这套 artifact 现在已经可被：

- opportunity judgement review surface
- shadow summary consume
- timeline / checkpoint update
- future operating home / handoff surfaces

复用，不再依赖页面临时拼装。
