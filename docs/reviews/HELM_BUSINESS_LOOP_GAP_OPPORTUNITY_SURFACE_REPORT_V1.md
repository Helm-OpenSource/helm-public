---
status: archived
owner: helm-core
created: 2026-04-08
review_after: 2026-10-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_REPORT_V1

Status: Completed
Owner: Helm Core
Date: 2026-04-08

## 1. 本轮结果

PR108 已把共享 `businessLoopGapSummary` 扩到 `opportunities`。

本轮成立：

- `features/opportunities/page-loader.ts` 已接入 `getWorkspaceBusinessLoopGapReadout()`
- `app/(workspace)/opportunities/page.tsx` 已把 `businessLoopGapSummary` 传给 `OpportunitiesClient`
- `features/opportunities/opportunities-client.tsx` 已把 `primaryGap` 前置到首屏 `阻塞 / 待决策 / 下一步动作`
- `opportunities` 的连接卡片已优先显示 `Loop gap`

## 2. 已成立 truth

- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities` 已共享同一份 business-loop gap readout contract
- `opportunities` 继续保持 business-first 四类信息 contract

## 3. 未成立 truth

- 不是 canonical persisted `OperatingGap`
- 没有 KPI canonical object
- `customer-success queue` 仍未并到这套 readout

## 4. 刻意未做

- not a schema migration
- not a canonical persisted object
- not a broader operator redesign
- not a customer-success queue refactor
- not an execution-authority expansion

## 5. 验证

- `db:reset`
- `self-check`
- `check:boundaries`
- `typecheck`
- `lint`
- `test`
- `build`
- `e2e`
- `quality:regression`
- `pilot:check`
