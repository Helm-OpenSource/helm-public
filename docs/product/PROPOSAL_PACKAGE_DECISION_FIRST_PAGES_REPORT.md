---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Proposal / Package Decision-first Pages Report

## 当前结论

本轮已经完成：

1. 1 个 proposal 详情页
2. 1 个 package 详情页
3. 1 套共享 detail 骨架

当前页面入口：

- `app/(workspace)/proposals/[id]/page.tsx`
- `app/(workspace)/packages/[id]/page.tsx`
- `features/proposal-package/proposal-package-detail-view.tsx`

## Proposal 详情页

Proposal 页首屏默认回答：

1. Helm 当前怎么看这版 proposal
2. 为什么它现在值得继续 shaping 或继续 internal review
3. Helm 已先整理了哪些商业上下文
4. 当前需要谁决定是否进入 customer-safe review
5. 当前边界和证据在哪里

Proposal 页当前具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## Package 详情页

Package 页首屏默认回答：

1. Helm 当前怎么看这版 package
2. 为什么当前适合 sales / delivery review、继续 internal review，或保持 non-commitment
3. Helm 已先整理了哪些 scope / dependency / blocker / commitment 上下文
4. 当前协作应该由谁接
5. 当前证据和边界在哪里

Package 页当前具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `CollaborationRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## 当前模板意义

这两页现在都不再以对象字段平铺为中心，而是按：

1. judgement
2. action
3. boundary
4. evidence

来组织 detail narrative。

因此它们已经足够作为后续：

- customer-facing offer
- external proposal
- package review
- proposal review

等 detail 页的第一轮模板样板。

## 当前边界

- 当前 proposal / package detail 仍来自 existing opportunity commercial context
- 当前不是完整 proposal generator，也不是完整 package engine
- 当前只完成了 2 个 detail 模板页，不代表全站详情页已重构
