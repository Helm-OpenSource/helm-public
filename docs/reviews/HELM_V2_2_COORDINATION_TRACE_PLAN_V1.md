---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Coordination Trace Plan v1

更新时间：2026-04-03
状态：Proposed Kickoff
适用范围：Helm v2.2 narrow next-layer slice

## 1. 当前 truth source

v2.2 的起点不重新定义 v2.1，而是继承以下 freeze truth：

- `docs/product/HELM_V2_1_RUNTIME_HARDENING_BASELINE_V1.md`
- `docs/reviews/HELM_V2_1_RUNTIME_HARDENING_FINAL_FREEZE_REPORT.md`
- `docs/product/HELM_V2_1_VERIFIED_COORDINATION_BASELINE_V1.md`

spec 继续只作为 proposed design reference，不自动等于已实现。

## 2. 为什么现在开 v2.2

v2.1 已经把 runtime hardening 和一条 acceptance-grade verified coordination loop 收口。

当前最明确的 next-layer，不是继续扩 substrate，而是补清楚：

`verified coordination runtime object -> human execution / official follow-through surface`

也就是：

- 问题、DRI、brief 已经形成之后
- operator 怎样看到它和已有执行面、official follow-through 面的关系
- 但不扩大权限，不把 trace 说成 execution authority

## 3. 这条 v2.2 slice 要证明什么

这次 v2.2 只证明一件事：

Helm 可以把一条 meeting-driven verified coordination loop，继续接成一条 honest、operator-readable、跨层 trace bridge。

目标不是新增执行权，而是让 operator 能回答：

1. 这个 problem space 后面有没有进入 human execution
2. 有没有进入 official follow-through
3. 当前停在什么 posture
4. 这条 trace 只是同 meeting / opportunity 的下游对齐，还是已经出现明确执行 / follow-through 证据
5. 哪些地方仍然只是 review / recommendation / manual path

## 4. 本次 slice 的成立范围

本次只做：

- meeting-level cross-layer trace summary
- workspace-level coordination-to-follow-through queue
- verified coordination object 到 human execution / official follow-through 的可读关联
- 相关 eval、文档、报告、索引同步

本次不做：

- new app tree
- route/query rewrite
- workflow engine
- team mode / multi-agent runtime
- broader world-model productization
- auto-send
- broad auto-write
- broader execution plane

## 5. preserved boundaries

以下边界继续保持：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

补 trace 不等于补 authority。

## 6. 核心 loop

这次 v2.2 只冻结一条 cross-layer trace：

`meeting signals -> verification / truth conflict -> memory promote|reject|defer -> confirmed problem space -> explicit DRI -> IC / DRI / player-coach brief -> human execution / official follow-through trace posture`

最后一段只回答：

- traced
- waiting
- blocked
- in human execution
- in official follow-through
- resolved

它不回答：

- 自动执行
- 自动发送
- 自动 official write

## 7. phase plan

### Phase 1

- 给 runtime summary 增加 cross-layer trace bridge
- 让 meeting runtime 能显示 verified coordination 和 human execution / official follow-through 的对齐状态
- posture 必须短、清楚、非夸大

### Phase 2

- 给 workspace operator surface 增加 coordination trace queue
- 至少能解释：
  - 哪个 problem space 已经进入 human execution
  - 哪个 problem space 已经进入 official follow-through
  - 哪个仍停在 waiting / blocked posture

### Phase 3

- 增加 narrow eval / tests
- 验证 trace 不会把“同 meeting/opportunity 下游对象”误写成“已执行成功”
- 验证 boundary wording 仍然清楚

### Phase 4

- baseline / report / README / docs index 同步
- 把这条 v2.2 slice 的成立范围、未做项、风险项冻结下来

## 8. eval contract

至少验证：

1. problem space 有 confirmed grounding 时，才会显示 action-ready trace
2. 没有 human execution / official follow-through 证据时，不会伪造 downstream success
3. human execution 已存在时，trace 会显示 manual / human posture，而不是 official success
4. official follow-through 已存在时，trace 会显示 follow-through posture，而不是自动 claim execution completion
5. blocked / waiting_on_signal / waiting_on_authority / capability_gap 仍保持可见

## 9. explicitly deferred

继续明确 defer：

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public-facing execution surfaces
- auto-send
- broad auto-write
- richer scorecards beyond this slice

## 10. done definition

这条 v2.2 slice 只有在以下条件同时成立时才算完成：

1. meeting runtime 能显示 verified coordination -> execution/follow-through trace bridge
2. workspace operator surface 能看见这条 bridge queue
3. posture 是 source-grounded、operator-readable、non-commitment 的
4. docs / tests / eval / index / report 已同步
5. 统一验证为绿色
