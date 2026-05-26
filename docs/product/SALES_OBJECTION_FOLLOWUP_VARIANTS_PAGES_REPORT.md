---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Sales Objection / Follow-up Variants Pages Report

## 本轮落地

本轮新增：

- `/sales-objections/[id]`
- `/sales-followups/[id]`
- sales objection / follow-up shared detail model
- sales objection / follow-up reporting contract
- sales objection / follow-up 与 `package / offer / proposal / conversation / external narrative` 的 handoff

页面继续沿用统一 judgement-first skeleton：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## 页面现在先回答什么

这两页现在先回答：

- Helm 当前建议 sales 该怎么回、怎么跟
- 为什么当前停在这个 scene
- 当前能不能 customer-visible
- 当前是否必须 review-before-send
- 当前是否必须退回 `boundary-only` 或 `non-commitment fallback`
- 当前缺什么 prerequisite / dependency / risk mitigation
- 当前要谁拍板、谁继续推进

## 已接入的链路

当前最小 handoff 已成立：

- `package -> sales-follow-up`
- `customer-facing-offer -> sales-follow-up`
- `proposal -> sales-objection`
- `conversation -> sales-objection | sales-follow-up`
- `sales-objection | sales-follow-up -> external-narrative | sales-conversation`

此外，`sales conversation` 也已经把这两页作为更细下一层挂进现有 chain。

## 页面边界

当前页面明确保留：

- `recommendation != commitment`
- objection 和 follow-up 可以更锋利，但不能越过当前 fallback
- customer-visible wording 只在 sendability 允许时出现
- review-before-send 和 internal-only 仍然是首屏可见边界

## 当前成立程度

已经完整成立：

- 1 个 sales objection detail 页
- 1 个 sales follow-up detail 页
- 相关 handoff 进入 package / offer / proposal / conversation 链

已成形但仍需下一层：

- 更细 objection variants
- 更细 email / verbal follow-up variants

刻意未做：

- 不做完整 sales objection generator
- 不做完整 sales enablement / CRM 平台

风险项：

- 如果后续口径控制松掉，sales objection / follow-up 最容易重新滑向 promise wording
