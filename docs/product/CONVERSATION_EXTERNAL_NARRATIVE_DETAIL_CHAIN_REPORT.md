---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Conversation / External Narrative Detail Chain Report

## 本轮交付

本轮把两类散落资产页收成了 judgement-first detail chain：

- `conversation detail`
- `external narrative detail`

当前落地入口：

- `/app/(workspace)/conversations/[id]/page.tsx`
- `/app/(workspace)/external-narratives/[id]/page.tsx`

两页都已经使用共享的：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

## 当前链路

当前至少已经接上这些 handoff：

- `package -> conversation`
- `customer-facing offer -> conversation`
- `conversation -> external narrative`
- `external proposal -> external narrative`
- `reinforcement -> external narrative`
- `external narrative -> conversation`

这意味着 conversation / narrative 已不再是孤立资产，而是现有 commercial detail chain 的一段。

## 当前页面表达

conversation 页现在会先说：

- 当前建议怎么说
- 当前属于哪个 scene
- 当前适合谁来接话
- 当前 sendability 停在哪一层
- 当前需要谁拍板

external narrative 页现在会先说：

- 当前 narrative 应停在哪一层
- 当前为什么还不能说更强
- 当前 fallback 停在哪一层
- 当前是否 customer-visible / review-before-send / boundary-only
- 当前需要谁拍板

## 当前边界

- 这仍是第一轮 `conversation / external narrative detail chain`
- 它不是完整 messaging platform
- 它不是完整 sales enablement / battlecard / CRM 平台
- 它不是完整 commercial conversation engine
- 当前仍默认以 recommendation、review、boundary、decision request 为主，不默认拥有高风险自动承诺和高风险自动发送权限

## 结论

当前 `conversation / external narrative` 已经更像 Helm judgement-first 汇报页，而不是散落资产页；并且已经接入现有 commercial detail chain，足以成为下一阶段 founder / sales / delivery 沟通 detail 扩展的模板起点。
