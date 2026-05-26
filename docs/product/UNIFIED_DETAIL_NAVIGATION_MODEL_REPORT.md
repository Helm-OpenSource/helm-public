---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Unified Detail Navigation Model Report

## 当前状态

Helm 已经有多类 judgement-first detail 页：

- proposal
- package
- customer-facing offer
- external proposal
- reinforcement
- sendability
- variants

问题不再是单页不够强，而是这些 detail 页之间还缺少统一的商业推进链视角。

## 本轮冻结的最小模型

当前统一 navigation model 只定义一件事：

- 让用户知道自己当前处在商业推进链的哪一段
- 让用户知道上一段是什么、下一段是什么
- 让用户知道为什么现在应该停在当前 detail
- 让用户知道当前切换会不会改变 boundary、sendability、strengthening level

当前统一语义冻结为：

- `detailNodeType`
- `detailNodeSummary`
- `detailNodeStage`
- `detailNodeBoundary`
- `detailNodeAudienceMode`
- `detailNodeSendabilityMode`
- `detailNodeStrengthMode`
- `detailNodePrev`
- `detailNodeNext`
- `detailNodeCurrentReason`
- `detailNodePriority`
- `detailNodeNavigationHint`

## 当前覆盖的 node

当前模型至少覆盖：

- `proposal`
- `package`
- `customer-facing-offer`
- `external-proposal`
- `reinforcement`
- `sendability`
- `variants`

为第一轮落地可读性，代码里也允许更细的：

- `package-variants`
- `reinforcement-variants`

## 首屏与附注

当前规则是：

- 首屏必须可见：
  - 当前节点 summary
  - 当前节点 stage
  - 当前节点 boundary
  - 当前节点 current reason
  - 当前节点 prev / next hint
- secondary summary 可承载：
  - audience mode
  - sendability mode
  - strengthening mode
  - priority
- EvidenceDrawer 才承载：
  - replay
  - audit
  - memory
  - worker output
  - boundary trace
  - historical changes

统一 navigation 不是对象目录，不承担原始字段浏览职责。

## 当前边界

当前模型已经成立，但仍明确保留以下边界：

- 这不是完整 graph navigation platform
- 这不是完整 workflow / orchestration engine
- 这不是完整 enterprise IAM / org admin / tenant admin 平台
- 当前只覆盖商业推进 detail 链的第一轮局部落地
- recommendation 仍不等于 commitment

## 本轮结论

当前 unified detail navigation 已经足够作为下一阶段继续扩 proposal / package / offer / reinforcement / variants detail 链的共享导航骨架。它解决的是“连续经营阅读”和“连续经营判断”，不是对象目录或流程引擎。
