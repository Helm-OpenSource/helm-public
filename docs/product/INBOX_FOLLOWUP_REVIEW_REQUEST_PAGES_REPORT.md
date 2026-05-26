---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Inbox / Follow-up / Review Request Pages Report

本轮落地了三类 judgement-first detail 页：

- `/inbox/[id]`
- `/follow-ups/[id]`
- `/review-requests/[id]`

它们现在都具备：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`
- `UnifiedDetailNavigationPanel`

当前链路接入包括：

- `conversation -> inbox-detail`
- `conversation -> follow-up-detail`
- `follow-up-detail -> review-request-detail`
- `review-request-detail -> founder-conversation / sales-conversation / delivery-conversation`
- `review-request-detail -> customer-success` 作为 dedicated success handoff
- `review-request-detail -> company-detail` 作为 account context refresh，而不是 success proxy
- `inbox / follow-up / review request -> package / proposal / offer / external narrative`

当前版本已经完成的语义中心切换是：

- inbox 不再只是线程容器，而是先判断这条线程当前属于 reply triage、follow-up routing 还是 boundary clarification
- follow-up 不再只是草稿壳层，而是先判断当前该停在 draft、ready-to-review 还是 review-before-send
- review request 不再只是审批壳层，而是先判断当前到底是谁接手、边界还在什么位置、是否还能继续往外走

当前边界也保持诚实：

- 这不是完整 inbox / email client
- 这不是完整 notifications center / workflow / review platform
- customer success handoff 当前已经有 dedicated detail node，但仍只是第一轮局部落地
