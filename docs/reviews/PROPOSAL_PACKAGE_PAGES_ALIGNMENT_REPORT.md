---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Proposal / Package Pages Alignment Report

## 当前结论

proposal / package decision-first 页面这轮已经完成四类对齐：

1. 代码
2. 文档
3. 守卫
4. 测试 / 自检

## 代码对齐

当前主文件：

- `lib/presentation/proposal-package-detail-contract.ts`
- `features/proposal-package/detail-model.ts`
- `features/proposal-package/proposal-package-detail-view.tsx`
- `app/(workspace)/proposals/[id]/page.tsx`
- `app/(workspace)/packages/[id]/page.tsx`

当前实现保持：

- proposal / package detail 都先给 `Current Judgement`
- `BoundaryNote` 默认可见
- `EvidenceDrawer` 默认折叠
- internal-only 与 customer-safe 语义分层
- recommendation 不被误写成 commitment

## 文档对齐

当前入口已补到：

- `README.md`
- `docs/README.md`
- `docs/product/demo-script.md`
- `docs/pilot/manual-acceptance-paths.md`
- `docs/pilot/delivery-boundary.md`

## 守卫 / 自检对齐

当前已补到：

- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`

当前会显式检查：

- proposal / package 页是否存在
- 是否仍保留 judgement-first contract
- 是否保留 boundary note
- 是否保留 evidence drawer
- 是否保留 non-commitment / customer-safe / internal review 边界

## 测试对齐

当前已补到：

- `lib/presentation/proposal-package-detail-contract.test.ts`
- `lib/presentation/proposal-package-pages-sprint1.test.ts`

并已接入：

- `npm run test`
- `npm run quality:regression`

## 当前边界

- 当前 proposal / package 页改造仍是第一轮局部落地
- 当前只新增了 proposal / package detail 模板，不代表所有 detail 页都已接入
- 当前仍不等于完整 package engine、proposal platform 或 customer-facing generator
