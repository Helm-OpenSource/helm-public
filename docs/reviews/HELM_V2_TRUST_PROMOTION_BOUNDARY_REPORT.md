---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Trust Promotion Boundary Report

## 总结

trusted / untrusted / draft promotion 边界已成立。

Sprint 7 没有把 richer connector ingestion 当成“更多内容自动进入长期记忆”，而是把 trust 和 promotion 规则写进了系统行为。

## 当前层级

当前显式层级包括：

- `trusted`
- `untrusted`
- `draft_only`
- `human_confirmed`
- `system_of_record`
- `deprecated`

## 当前 promotion 规则

当前显式规则包括：

- `none`
- `human_confirmed`
- `system_of_record`
- `repeated_pattern_candidate`

当前 `repeated_pattern_candidate` 仍是 deferred candidate，不在本轮启用自动 promotion。

## 当前 truth

- untrusted 输入不能直接 promotion。
- 原始 transcript、email thread、document attachment 只能先停在 draft layer。
- `system_of_record` 来源可直接支撑 object fact。
- inferred 永远不能直接替代 fact。
- confirm 后可 promotion 的内容，必须保留 evidence 和 provenance。

## 已经完整成立

- trust boundary logic
- promotion eligibility posture
- `human_confirmed` / `system_of_record` 双通路

## 已成形但仍需下一层

- repeated-pattern detection
- richer invalidation / revalidation
- cross-source consistency scoring

## 刻意未做

- untrusted 自动 promotion
- inferred 自动替代 fact
- repeated-pattern 自动升格

## 风险项

- richer connector 接入后，trust taxonomy 还会继续变复杂
- 若未来启用 repeated pattern promotion，必须先补更强 review gate
