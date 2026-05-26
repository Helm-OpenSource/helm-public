---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Commitment Reinforcement / Sendability Structure Report

## 当前结论

commitment reinforcement / sendability detail 现在已经形成一套统一的 `reinforcement + non-commitment + sendability + evidence` 结构，不再让用户自己从 boundary note、review hint 和模板说明里拼装判断。

## 当前边界结构

当前这两类页面默认承接：

- reinforcement note
- non-commitment note
- boundary note
- prerequisite note
- dependency note
- risk note
- review-before-send note
- not-safe-to-send note
- internal-only note

这些内容优先进入：

- `BoundaryNote`
- 次级摘要
- evidence drawer 中的 `boundary_trace` / `sendability_trace` / `reinforcement_trace`

## 放置规则

首屏默认可见：

- 当前 reinforcement level
- 当前 sendability judgement
- 当前是否 discussion-only
- 当前是否 review-before-send
- 当前是否 not-safe-to-send
- 当前是否仍缺 prerequisite / dependency / risk mitigation
- recommendation / reinforcement / commitment 的区分

放入 `BoundaryNote`：

- 当前强化边界
- prerequisite / dependency 总结
- non-commitment 说明
- review-before-send / not-safe-to-send 的止步说明
- send-safe 不等于 commitment-safe 的提醒

可进入 secondary summary：

- customer-visible strengthening cue
- internal-only cue
- non-commitment cue
- reinforcement level
- sendability mode
- current stage / owner / due date

只能进入 `EvidenceDrawer`：

- replay
- audit
- memory
- worker output
- boundary trace
- sendability trace
- reinforcement trace
- historical changes

必须禁止进入 customer-visible 视图：

- internal-only review cue
- 尚未收口的 scope / dependency 修正细节
- 任何仍处于 discussion-only / review-before-send / not-safe-to-send 的强化句
- 任何会把 recommendation 或 reinforcement 误讲成 commitment 的内部判断句

## Reinforcement / sendability evidence grouping

当前 evidence 层专属 grouping 已固定为：

1. `replay`
2. `audit`
3. `memory`
4. `worker_output`
5. `boundary_trace`
6. `sendability_trace`
7. `reinforcement_trace`
8. `historical_changes`

这保证：

- sendability 判断不会被隐藏
- reinforcement 级别不会被写成正式承诺
- discussion-only / non-commitment 不会被误讲成可发送承诺
- 证据不会打断主叙事

## 当前边界

- 当前结构仍是面向 strengthening / send gate detail 页的第一轮结构
- 当前还不是完整 legal evidence surface，也不是完整 sendability archive
- 当前 reinforcement / non-commitment / review-before-send / not-safe-to-send 仍主要靠前台 narrative、boundary note 和 trace 一起守住
