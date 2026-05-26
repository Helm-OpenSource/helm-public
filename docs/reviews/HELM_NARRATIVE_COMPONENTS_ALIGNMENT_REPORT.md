---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Narrative Components Alignment Report

## 对齐范围

本轮已经把以下层面重新对齐：

- 共享协议
- 共享组件
- 3 个代表性页面
- README / docs 索引
- self-check
- boundary check
- vitest 回归

## 当前对齐入口

代码：

- [../../lib/presentation/narrative-components.ts](../../lib/presentation/narrative-components.ts)
- [../../components/shared/narrative-components.tsx](../../components/shared/narrative-components.tsx)
- [../../components/shared/reporting-protocol-panel.tsx](../../components/shared/reporting-protocol-panel.tsx)
- [../../components/shared/proactive-mechanism-panel.tsx](../../components/shared/proactive-mechanism-panel.tsx)

守卫：

- [../../scripts/helm-self-check.ts](../../scripts/helm-self-check.ts)
- [../../scripts/decision-first-boundary-check.ts](../../scripts/decision-first-boundary-check.ts)

测试：

- [../../lib/presentation/narrative-components.test.ts](../../lib/presentation/narrative-components.test.ts)
- [../../lib/presentation/reporting-protocol.test.ts](../../lib/presentation/reporting-protocol.test.ts)
- [../../lib/presentation/decision-first-ia.test.ts](../../lib/presentation/decision-first-ia.test.ts)
- [../../lib/presentation/page-component-hierarchy-spec.test.ts](../../lib/presentation/page-component-hierarchy-spec.test.ts)

## 当前口径

- 当前 Narrative Components 已经是共享代码，不再只是设计说明
- 当前信息层级规则已经进入协议、组件和守线
- 当前 3 个代表页已接入统一骨架
- 当前仍是第一轮局部落地，不是全站完成重构

## 仍需下一层

- contacts / companies / meetings / inbox 的接入
- proposal / package 详情页模板化
- 更严格的 customer-facing / internal-only 分层守线
