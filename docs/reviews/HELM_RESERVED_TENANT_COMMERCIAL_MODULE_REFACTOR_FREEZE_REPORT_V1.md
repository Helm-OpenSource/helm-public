---
status: archived
owner: helm-core
created: 2026-04-20
review_after: 2026-10-17
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Reserved Tenant Commercial Module Refactor Freeze Report V1

## 结论

`Helm 租户商业模块重构整理` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- reserved workspace commercial module 的 ownership guard、program/application 主链路、participant portal invite lifecycle、manual settlement posture、proof/readiness/evidence truth 和 operator readout 已经开始收口到同一套 current-main contract
- `paid-without-export` 现在已经在 settlement exception、proof pack、payout readiness 和 settings operator readout 里保持同一口径
- docs / self-check / boundary guard / targeted tests 已经对齐到同一版 truth
- 但这仍然不是 payout execution plane、不是 finance console、不是 marketplace，也不是整个商业模块全部完工后的最终冻结

## 已经完整成立

- reserved workspace commercial module 的高风险 service seam 已形成 `reserved workspace + capability` 双重守卫
- `program -> application` 主链路已收口：
  - `INVITED` 不再被普通 review 写入伪造
  - active duplicate posture 保持稳定
- `participant portal access` 已形成共享 invite/access truth：
  - invite usability state 已显式区分 `usable / not_found / invalid_host / expired / already_used / suspended / archived`
  - reissue posture 已显式区分 `issue_fresh_access / reissue_existing_invite / reissue_archived_access / blocked_active_access / blocked_suspended_access`
- `manual settlement` batch/line posture 已收口：
  - `approve` 只允许从 `DRAFT`
  - `export` 只允许从 `APPROVED`
  - `close` 只允许从 `EXPORTED` 且 line posture 满足 close 条件
  - `mark paid` 只允许从 `EXPORTED`
  - `reverse` 只允许从 `EXPORTED` 或 `PAID`
- `manual settlement` 的 audit/operator payload 已形成统一 helper，不再由各 action 各自拼接 wording
- `settlement evidence` helper 已成立：
  - 只有 export-backed `paid / reversed` line 才算 completion evidence
  - `paid-without-export` 已被 proof/readiness/operator readout 识别为 anomaly，而不是 completion proof
- `payout readiness`、`pilot cohort` 与 `settlement ops proof pack` 已共享同一份 evidence truth
- `README / docs / PLANS / self-check / boundary check` 已同步到这一版 commercial settlement evidence truth

## 已成形但仍需下一层

- 当前是商业模块 refactor 的阶段冻结，不是整个 commercial module 的 final freeze
- `Task 6` 的 support-pack 与 settings 治理读面仍未统一收口
- `participant portal` 更深的 profile / payout readiness 叙事仍可继续收紧
- settlement exception 现在已经统一到 evidence/readiness/operator readout，但更深的 exception replay / compensation 仍未形成独立闭环
- 当前验证链只证明这条商业模块切片成立，整仓标准链还没有恢复到可诚实宣称全绿的状态

## 刻意未做

- 不做 payout rail execution
- 不做 finance console 平台化
- 不做 marketplace
- 不做完整 RBAC / IAM 平台化
- 不做 broader support-pack export surface 扩面
- 不做 automatic settlement / automatic payout / external commitment

## 风险项

- 整仓 `typecheck` 仍被 current-main 既有无关 UI 基线问题挡住：
  - `app/contrast-test/page.tsx`
  - `app/page.tsx`
  - `components/layout/sidebar-optimized.tsx`
  - `components/shared/guidance-preferences-control.tsx`
  - `components/shared/simplified-guidance-panel.tsx`
  - `components/ui/enhanced-button.tsx`
  - `extensions/guangpu/bi-report/features/surfaces/bi-report-surface.tsx`
- 本机 `eslint` 依赖链当前损坏，`eslint-config-next` 缺少 `eslint-module-utils/resolve`
- 当前 `.env.local` 指向远端 MySQL；在没有独立本地/CI 数据库的前提下，不能诚实地在这条分支上直接执行 `db:reset`
- 这条 freeze 分支还没有 push，当前只是本地隔离后的干净提交

## 必须继续诚实保留的边界

- 这仍然不是 payout execution plane
- 这仍然不是 finance platform
- 这仍然不是 marketplace
- 这仍然不是 complete commercial module final freeze
- recommendation / explanation 仍然不等于 commitment
- manual settlement 仍然是当前第一方 product truth 的 fallback source of truth，而不是自动打款能力

## 当前基线 / sprint 目标是否清楚

清楚。

当前这条冻结线的目标是：

1. 把 reserved workspace commercial module 当前已经成立的治理与 settlement evidence truth 冻成 current-main 可验证切片
2. 明确 `paid-without-export` 在 exception / proof / readiness / operator readout 四层里保持同一口径
3. 在进入 support-pack 统一读面或更深 payout rail 之前，先把这条商业模块中段 truth 收干净

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

这一阶段没有把：

- readiness 写成 payout commitment
- proof pack 写成 payout-ready guarantee
- participant portal 写成 marketplace
- settlement evidence 写成 automatic payout execution

## 验证

当前这轮 freeze 实际已验证：

```bash
npx vitest run lib/billing/settlement-evidence.test.ts lib/billing/settlement-exceptions.test.ts lib/billing/settlement-ops-proof-pack.test.ts lib/billing/payout-rail-readiness.test.ts lib/billing/payout-rail-pilot-cohort.test.ts features/settings/formatters/billing-readout-narratives.test.ts
set -a && source /Users/tommyqian/Documents/GitHub/helm2026/.env.local && set +a && npm run self-check
npm run check:boundaries
npm run typecheck
git diff --check
```

当前结果：

- 通过：
  - settlement/proof/readiness narrative 定向 `vitest`：`6 files / 21 tests` 全绿
  - `self-check`
  - `check:boundaries`
  - `git diff --check`
- 阻塞：
  - `typecheck` 仍被 current-main 既有无关 UI 基线问题挡住
  - `lint` 当前被本机 `eslint` 依赖链损坏挡住，不是这条切片自己的 lint 问题
- 本轮未运行：
  - `db:reset`
  - `test`
  - `build`
  - `e2e`
  - `quality:regression`

未运行原因必须诚实保留：

- `db:reset` 当前不适合直接对指向远端 MySQL 的 `.env.local` 执行
- `lint` 与整仓 `typecheck` 已被仓库级无关基线问题挡住，继续跑 `build / e2e / quality` 只会放大噪音，而不是提高这条切片的验证信号

因此，这条 freeze 当前只能诚实表述为：

- 商业模块 `Task 5` 当前切片已经隔离、可验证、可提交
- 整仓标准链未全绿，阶段 freeze 还不是 final freeze

## 下一阶段最该做的 5 件事

1. 继续在这条干净分支上收 `Task 6`，把 support-pack 与 settings 治理读面统一
2. 单独处理整仓 `typecheck` 的无关 UI 基线问题，恢复 freeze 级验证信号
3. 修复本机 `eslint` 依赖链，恢复 `lint` 可信度
4. 为这条商业模块线准备独立本地/CI 数据库，再补 `db:reset / test / e2e` 级验证
5. 在 `Task 6` 收口和标准链恢复后，再决定做 commercial module final freeze，还是继续推进更深的 payout readiness/support-pack truth
