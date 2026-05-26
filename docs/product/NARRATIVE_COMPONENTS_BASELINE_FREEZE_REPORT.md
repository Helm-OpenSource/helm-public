---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Narrative Components Baseline Freeze Report

## 当前状态

当前 Narrative Components 已经从第一轮 readiness 推进，进入可冻结阶段。共享 registry、共享组件和最小样式实现已经成立，后续页面不必再重新发明 judgement / action / boundary / evidence 的展示骨架。

## Freeze 结论

### 当前已完整成立

- `NarrativeHeader`
  - 目的：页面首句判断与高层 summary
  - 输入：`pageJudgement`、`pageJudgementReason`、`pagePrioritySignal`
  - 默认层级：L1
  - 必须出现：任何 decision-first 页面首屏
- `WhyItMattersBlock`
  - 目的：承载 2 到 3 条关键理由
  - 输入：`pageWhyItMatters`
  - 默认层级：L1
  - 必须出现：需要解释“为什么现在值得处理”的页面
- `HelmDidBlock`
  - 目的：承载 Helm 已经先做的有价值推进
  - 输入：`pageActionSummary`
  - 默认层级：L1
- `DecisionRequestCard`
  - 目的：明确当前需要主人拍板的事项
  - 输入：`pageDecisionRequest`
  - 默认层级：L1
- `CollaborationRequestCard`
  - 目的：明确当前为什么要拉 founder / sales / delivery 参与协作
  - 输入：`collaborationMode`、`collaborationSummary`、`collaborationRequest`、`collaborationDecisionRequest`、`collaborationNextStep`
  - 默认层级：L1
- `ActionRail`
  - 目的：固定动作出口
  - 输入：`pageNextAction`
  - 默认层级：L2
  - 约束：主动作 1 个，次动作最多 2 个
- `BoundaryNote`
  - 目的：让 prerequisite / dependency / risk / non-commitment 默认可见
  - 输入：`pageBoundarySummary`、`pageEscalationHint`
  - 默认层级：L3
- `WorkerSummary`
  - 目的：只呈现和当前页面有关的 worker / assignment
  - 输入：`pageWorkerSummary`、`collaborationWorkerAssignment`
  - 默认层级：L2
- `EvidenceChip`
  - 目的：小面积提示优先级、模式和 evidence cue
  - 输入：`pagePrioritySignal`、`leadingChip`
  - 默认层级：L4 辅助
- `EvidenceDrawer`
  - 目的：承接 replay / audit / memory / supporting facts
  - 输入：`pageEvidenceSummary`、`pageEvidenceLinks`
  - 默认层级：L4
  - 默认策略：折叠

### 已成形但仍需下一层

- 当前组件已经足够服务 homepage / opportunities / approvals
- proposal / package、contacts / companies / meetings / inbox 的专用变体仍需下一阶段补齐
- 更精细的 detail sheet / detail page narrative layout 仍需下一层

### 刻意未做

- 没有把 Narrative Components 做成完整 design system 平台
- 没有扩成全站页面组件重构
- 没有引入新的 canonical 主对象或新的页面平台抽象

### 诚实保留边界

- 当前这是共享 narrative component baseline，不是完整 design system
- 当前组件层继续挂在 workspace-first、membership-backed、controlled-trial 主干上
- internal-only cue 仍禁止直接进入 customer-facing 语义

## 代码 / 页面 / 文档 / 测试一致性

- 共享 registry 与共享组件入口：
  - [narrative-components.ts](../../lib/presentation/narrative-components.ts)
  - [narrative-components.tsx](../../components/shared/narrative-components.tsx)
- 代表页已经通过共享面板接入：
  - [dashboard/page.tsx](../../app/(workspace)/dashboard/page.tsx)
  - [opportunities-client.tsx](../../features/opportunities/opportunities-client.tsx)
  - [approvals-client.tsx](../../features/approvals/approvals-client.tsx)
- 守线与回归：
  - [narrative-components.test.ts](../../lib/presentation/narrative-components.test.ts)
  - [narrative-components-baseline-freeze.test.ts](../../lib/presentation/narrative-components-baseline-freeze.test.ts)

## 总结

- 当前 Narrative Components 基线已经清楚
- 组件职责、输入、层级、使用边界已经清楚
- 当前版本已经足够作为后续页面扩展的正式起点
- recommendation / commitment 两条 A-minus 主线本轮保持稳定
