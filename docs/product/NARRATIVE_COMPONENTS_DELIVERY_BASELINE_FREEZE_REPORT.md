---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Narrative Components Delivery Baseline Freeze Report

## 当前状态

Narrative Components 与信息层级规则已经进入 founder demo / training / acceptance / delivery 资产。本轮 freeze 的目标，是确认这些资产已经可以复用，而不是继续停在页面实现层。

## 当前已固定的链路和资产

- 首页
- opportunities
- approvals
- founder demo 口播
- acceptance cue
- training cue
- delivery script
- decision-first 页面说明
- evidence drawer 说明
- worker / packs / scenarios integration cue

## 每页最该看什么 / 最该判什么

### 首页

- 最该看：Helm 今天的当前判断与 founder 决策请求
- 最该判：今天先拍哪一个板、哪些风险需要现在升级
- 最关键 cue：`judgement / why it matters / decision request / evidence drawer`

### opportunities

- 最该看：当前 scope 下哪个机会窗口最值得推进
- 最该判：哪个 proposal / package 事项要先进入 sales / delivery 协作
- 最关键 cue：`collaboration request / boundary / next action / evidence drawer`

### approvals

- 最该看：当前审批队列里最值得 review 的事项
- 最该判：哪些 draft 可以拍板、哪些必须继续收紧边界
- 最关键 cue：`review request / boundary note / worker summary / evidence drawer`

## training / acceptance / delivery 最该复用的话术

- 页面不是在堆对象，而是 Helm 先向人汇报
- 先看 Helm 当前判断，再看为什么值得处理，再决定要不要行动
- Helm 已经先做了准备，但高风险事项仍要人拍板
- 边界信息默认可见，证据细节折叠进 EvidenceDrawer

## 页面原文 vs 交付资产

### 属于页面原文

- NarrativeHeader
- WhyItMattersBlock
- HelmDidBlock
- DecisionRequestCard / CollaborationRequestCard
- ActionRail
- BoundaryNote
- WorkerSummary
- EvidenceDrawer

### 属于 training / oral / acceptance / delivery

- “Decision-first 页面模板基线”讲法
- “Narrative Components Baseline Freeze”命名
- 对 founder / sales / delivery 的口播转述
- 对 evidence drawer、boundary note 的讲解顺序

## 统一判断语义框架

当前页面原文、training cue、acceptance template、oral script、delivery script，仍然共享同一套判断顺序：

1. judgement
2. why it matters
3. Helm did
4. decision / collaboration request
5. action
6. boundary
7. evidence

## 总结

- founder demo / training / acceptance / delivery 当前基线已经清楚
- 后续演示、培训、验收和页面扩展可以继续复用这套讲法
- 当前仍不是全站页面完成 narrative delivery 改造
