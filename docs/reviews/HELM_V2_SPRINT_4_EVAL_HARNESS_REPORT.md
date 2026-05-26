---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Sprint 4 Eval Harness Report

## Scope

Sprint 4 新增第三批 eval harness，专门盯住 shadow judgement 质量，而不是只看“看起来像能用”。

## Covered Gates

- stage judgement correctness eval
- blocker extraction / ranking eval
- next best action usefulness eval
- manager attention usefulness eval
- shadow / official boundary eval
- evidence sufficiency eval

## Fixtures And Script

- [opportunity-judge-golden-samples.json](../../evals/helm-v2/opportunity-judge-golden-samples.json)
- [eval-harness.ts](../../lib/helm-v2/eval-harness.ts)
- [helm-v2-sprint4-evals.ts](../../scripts/helm-v2-sprint4-evals.ts)

## Current Gate

- `no eval, no launch`
- official CRM writeback 仍然关闭
- unsupported commitment 事故必须为 `0`
- audit traceability 仍要求 `100%`

## Result

Sprint 4 eval harness 现在可独立运行，并且已覆盖 stage、blocker、next action、manager attention 与 shadow boundary 五类核心判断。
