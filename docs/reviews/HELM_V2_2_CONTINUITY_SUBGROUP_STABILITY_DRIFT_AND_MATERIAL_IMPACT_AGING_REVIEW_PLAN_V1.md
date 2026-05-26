---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Subgroup Stability Drift And Material Impact Aging Review Plan v1

更新时间：2026-04-05  
状态：Planned  
适用范围：PR36 continuity subgroup stability drift / interval wording aging-regression audit / material impact pattern aging review slice

## 1. 当前 freeze truth

当前继承的 freeze 口径是：

- PR35 已完成：
  - subgroup scale-up recheck
  - wording drift tracking
  - interval consistency guidance
  - long-term material impact audit
- 当前 continuity calibration 仍然是 repo 内 pilot sample + rule profile，不是 production telemetry analytics
- 当前 continuity surface 已能回答：
  - subgroup scale-up recheck 是否稳住
  - wording drift 是否已回到 canonical interval wording
  - long-term material impact 是否只是 advisory 还是已有 broader-sample pattern

## 2. 本轮证明什么

PR36 只证明 continuity review 的下一层 aging truth：

1. subgroup recheck 可以跨更长时间窗做 drift 对照，而不是只看当前 scale-up recheck
2. interval wording 可以做跨 surface aging / regression audit，而不是只看当前 wording drift rate
3. material impact pattern 可以做 aging review，而不是只看当前 long-term material impact audit
4. 这些输出继续保持 operator-visible / review-first，不进入自动恢复或执行权扩张

## 3. exact review loop

`subgroup scale-up recheck -> longer-horizon subgroup drift comparison -> interval wording aging / regression audit -> material impact pattern aging review -> operator-visible continuity guidance`

这条 loop 只服务 continuity operator diagnosis / calibration review，不扩 execution authority。

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

## 5. 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/continuity-remediation-analytics.spec.ts`
- `evals/helm-v2/*`
- `scripts/helm-v2-2-*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR36 baseline / report / plan 文档

## 6. 关键假设

1. PR36 仍然只使用 repo 内 continuity records、fixture、eval sample，以及可直接关联的 meeting metadata
2. subgroup drift、wording aging、material impact aging 只影响 operator-visible guidance，不驱动自动状态迁移
3. interval wording aging / regression audit 只表达 canonical wording 是否持续稳定，不表达正式统计区间系统
4. material impact aging review 只表达更长周期的 pattern persistence，不表达 SOP 因果已经成立

## 7. 风险

1. subgroup drift 如果只补 longer-horizon wording 不补 cohort-specific findings，operator 仍难区分局部波动和真正 aging drift
2. wording aging audit 如果不覆盖 queue / session / operator surface，仍可能出现“底层已一致、展示层重新漂移”
3. material impact aging review 如果只重复当前 audit 文案，无法说明 pattern 是在延续、衰减，还是仅停留在局部样本

## 8. phase plan

### Phase 0

- 创建 PR36 plan doc
- 更新 `PLANS.md`
- 锁定 truth source 与 deferred scope

### Phase 1

- subgroup recheck long-term drift：
  - longer-horizon subgroup drift comparison
  - subgroup-specific drift findings
  - session-level subgroup drift summary

### Phase 2

- interval wording aging / regression audit：
  - threshold / step / queue / session / surface wording follow-through
  - aging summary / regression rate / canonical guidance continuity
  - session-level wording aging summary

### Phase 3

- material impact pattern aging review：
  - long-horizon material impact persistence summary
  - aging patterns / optimization hints
  - session-level material impact aging summary

### Phase 4

- continuity surfaces
- eval fixtures / harness / tests / e2e
- baseline / report / docs index / self-check / boundary guard

## 9. eval contract

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

## 10. 显式延期项

- auto-remediation orchestration
- execution-authority expansion
- team mode / multi-agent runtime
- broader world-model productization
- route / handler rewrite
- public execution surfaces
- auto-send
- broad auto-write
- production-grade telemetry analytics
