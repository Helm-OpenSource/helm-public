---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Cross-detail Handoff Model Report

## 当前状态

过去 detail 页之间的切换更多像：

- 一个链接
- 一个 tab
- 一个“去下一页”的按钮

但用户真正需要的是：

- 为什么现在要切过去
- 当前边界有没有变化
- 谁应该接手
- 接手后先做什么

## 本轮冻结的最小 handoff 语义

当前 handoff model 冻结为：

- `handoffSource`
- `handoffTarget`
- `handoffReason`
- `handoffBoundary`
- `handoffPrerequisite`
- `handoffDependency`
- `handoffRisk`
- `handoffDecisionRequest`
- `handoffNextAction`
- `handoffWorkerSummary`
- `handoffEvidenceSummary`
- `handoffVisibilityMode`

## 当前明确覆盖的 handoff

模型当前至少覆盖：

- `proposal -> package`
- `package -> customer-facing offer`
- `customer-facing offer -> external proposal`
- `external proposal -> reinforcement`
- `reinforcement -> sendability`
- `package variants -> reinforcement variants`
- `reinforcement variants -> package variants`

## 当前规则

handoff 不是普通跳转，当前必须同时包含：

- 交接原因
- 当前边界
- 当前前置条件
- 当前依赖条件
- 当前风险
- 当前需要谁拍板
- 当前下一步动作
- 当前 worker cue
- 当前 evidence cue

## visibility 规则

当前 handoff visibility 最小模式包括：

- `customer-facing`
- `customer-facing-with-boundary`
- `internal-only`
- `review-before-send`
- `boundary-only`

使用规则：

- 只要 handoff 可能放大客户预期，就不能裸露成 `customer-facing`
- 只要 wording 可能被误读成 commitment，就必须保留 boundary 或降级成 internal-only
- review-before-send 不能被写成 safe-to-send

## 当前边界

当前 handoff model 已经清楚，但仍不是：

- 完整 process engine
- 完整 approval routing system
- 完整 task orchestration layer

它只是第一轮商业推进 detail 页之间的“交接协议层”。

## 本轮结论

当前 cross-detail handoff 已经足够支持 Helm 把多页 detail 读成一条连续推进链，而不是一组孤立详情页。后续更细 stage variants、narrative strengthening variants 和统一 detail navigation 都可以继续沿这套 handoff contract 扩展。
