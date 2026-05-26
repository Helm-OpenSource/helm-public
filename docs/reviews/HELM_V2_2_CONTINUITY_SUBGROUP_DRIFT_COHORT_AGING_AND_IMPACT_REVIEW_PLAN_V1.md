---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Drift Cohort Aging And Impact Review Plan v1

更新时间：2026-04-05  
状态：Planned  
适用范围：PR37 continuity subgroup drift cohort aging / cross-surface interval wording regression / material impact aging sampling review slice

## 1. current freeze truth

当前继承的 freeze 口径是：

- PR36 已完成：
  - subgroup stability drift review
  - interval wording aging / regression audit
  - material impact pattern aging review
- continuity calibration 仍然只基于 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- continuity surface 已经能回答：
  - subgroup drift 是否在更长 horizon 上开始 aging 分化
  - interval wording 是否仍保持 canonical wording
  - material impact pattern 是 persistent、fading，还是 unstable
- 但当前还缺：
  - subgroup drift 的更长期 cohort aging 对照
  - interval wording 的跨 surface regression 复核
  - material impact aging 的持续扩样复核

## 2. what PR37 is proving

PR37 要证明的是：

1. continuity pilot review 可以在更长期的 cohort aging 上给出诚实的 subgroup drift readout
2. interval wording 可以在 meeting detail、queue、operator panel、runbook 之间持续保持 canonical wording，并暴露 regression
3. material impact aging 可以基于持续扩样输出更稳的 longer-horizon impact guidance
4. 上述结果仍然只服务 operator diagnosis / calibration review，不会扩 execution authority

## 3. exact review loop

`subgroup stability drift review -> cohort aging comparison -> cross-surface interval wording regression review -> material impact aging sampling review -> operator-visible continuity guidance`

这条 loop 只服务 continuity surface / operator workflow，不扩 route tree，不扩 execution plane，不引入 auto-remediation。

## 4. preserved boundaries

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

- 创建 PR37 plan doc
- 更新 `PLANS.md`
- 锁定 truth source、影响面、风险和 deferred scope

### Phase 1

- subgroup drift cohort aging
  - 增加 longer-term cohort aging review
  - 输出 drift comparison / cohort aging findings
  - 给 session-level pilot review 增加 cohort aging summary

### Phase 2

- interval wording cross-surface regression
  - 复核 meeting detail、queue、operator panel、runbook 的 wording
  - 输出 regression findings / adjustment recommendations
  - 给 session-level pilot review 增加 wording regression summary

### Phase 3

- material impact aging sampling review
  - 复核持续扩样下的 impact pattern
  - 输出 aging material impact analysis / long-term impact refinement
  - 给 session-level pilot review 增加 material impact sampling summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 6. eval contract

PR37 至少要新增或更新覆盖：

- subgroup drift cohort aging readout 不会把局部 aging fluctuation 误写成全局稳定性
- interval wording regression 能在跨 surface 显式暴露，而不是静默漂移
- material impact aging sampling 能区分 broader-sample signal 与 narrow hint
- session-level pilot review 会带上 PR37 的三个 summary
- meeting detail 和 `/operating` 会显式显示 PR37 operator insight

最终验证合同：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

## 7. explicitly deferred items

PR37 明确不做：

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics
