---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Variants Detail Pages Baseline Freeze Report

## 当前状态

当前已经形成：

- 1 个 customer-facing package variants detail 页
- 1 个 commitment reinforcement variants detail 页
- 1 套共享 judgement-first detail 骨架

本轮 freeze 的目标是把这三者收成可复用、可交付、可培训的标准基线。

## 页面与骨架冻结

### 当前已冻结的页面与骨架

- [package-variants/[id]/page.tsx](../../app/(workspace)/package-variants/[id]/page.tsx)
- [reinforcement-variants/[id]/page.tsx](../../app/(workspace)/reinforcement-variants/[id]/page.tsx)
- 共享 detail 骨架：
  - [detail-view.tsx](../../features/customer-facing-package-variants/detail-view.tsx)
  - [detail-view.tsx](../../features/commitment-reinforcement-variants/detail-view.tsx)

### 当前判断如何呈现

- `NarrativeHeader` 先给出当前 variant / strengthening judgement
- `WhyItMattersBlock` 只保留 2 到 3 条关键理由
- judgement 层不会先平铺对象字段和状态卡

### Helm 已推进动作如何呈现

- `HelmDidBlock` 说明 Helm 已经整理了哪些版本、哪些 cue、哪些 boundary trace
- `WorkerSummary` 只显示和当前 variants judgement 有关的 worker 参与

### 当前边界如何呈现

- `BoundaryNote` 默认可见
- package variants 会把 `sendability / prerequisite / dependency / non-commitment` 收在同一块
- reinforcement variants 会把 `strengthening / review-before-send / fallback / boundary` 收在同一块

### 当前变体模式如何呈现

- package variants 通过 `intent / stage / audience / sendability` 的 secondary summary 呈现
- reinforcement variants 通过 `strength mode / intent / audience / sendability / fallback cue` 的 secondary summary 呈现

### 当前决策请求或协作请求如何呈现

- `DecisionRequestCard` 直接说明下一步要谁确认、拍板或继续推进
- `ActionRail` 保持主动作 1 个、次动作最多 2 个，不让动作出口散落

### 证据层如何呈现

- `EvidenceDrawer` 默认折叠
- package variants evidence grouping：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - variant trace
  - historical changes
- reinforcement variants evidence grouping：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - sendability trace
  - reinforcement trace
  - historical changes

## 当前可接受遗留

- 当前仍建立在 existing opportunity commercial context 上
- 当前 detail 页仍会复用已有 commercial detail model，而不是新增 canonical variants object

## 下一阶段必须优先继续改造的遗留

- 更细的 package stage variants
- 更细的 reinforcement narrative variants
- package / offer / external proposal / reinforcement / sendability / variants 的统一 detail navigation

## 结论

- 当前 variants detail pages 基线已经清楚
- 2 个 detail 页和共享骨架已经足够作为后续更细 variants 页的模板
- 当前仍必须诚实保持“第一轮局部落地”的口径，不能夸大成完整 variants system
