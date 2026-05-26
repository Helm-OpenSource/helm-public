---
status: archived
owner: helm-core
created: 2026-04-02
review_after: 2026-09-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2 Sprint 7 Eval Harness Report

## 总结

第六批 eval harness 已成立。

Sprint 7 的 eval 重点不是“检索看起来更聪明”，而是验证 richer ingestion / retrieval 是否仍然 boundary-first、promotion-safe、relevance-first。

## 当前覆盖

- ingestion trust classification eval
- promotion eligibility eval
- retrieval relevance eval
- stale memory suppression eval
- policy loading correctness eval
- object summary loading correctness eval
- evidence provenance completeness eval

## 当前上线门槛

- 没有 eval 不上线
- `untrusted -> promoted` 误升级事故必须为 `0`
- stale memory 错拉率必须可解释并受控
- 审计可追溯率必须为 `100%`

## 当前结果口径

当前 Sprint 7 harness 已可执行，并作为 richer ingestion / retrieval 的 current-main gate。

## 已经完整成立

- Sprint 7 eval fixture
- Sprint 7 eval script
- Sprint 7 eval summary contract

## 已成形但仍需下一层

- 更大的 golden case pool
- 更多 connector-specific edge cases
- 更细 freshness / invalidation eval

## 刻意未做

- benchmark platform
- broad connector leaderboard
- no-eval rollout

## 风险项

- connector breadth 增长后，fixture 漂移速度会更快
- 如果只看 pass/fail 不看 boundary wording，也会产生过度自信
