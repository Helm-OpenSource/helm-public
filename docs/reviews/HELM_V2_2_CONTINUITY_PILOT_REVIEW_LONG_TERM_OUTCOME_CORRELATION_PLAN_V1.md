---
status: active
owner: helm-core
created: 2026-04-05
review_after: 2026-07-04
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.2 Continuity Pilot Review And Long-term Outcome Correlation Plan v1

更新时间：2026-04-04  
状态：Completed  
适用范围：PR31 narrow continuity pilot review / long-term outcome correlation slice

## 1. 当前 freeze truth

当前继承的 freeze 口径：

- PR30 已经完成：
  - finer subgroup review
  - second-pass threshold / confidence refinement
  - drift synthesis
  - SOP effectiveness synthesis
- 当前 continuity calibration 仍然只是 continuity surface 内的 operator-visible review layer：
  - 不驱动 auto-remediation
  - 不扩 execution authority
  - 不等于 production telemetry platform
- 当前 continuity surface 已经能解释：
  - subgroup calibration
  - drift synthesis
  - SOP effectiveness synthesis
- 当前仍缺下一层：
  - 更大 sample 口径下的 subgroup / threshold / confidence 复核
  - SOP guidance 命中后的长期 outcome 对照

## 2. PR31 要证明什么

PR31 要把 continuity pilot review 再推进一层，但仍然只在 continuity surface 与 operator workflow 内：

`larger pilot sample review -> sample-aware subgroup / threshold / confidence recalibration -> long-term outcome correlation -> SOP guidance refinement -> operator-visible continuity insights`

这层只回答：

- 哪些 subgroup 在更大 pilot sample 下仍然成立
- threshold / confidence 在更大 sample 下是否需要继续收紧或明确降级为 advisory
- 哪些 SOP step 命中后长期 outcome 更稳定，哪些步骤长期仍有偏差
- 如何把这些结果收成更诚实的 operator guidance

它不回答：

- 如何自动恢复
- 如何自动执行 remediation
- 如何扩 execution authority

## 3. exact review loop

`expanded pilot sample -> sample-aware subgroup review -> threshold/confidence recalibration -> long-term outcome correlation -> SOP refinement hints -> meeting detail / operating operator insights`

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

## 5. 目标、影响面、关键假设、风险、验证方案

### 5.1 目标

- 扩大 current review 对 pilot sample 的解释力，但只用 repo 内 continuity records、fixture、eval sample、meeting metadata
- 让 subgroup / threshold / confidence 带出 sample-aware 读法，而不是假装已经是生产级统计结论
- 让 SOP 命中率与最终 operator outcome 的长期关系变得 operator-visible、可解释、可保守处理

### 5.2 影响面

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `lib/helm-v2/eval-harness.test.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
- `tests/e2e/*`
- `package.json`
- `evals/helm-v2/*`
- `README.md`
- `docs/README.md`
- `docs/product/HELM_V2_2_CONTINUITY_OPERATOR_RUNBOOK_V1.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- PR31 计划 / 基线 / 报告文档

### 5.3 关键假设

1. PR31 仍然只使用 repo 内 continuity records、fixture、eval sample，以及已经能直接读取的 meeting metadata
2. “larger sample” 表达的是更宽 pilot sample review 和 sample-aware guidance，不表达 production telemetry maturity
3. 新增 correlation 只影响 operator-visible review、runbook、surface hints，不驱动 auto-remediation 或隐藏状态迁移

### 5.4 风险

1. 如果把 sample-aware guidance 写得过重，容易让 operator 误以为这已经是统计真理
2. 如果 long-term outcome correlation 表达不严谨，容易把相关性误写成因果性
3. 如果 subgroup 维度继续扩张过快，会把窄样本写成假精度

### 5.5 验证方案

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

## 6. phase plan

### Phase 0

- 创建 PR31 plan doc
- 更新 `PLANS.md`
- 锁定 truth source、preserved boundaries、deferred scope

### Phase 1

- larger pilot sample review substrate：
  - sample-aware subgroup coverage
  - larger-sample cohort highlights
  - subgroup threshold / confidence readout

### Phase 2

- threshold / confidence recalibration：
  - sample-aware threshold summary
  - sample-aware confidence summary
  - larger-sample recalibration highlights

### Phase 3

- long-term outcome correlation：
  - SOP hit-rate vs long-horizon outcomes
  - step-level outcome drift
  - subgroup / posture outcome correlation highlights

### Phase 4

- SOP refinement hints：
  - stable steps
  - at-risk steps
  - operator guidance refinement summary

### Phase 5

- meeting detail / `/operating` surfaces
- eval fixture / harness / e2e
- baseline / report / README / docs index / self-check / boundary guard

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
