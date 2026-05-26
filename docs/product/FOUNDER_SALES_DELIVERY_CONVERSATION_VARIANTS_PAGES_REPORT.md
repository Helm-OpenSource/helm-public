---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Founder / Sales / Delivery Conversation Variants Pages

## 结论

本轮已把 founder / sales / delivery 三类对外沟通页从散落 cue / pack / scenario 收成 judgement-first detail 页，并接进现有商业推进 detail chain。

## 当前落地

- Founder 页面：
  - 路由：[app/(workspace)/founder-conversations/[id]/page.tsx](../../app/(workspace)/founder-conversations/[id]/page.tsx)
  - 重点承接 `proposal / reinforcement -> founder conversation`
- Sales 页面：
  - 路由：[app/(workspace)/sales-conversations/[id]/page.tsx](../../app/(workspace)/sales-conversations/[id]/page.tsx)
  - 重点承接 `package / offer -> sales conversation`
- Delivery 页面：
  - 路由：[app/(workspace)/delivery-conversations/[id]/page.tsx](../../app/(workspace)/delivery-conversations/[id]/page.tsx)
  - 重点承接 `package / package stage -> delivery conversation`

## 页面结构

三页都固定保留：

- `NarrativeHeader`
- `WhyItMattersBlock`
- `HelmDidBlock`
- `DecisionRequestCard`
- `ActionRail`
- `BoundaryNote`
- `WorkerSummary`
- `EvidenceDrawer`

三页都固定把以下内容留在首屏：

- 当前建议这个角色怎么说
- 为什么当前停在这一层
- 当前 scene / audience / sendability
- 当前 boundary / non-commitment
- 现在需要谁拍板
- 你可以直接执行什么动作

## Chain 接入

- generic `conversation` 已增加：
  - `conversation -> founder-conversation`
  - `conversation -> sales-conversation`
  - `conversation -> delivery-conversation`
- founder / sales / delivery 三页都带自己的 `current node / prev / next / handoff reason / handoff boundary / next action`
- 现阶段已经能支撑 founder demo、sales follow-up、delivery walkthrough 这三条角色化沟通链的第一轮落地

## 边界

- 这不是完整 messaging platform、sales enablement / delivery enablement 平台。
- 这不是自动外发系统。
- 这仍是第一轮 role-based conversation detail template。
