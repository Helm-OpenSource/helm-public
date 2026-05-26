---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Narrative Components Report

## 当前结论

本轮已经把 Helm 的人类界面写作协议和结构协议，落成一套最小可运营的共享 narrative component system。

当前共享实现入口：

- [../../lib/presentation/narrative-components.ts](../../lib/presentation/narrative-components.ts)
- [../../components/shared/narrative-components.tsx](../../components/shared/narrative-components.tsx)

## 组件清单

### NarrativeHeader

- 目的：承载页面首句判断与高层 summary
- 输入字段：`pageJudgement`、`pageJudgementReason`、`pagePrioritySignal`
- 默认层级：L1 判断层
- 必须出现：任何 decision-first 页面首屏
- 禁止出现：对象原始字段列表、长证据明细

### WhyItMattersBlock

- 目的：只承载 2 到 3 条关键理由
- 输入字段：`pageWhyItMatters`
- 默认层级：L1 判断层
- 必须出现：需要解释“为什么现在值得处理”的页面
- 必须折叠：低风险且标题一句话已足够时
- 禁止出现：历史流水、边界说明、审计明细

### HelmDidBlock

- 目的：说明 Helm 已经先做了哪些准备
- 输入字段：`pageActionSummary`
- 默认层级：L1 判断层
- 必须出现：Helm 已产生排序、准备、拦截、整理动作时
- 禁止出现：低价值动作流水

### DecisionRequestCard

- 目的：把需要人拍板的事项显式放到主叙事
- 输入字段：`pageDecisionRequest`
- 默认层级：L1 判断层
- 必须出现：当前页面需要用户拍板时
- 禁止出现：纯说明文、internal-only 实施细节

### CollaborationRequestCard

- 目的：承载主动协作请求
- 输入字段：
  - `collaborationMode`
  - `collaborationSummary`
  - `collaborationRequest`
  - `collaborationDecisionRequest`
  - `collaborationNextStep`
- 默认层级：L1 判断层
- 必须出现：页面存在主动协作或 handoff 请求时
- 禁止出现：全量 worker 列表、替代边界说明

### ActionRail

- 目的：把动作出口压成一条清晰 action rail
- 输入字段：`pageNextAction`
- 默认层级：L2 行动层
- 约束：
  - 主动作 1 个
  - 次动作最多 2 个
- 禁止出现：超过 3 个按钮、导航目录

### BoundaryNote

- 目的：把 prerequisite / dependency / risk / non-commitment 保持默认可见
- 输入字段：`pageBoundarySummary`、`pageEscalationHint`
- 默认层级：L3 边界层
- 必须出现：存在风险、依赖、前提、review-needed 时
- 禁止出现：埋入 EvidenceDrawer

### WorkerSummary

- 目的：只显示和当前判断有关的 worker / assignment
- 输入字段：`pageWorkerSummary`、`collaborationWorkerAssignment`
- 默认层级：L2 行动层
- 必须出现：当前判断直接依赖 worker / role 时
- 禁止出现：全量 worker roster

### EvidenceChip

- 目的：承担少量优先级 / 模式 / 标签点缀
- 默认层级：L4 证据层辅助提示

### EvidenceDrawer

- 目的：承接 replay / audit / memory / supporting facts
- 输入字段：`pageEvidenceSummary`、`pageEvidenceLinks`
- 默认层级：L4 证据层
- 默认策略：折叠
- 例外：高风险场景可以露出摘要，但不能抢走主叙事

## 当前边界

- 当前只落了共享类型、共享组件和最小样式实现
- 当前不是完整 design system 平台
- 当前不是全站所有页面都完成 narrative component 化
- 当前仍然挂在 workspace-first、membership-backed、controlled-trial 主干上
