---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Offer / External Proposal Pages Report

## 当前结论

本轮已经完成：

1. 1 个 customer-facing offer 详情页
2. 1 个 external proposal 详情页
3. 1 套共享的 external expression detail 骨架

当前页面入口：

- `app/(workspace)/offers/[id]/page.tsx`
- `app/(workspace)/external-proposals/[id]/page.tsx`
- `features/customer-facing-offer-external-proposal/detail-view.tsx`

## Customer-facing Offer 详情页

Customer-facing offer 页首屏默认回答：

1. Helm 当前建议这版 offer 应该怎么对外表达
2. 为什么它现在适合 safe-to-send、safe-with-boundary、safe-with-prerequisite、safe-with-dependency、discussion-only、review-before-send 或 not-safe-to-send
3. Helm 已先整理了哪些 outward-facing wording 和 boundary
4. 当前需要谁决定是否可以继续推进
5. 当前 evidence 和 sendability trace 在哪里

当前具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## External Proposal 详情页

External proposal 页首屏默认回答：

1. Helm 当前怎么看这版 external proposal
2. 为什么当前适合继续 external-safe review、暂缓外发、保持 discussion-only 或明确 not-safe-to-send
3. Helm 已经整理了哪些 proposal-safe 版本、dependency 和 review note
4. 当前协作应该由谁接
5. 现在需要谁拍板、跟进或继续 review

当前具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `CollaborationRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## 当前模板意义

这两页现在都不再以模板字段平铺为中心，而是按：

1. judgement
2. action
3. boundary
4. evidence

来组织 detail narrative。

因此它们已经足够作为后续：

- customer-facing package variants
- external proposal variants
- commitment reinforcement detail
- offer / proposal review

等 detail 页的第一轮模板样板。

## 当前边界

- 当前 customer-facing offer / external proposal detail 仍来自现有 opportunity commercial context
- 当前不是完整 offer platform，也不是完整 external proposal generator
- 当前只完成了 2 个外部表达 detail 模板页，不代表所有 detail 页都已接入
- 当前页面仍默认以 judgement、review、boundary 和 sendability decision 为主，不默认拥有自动外发能力
