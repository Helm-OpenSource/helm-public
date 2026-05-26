---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Proposal / Package Boundary / Evidence Structure Report

## 当前结论

proposal / package detail 现在已经形成一套统一的 `boundary + evidence` 结构，不再让用户自己从对象字段里拼 prerequisite、dependency、risk 和 non-commitment。

## 当前边界结构

当前 proposal / package 页默认承接：

- prerequisite note
- dependency note
- risk note
- non-commitment note
- internal-only note
- review-needed note

这些内容优先进入：

- `BoundaryNote`
- 次级摘要
- evidence drawer 中的 `boundary_trace`

## 放置规则

首屏默认可见：

- 当前是否仍是 internal review
- 当前是否仍是 non-commitment
- 当前是否缺 prerequisite / dependency
- 当前是否仍需 review / approval

放入 `BoundaryNote`：

- 当前对外边界
- prerequisite / dependency 总结
- recommendation 与 commitment 的区分
- escalation hint

可进入 secondary summary：

- audience mode
- collaboration owner
- current stage / owner / due date

只能进入 `EvidenceDrawer`：

- replay
- audit
- memory
- worker output
- boundary trace
- historical changes

必须禁止进入 customer-facing 视图：

- internal-only review cue
- 审批敏感 wording
- 尚未收口的 scope / dependency 实施细节

## Proposal / Package evidence grouping

当前 evidence 层专属 grouping 已固定为：

1. `replay`
2. `audit`
3. `memory`
4. `worker_output`
5. `boundary_trace`
6. `historical_changes`

这保证：

- 边界信息不会被埋掉
- 证据不会打断主叙事
- 用户需要核验时，能按分组快速下钻

## 当前边界

- 当前 evidence grouping 仍是面向 proposal / package detail 页的第一轮 grouping
- 当前还不是完整 commercial review archive
- 当前 recommendation / commitment 边界仍主要靠页面前台、boundary note 和 evidence trace 一起守住
