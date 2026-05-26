---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_LOOP_GAP_READOUT_HELPER_BASELINE_V1

Status: Baseline Freeze
Owner: Helm Core
Date: 2026-04-08

## 1. 目标

PR110 只把各页重复的 business-loop gap 首屏映射收口成一个更薄的 page-level helper，让 operator-heavy surface 继续复用同一份 shared readout contract，而不是在每页重复拼接 `blocker / pending decision / next action / loop gap connection`。

## 2. 已经完整成立

- `lib/presentation/business-loop-gap-readout.ts` 已成立，固定输出：
  - `blocker`
  - `pendingDecision`
  - `nextAction`
  - `connection`
- `dashboard / reports / operating / inbox / diagnostics / approvals / imports / opportunities / customer-success queue` 已改为复用同一份 helper
- 首屏仍保持 `对象状态 / 阻塞 / 待决策 / 下一步动作` 四类信息 contract

## 3. 已成形但仍需下一层

- `primaryGap` 优先级仍是 contract-level 静态规则
- helper 仍是 presentation-only contract，不是 canonical persisted truth
- page-level helper 已统一，但还不是更强的 page schema

## 4. 刻意未做

- not a schema migration
- not a canonical persisted object
- not a KPI canonicalization pass
- not a broader operator redesign
- not an execution-authority expansion

## 5. 风险项

- 如果后续页面绕过 helper 重新写 page-local gap 映射，首屏 readout 很容易再次分叉
- 当前 helper 只收口 presentation 逻辑，不能被误读成 canonical KPI truth
