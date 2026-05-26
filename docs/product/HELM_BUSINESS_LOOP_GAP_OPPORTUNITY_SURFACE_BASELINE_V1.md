---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_OPPORTUNITY_SURFACE_BASELINE_V1

Status: Baseline Freeze
Owner: Helm Core
Date: 2026-04-08

## 1. 目标

PR108 只把共享 `businessLoopGapSummary` 扩到 `opportunities`，让机会页与其他 operator-heavy surface 复用同一份主业务闭环缺口 readout contract。

## 2. 已经完整成立

- `opportunities` 已消费共享 `businessLoopGapSummary.primaryGap`
- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities` 已共享同一份 business-loop gap readout contract
- `opportunities` 首屏仍只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`

## 3. 已成形但仍需下一层

- `primaryGap` 优先级仍是 contract-level 静态规则
- `customer-success queue` 仍未并到这套共享 readout

## 4. 刻意未做

- not a schema migration
- not a canonical persisted object
- not a broader operator redesign
- not a customer-success queue refactor
- not an execution-authority expansion

## 5. 风险项

- 如果后续页面绕开共享 readout，再次写 page-local gap logic，页面分叉会回弹
- 当前 readout 不能被误读成 canonical KPI truth
