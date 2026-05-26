---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Calibration Deepening / SOP Effectiveness Synthesis Plan v1

更新时间：2026-04-04  
状态：Planned  
适用范围：PR30 narrow continuity calibration deepening / operator insight slice

## 1. 当前 freeze truth

当前继承的 freeze 口径：

- PR28 已经完成：
  - pilot cohort breakdown
  - threshold / confidence revision
  - drift trend review
  - SOP hit-rate / operator handling comparison
- PR29 已经把 continuity review 推进到：
  - `cohortFamilies`
  - `riskBandSummary`
  - `revisedHighlights`
  - `longHorizonDriftRate`
  - `materiallyDriftingCohorts`
  - `outcomeVarianceSummary`
  - `stepReviews`
- 当前 continuity calibration 仍然只是 operator-visible review layer：
  - 不驱动 auto-remediation
  - 不扩 execution authority
  - 不等于 production telemetry platform

## 2. PR30 要证明什么

PR30 要把 continuity pilot calibration 再推进一层，但仍然只在 continuity surface 和 operator workflow 内：

`finer pilot subgrouping -> second-pass threshold / confidence refinement -> drift synthesis -> SOP effectiveness synthesis -> operator-visible calibration insights`

这层只回答：

- 哪些更细 cohort pattern 需要不同的 calibration 读法
- threshold / confidence 在这些 subgroup 上是否需要更细 guidance
- long-horizon drift 是否在某些 subgroup 上更集中
- SOP 哪些步骤更稳定，哪些步骤仍然容易误导或失效

它不回答：

- 如何自动恢复
- 如何自动执行 remediation
- 如何扩 execution authority

## 3. exact review loop

`continuity pilot sample -> finer cohort subgroups -> recalibrated threshold/confidence suggestions -> drift synthesis -> SOP effectiveness synthesis -> meeting detail / operating operator insights`

## 4. preserved boundaries

以下边界保持不变：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no route/query rewrite

## 5. phase plan

### Phase 0

- 创建 PR30 plan doc
- 更新 `PLANS.md`
- 锁定 truth source、preserved boundaries、deferred scope

### Phase 1

- finer pilot subgroup review
- 只使用 repo 内已有 continuity records 与可验证 meeting metadata
- 新 subgroup 优先覆盖：
  - session density
  - failure history
  - meeting frequency
  - participant role posture（仅在 metadata 足够时）

### Phase 2

- second-pass threshold / confidence refinement
- 输出更细 subgroup 的：
  - threshold suggestion
  - confidence summary
  - calibration highlight

### Phase 3

- drift synthesis
- 把 long-horizon drift、repeat ineffective posture、effectiveness change 组合成更可读的 subgroup / workspace review

### Phase 4

- SOP effectiveness synthesis
- 把 SOP step hit-rate、skipped guidance、ineffective-after-hit、final operator outcome 做更明确的对照
- 产出 operator-visible runbook refinement hints

### Phase 5

- meeting detail / `/operating` surfaces
- eval fixture / harness / e2e
- baseline / report / README / docs index / self-check / boundary guard

## 6. eval contract

每个 phase 后：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`

发生真实行为或视图变化后追加：

- `npm run test`
- `npm run build`

最终收口：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. 显式延期项

本轮明确不做：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics
