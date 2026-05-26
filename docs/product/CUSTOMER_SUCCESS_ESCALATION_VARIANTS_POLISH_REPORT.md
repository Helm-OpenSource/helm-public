---
status: archived
owner: helm-core
created: 2026-03-31
review_after: 2026-09-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer Success Escalation Variants Polish Report

## 当前冻结的 escalation variants

这一轮把 customer success 下的 escalation layer 收细为 7 个固定执行变体：

- `escalation-triggered follow-through`
- `founder-escalated issue`
- `delivery-escalated issue`
- `sales-escalated issue`
- `blocked-by-dependency escalation`
- `blocked-by-boundary escalation`
- `internal-only escalation prep`

## 当前产品 truth

- escalation 仍然是 thin handoff / decision layer，不是新的审批平台或升级平台。
- `founder-escalated issue` 用于战略边界、关键阻塞、需要 founder 明确拍板的情况。
- `delivery-escalated issue` 用于 repair、walkthrough clarification、dependency cleanup 已经进入 delivery 接手线的情况。
- `sales-escalated issue` 用于 blocked expansion、renewal risk、commercial clarification 已经进入 sales-owned follow-through 的情况。
- `blocked-by-dependency escalation` 和 `blocked-by-boundary escalation` 明确区分“卡在依赖”与“卡在边界”。

## 当前如何落到产品

- `customer-success/[id]` 会在 secondary summary 中直接显示当前 `Escalation sub-variant`
- `success queue / success inbox` 会把 escalation 类卡片的 `Sub-variant cue` 前置
- `customer success -> founder / sales / delivery` handoff wording 现在会显式写出升级来源，而不是泛化成同一句理由

## 当前边界

- 这不是完整 escalation management platform
- 这不是完整 workflow / orchestration engine
- 这不代表 Helm 已经能替团队自动升级或自动承诺
- recommendation / commitment 边界继续只做守，不做弱化
