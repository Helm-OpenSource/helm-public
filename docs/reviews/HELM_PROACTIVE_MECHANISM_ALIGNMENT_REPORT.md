---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_PROACTIVE_MECHANISM_ALIGNMENT_REPORT

## 对齐范围

本轮已同步对齐：

- 主动汇报共享协议
- 主动协作共享协议
- 3 条代表性主动链路
- README / docs 索引 / 产品原则
- pilot 边界与人工验收说明
- self-check / boundary check / regression / e2e

## 代码与组件

- [`proactive-mechanism.ts`](../../lib/presentation/proactive-mechanism.ts)
- [`proactive-mechanism-panel.tsx`](../../components/shared/proactive-mechanism-panel.tsx)

## 代表页

- [`dashboard/page.tsx`](../../app/(workspace)/dashboard/page.tsx)
- [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)
- [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)

## 文档

- [`README.md`](../../README.md)
- [`docs/README.md`](../README.md)
- [`product-principles.md`](../product/product-principles.md)
- [`manual-acceptance-paths.md`](../pilot/manual-acceptance-paths.md)
- [`delivery-boundary.md`](../pilot/delivery-boundary.md)

## 守卫与脚本

- [`helm-self-check.ts`](../../scripts/helm-self-check.ts)
- [`decision-first-boundary-check.ts`](../../scripts/decision-first-boundary-check.ts)
- [`pilot-readiness-check.ts`](../../scripts/pilot-readiness-check.ts)

## 测试

- [`proactive-mechanism.test.ts`](../../lib/presentation/proactive-mechanism.test.ts)
- [`reporting-protocol.test.ts`](../../lib/presentation/reporting-protocol.test.ts)
- [`decision-first-ia.test.ts`](../../lib/presentation/decision-first-ia.test.ts)
- [`demo-flows.spec.ts`](../../tests/e2e/demo-flows.spec.ts)

## 诚实边界

- 当前 guard 仍主要覆盖代表页，不是全站语义 lint。
- 当前主动机制检查的是 active report / collaboration 协议是否存在，不是完整自动执行审计器。
- 这轮 alignment 已足够拦住代表页退回成“被动对象堆叠”，但还不是完整交互治理平台。
