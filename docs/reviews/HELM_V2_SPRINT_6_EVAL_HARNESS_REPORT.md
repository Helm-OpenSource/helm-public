---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Sprint 6 Eval Harness Report

## 总结

Sprint 6 已落地第五批 eval harness，并把 official write boundary 风险单独收紧。

当前脚本：

- `npm run eval:helm-v2-sprint6`

## 覆盖范围

- write intent consistency eval
- approval matrix enforcement eval
- shadow / official separation eval
- evidence sufficiency before official write eval
- acknowledgment / failure capture eval
- no-auto-write safety eval

## 当前门槛

- 没有 eval 不上线
- default auto-write 本轮不开放
- send authority 本轮不开放
- 错误 official write 事故必须为 0
- 审计可追溯率必须为 100%

## 当前结果

- `totalCases = 3`
- `passedCases = 3`
- 所有 rate = `100%`

## 当前结论

已经完整成立：

- Sprint 6 eval harness
- guarded official write safety gate

已成形但仍需下一层：

- larger golden set
- connector-backed acknowledgment cases

刻意未做：

- no-eval rollout

风险项：

- 目前 fixture 数量仍然偏小，后续需要更多真实 case 压测
