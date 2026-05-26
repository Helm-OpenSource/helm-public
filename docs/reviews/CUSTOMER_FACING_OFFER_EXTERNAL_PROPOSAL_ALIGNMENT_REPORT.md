---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Customer-facing Offer / External Proposal Alignment Report

## 当前结论

customer-facing offer / external proposal decision-first 页面这轮已经完成四类对齐：

1. 代码
2. 文档
3. 守卫
4. 测试 / 自检

## 代码对齐

当前主文件：

- `lib/presentation/customer-facing-offer-external-proposal-detail-contract.ts`
- `features/customer-facing-offer-external-proposal/detail-model.ts`
- `features/customer-facing-offer-external-proposal/detail-view.tsx`
- `app/(workspace)/offers/[id]/page.tsx`
- `app/(workspace)/external-proposals/[id]/page.tsx`

当前实现保持：

- customer-facing offer / external proposal detail 都先给 `Current Judgement`
- `BoundaryNote` 默认可见
- `EvidenceDrawer` 默认折叠
- internal-only、customer-facing、non-commitment 与 sendability 语义分层
- recommendation / discussion-only 不被误写成 commitment

## 文档对齐

当前入口已补到：

- `README.md`
- `docs/README.md`
- `docs/product/demo-script.md`
- `docs/pilot/manual-acceptance-paths.md`
- `docs/pilot/delivery-boundary.md`
- `docs/product/product-principles.md`

## 守卫 / 自检对齐

当前已补到：

- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`

当前会显式检查：

- customer-facing offer / external proposal 页是否存在
- 是否仍保留 judgement-first contract
- 是否保留 boundary / sendability note
- 是否保留 evidence drawer
- 是否保留 non-commitment / review-before-send / not-safe-to-send 边界
- 是否仍通过 README / docs / demo / acceptance / delivery 提供统一入口

## 测试对齐

当前已补到：

- `lib/presentation/customer-facing-offer-external-proposal-detail-contract.test.ts`
- `lib/presentation/customer-facing-offer-external-proposal-pages-sprint1.test.ts`

并已接入：

- `npm run test`
- `npm run quality:regression`

## 当前边界

- 当前 customer-facing offer / external proposal 页改造仍是第一轮局部落地
- 当前只新增了 2 个外部表达 detail 模板页，不代表所有 detail 页都已接入
- 当前仍不等于完整 offer platform、external proposal generator 或 legal / contract engine
