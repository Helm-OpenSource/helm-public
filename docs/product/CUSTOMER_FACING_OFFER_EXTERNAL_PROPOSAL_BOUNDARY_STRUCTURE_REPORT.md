---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Offer / External Proposal Boundary Structure Report

## 当前结论

customer-facing offer / external proposal detail 现在已经形成一套统一的 `boundary + sendability + evidence` 结构，不再让用户自己从模板字段里拼 prerequisite、dependency、non-commitment 和 sendability judgement。

## 当前边界结构

当前这两类页面默认承接：

- boundary note
- prerequisite note
- dependency note
- risk note
- non-commitment note
- sendability note
- review-before-send note
- internal-only note

这些内容优先进入：

- `BoundaryNote`
- 次级摘要
- evidence drawer 中的 `boundary_trace` / `sendability_trace`

## 放置规则

首屏默认可见：

- 当前是否 safe-to-send
- 当前是否 safe-with-boundary
- 当前是否 safe-with-prerequisite
- 当前是否 safe-with-dependency
- 当前是否 discussion-only
- 当前是否 review-before-send
- 当前是否 not-safe-to-send
- 当前是否仍缺 prerequisite / dependency / approval

放入 `BoundaryNote`：

- 当前对外边界
- prerequisite / dependency 总结
- recommendation / discussion-only / boundary note 与 commitment 的区分
- review-before-send / not-safe-to-send 的止步说明

可进入 secondary summary：

- customer-facing cue
- internal-only cue
- non-commitment cue
- collaboration owner
- current stage / owner / due date

只能进入 `EvidenceDrawer`：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- historical changes

必须禁止进入 customer-facing 视图：

- internal-only review cue
- 审批敏感强化表达
- 尚未收口的 scope / dependency 实施细节
- 任何暗示已经形成承诺的内部判断句

## External expression evidence grouping

当前 evidence 层专属 grouping 已固定为：

1. `replay`
2. `audit`
3. `memory`
4. `worker_output`
5. `boundary_trace`
6. `sendability_trace`
7. `historical_changes`

这保证：

- 边界信息不会被埋掉
- sendability 判断不会被隐藏
- 证据不会打断主叙事
- 用户需要核验时，能按分组快速下钻

## 当前边界

- 当前 evidence grouping 仍是面向外部表达 detail 页的第一轮 grouping
- 当前还不是完整 sendability archive，也不是完整 legal / contract evidence surface
- 当前 recommendation / discussion-only / boundary note / sendability judgement 仍主要靠前台 narrative、boundary note 和 trace 一起守住
