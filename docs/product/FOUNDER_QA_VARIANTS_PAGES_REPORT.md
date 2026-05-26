---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Founder Q&A Variants Pages Report

## 本轮落地

本轮新增：

- `/founder-qa/[id]`
- founder Q&A detail model
- founder Q&A reporting contract
- founder Q&A 与 `proposal / reinforcement / founder conversation / external narrative` 的 handoff

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

`Founder Q&A` 页面现在先回答：

- Helm 当前建议 founder 该怎么回答
- 为什么当前停在这个 Q&A scene
- 当前能不能 customer-visible
- 当前是否必须 review-before-send
- 当前是否必须退回 `boundary-only` 或 `non-commitment fallback`
- 当前缺什么 prerequisite / dependency / risk mitigation
- 当前要谁拍板、谁继续推进

## 已接入的链路

当前最小 handoff 已成立：

- `proposal -> founder-qa`
- `reinforcement -> founder-qa`
- `founder-conversation -> founder-qa`
- `founder-qa -> external-narrative | founder-conversation`

这意味着 founder Q&A 已经不再是散落 cue，而是现有 detail chain 里的一段可判断、可交接、可复用的节点。

## 页面边界

当前页面明确保留：

- `recommendation != commitment`
- founder 回答可以更强，但不能越过当前 fallback
- customer-visible wording 只在 `sendability` 允许时出现
- review-before-send 和 internal-only 仍然是首屏可见边界，而不是 evidence 里的附注

## 当前成立程度

已经完整成立：

- 1 个 founder Q&A detail 页
- 1 套 founder Q&A evidence / boundary 结构
- 1 组 founder Q&A handoff 进入 unified chain

已成形但仍需下一层：

- founder Q&A 更细 scene variants
- founder Q&A 与 oral pack 的更细对应

刻意未做：

- 不做完整 founder Q&A generator
- 不做完整 founder enablement 平台

风险项：

- 如果后续口径控制松掉，founder 高压回答最容易重新滑向 commitment 误读
