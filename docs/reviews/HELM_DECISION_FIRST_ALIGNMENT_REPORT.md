---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_DECISION_FIRST_ALIGNMENT_REPORT

## 对齐范围

本轮已同步对齐：

- 代码与共享组件
- README 与 docs 索引
- 产品原则文档
- 试点边界与人工验收说明
- self-check / boundary check / quality regression
- 代表页测试

## 代码与组件

- [`page-header.tsx`](../../components/shared/page-header.tsx)
- [`reporting-protocol.ts`](../../lib/presentation/reporting-protocol.ts)
- [`reporting-protocol-panel.tsx`](../../components/shared/reporting-protocol-panel.tsx)

## 代表页

- [`dashboard/page.tsx`](<../../app/(workspace)/dashboard/page.tsx>)
- [`opportunities-client.tsx`](../../features/opportunities/opportunities-client.tsx)
- [`approvals-client.tsx`](../../features/approvals/approvals-client.tsx)

## 次级同步页

- [`memory-client.tsx`](../../features/memory/memory-client.tsx)
- [`inbox-client.tsx`](../../features/inbox/inbox-client.tsx)
- [`sidebar.tsx`](../../components/layout/sidebar.tsx)

## 守卫与脚本

- [`helm-self-check.ts`](../../scripts/helm-self-check.ts)
- [`decision-first-boundary-check.ts`](../../scripts/decision-first-boundary-check.ts)

新增 npm scripts：

- `npm run self-check`
- `npm run check:boundaries`
- `npm run quality:regression`

## 测试

- [`reporting-protocol.test.ts`](../../lib/presentation/reporting-protocol.test.ts)
- [`decision-first-ia.test.ts`](../../lib/presentation/decision-first-ia.test.ts)
- 继续保留 [`index.test.ts`](../../lib/reports/index.test.ts) 作为周报主链守线的一部分

## 诚实边界

- 当前 guard 主要覆盖“有没有 judgement / decision request / boundary / evidence drawer”。
- 当前还没有做到全站页面自动语义审计。
- 这轮 alignment 已经足够拦住代表页回退成对象堆叠，但还不是完整 IA lint 平台。
