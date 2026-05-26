---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Narrative Components / Decision-first Pages Baseline Review Report

## 当前结论

这轮 review 的目标不是继续扩页面，而是确认 Narrative Components、信息层级、代表页改造、demo / training / acceptance 资产，是否已经形成一个一致、可冻结的版本。

当前 review 结论：

- 代码实现与文档主结论一致
- 共享 narrative component registry 与共享组件层已经成立
- 首页、opportunities、approvals 三页已经能稳定作为第一轮 Decision-first 模板页
- README、docs 索引、自检、边界检查、回归和交付资产已经能指向同一套 narrative / hierarchy 口径

## 已与代码实现一致的表述

- `NarrativeHeader / WhyItMattersBlock / HelmDidBlock / DecisionRequestCard / CollaborationRequestCard / ActionRail / BoundaryNote / WorkerSummary / EvidenceDrawer` 已有共享类型与共享组件实现
- `EvidenceChip` 已作为轻量 supporting component 进入组件基线，而不是散落在各页的临时标签
- L1-L4 四层信息结构已固定在共享协议与共享文档里
- 首页、机会页、审批页已经真实接入 `ReportingProtocolPanel` 和 `ProactiveMechanismPanel`
- 页面首屏不再默认从对象列表和状态堆叠开始

## 已足以冻结的能力

- Narrative Components 的组件职责、输入、层级和默认使用边界
- L1 judgement / L2 action / L3 boundary / L4 evidence 的首屏关系
- 首页、opportunities、approvals 三页作为第一轮代表页模板
- demo / training / acceptance / delivery 对这三页的复用讲法

## 仍需降级口径的能力

- 当前不是全站完成的 narrative component system，只是共享组件层加 3 个模板页
- 当前不是完整的 Decision-first IA 平台，contacts / companies / meetings / inbox 仍待下一阶段接入
- 当前不是完整 design system 平台，颜色、细节样式和更多详情页结构仍有下一层空间

## 下一阶段候选

- proposal / package 详情页接入同一套模板
- contacts / companies / meetings / inbox 详情页接入
- 更统一的 detail drawer / sheet narrative layout
- 更稳定的 worker assignment / active collaboration 详情视图

## 必须继续诚实保留的边界

- 当前 Narrative Components / 信息层级仍是第一轮局部落地，不是全站完成重构
- `app/` 仍是当前唯一或主要 route owner
- `data/queries.ts` 仍是查询聚合入口，只是已经更薄
- plugin runtime 仍没有真正 sandbox
- future-real auth 仍不是完整生产级认证，只是更稳的受控试点认证链
- 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
