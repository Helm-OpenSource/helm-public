---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_V2_RISK_PROMISE_GUARD_RUNTIME_REPORT

## 结论

Risk & Promise Guard 已经真实进入 Sprint 3 草稿闭环。

任何 customer-facing draft artifact 在 review 前都先过 Guard。

## 当前输出

- `risk_review.json`
- `approval_requirements.json`
- `sanitized_artifact.md`

## 当前检查项

- promise risk
- pricing / discount risk
- contract risk
- delivery date risk
- data leakage / privacy risk
- source provenance uncertainty
- prompt / content contamination risk

## 当前运行规则

- block 不可跳过
- fallback_non_commitment 是显式 review path
- source provenance uncertainty 继续作为 warning 保留
- approved 只表示允许进入下一步人工 handoff

## 边界

- recommendation 不等于 commitment
- 外部草稿先过 Guard，再进入 review-before-send
- 仍然没有 send authority
- 仍然没有 workflow control
