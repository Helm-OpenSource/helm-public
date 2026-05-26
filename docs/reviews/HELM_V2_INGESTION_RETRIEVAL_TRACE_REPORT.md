---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Ingestion Retrieval Trace Report

## 总结

ingestion / retrieval trace surface 已成立。

Sprint 7 在 meeting detail 里补出了一版真实可用的 trace surface，让 richer ingestion / retrieval 不再是黑箱。

## 当前可见内容

当前 trace 至少能展示：

- 当前 runtime 拉了哪些 memory
- 来自哪些 source
- 哪些是 trusted / untrusted
- 哪些只是 draft
- 哪些已 promotion
- 为什么加载这些、没加载哪些
- 当前 evidence / provenance

## 当前 surface truth

- trace 是 review/debug 入口，不是 observability platform claim。
- trace 会显示当前 runtime label、mode、bucket、loaded refs、skipped refs。
- trace 会保留 boundary note，说明为什么某些 source 只能 draft-only。

## 已经完整成立

- meeting detail trace card
- ingestion source posture summary
- retrieval loaded / skipped refs explanation

## 已成形但仍需下一层

- broader runtime coverage
- richer drill-down
- more explicit stale-memory reason visualization

## 刻意未做

- full observability platform
- connector replay studio
- global retrieval analytics console

## 风险项

- richer runtime 增长后，trace surface 可能变得更密
- 如果后续不持续约束 wording，trace 也可能被误读成“系统知道全部历史”
