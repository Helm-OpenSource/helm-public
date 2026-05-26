---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Pilot Calibration And Remediation Effectiveness Report v1

更新时间：2026-04-04  
状态：Implemented  
适用范围：PR26 continuity pilot calibration / remediation effectiveness slice

## 1. 本轮目标

PR26 只补 continuity surface 与 operator workflow 内的一层 accuracy / usefulness hardening：

- pilot-backed recovery calibration
- remediation effectiveness classification
- repeated ineffective recovery detection
- calibration + effectiveness evidence surface
- evals and e2e for calibration / effectiveness coverage

本轮目标是提高 continuity recovery 的判断准确性与 operator remediation usefulness，不扩 execution authority。

## 2. 本轮落地内容

### 2.1 Recovery calibration

- `lib/helm-v2/runtime-upgrade.ts`
  - 新增 `buildRuntimeContinuityCalibration()`
  - continuity state 现在同时输出 raw recovery posture 与 calibrated recovery posture
  - calibration 会吸收 `riskLevel`、`replayStatus`、`payloadStateSource`、`failureTaxonomy`、repeat-pattern 与 effectiveness

### 2.2 Remediation effectiveness

- `lib/helm-v2/runtime-upgrade.ts`
  - 新增 `buildRuntimeRemediationEffectiveness()`
  - latest remediation 会被分类为：
    - `EFFECTIVE`
    - `PARTIAL`
    - `INEFFECTIVE`
    - `NO_SIGNAL`
- repeated ineffective recovery 现在会显式归类成：
  - `REPEATED_INEFFECTIVE_ACTION`

### 2.3 Evidence and runbook update

- continuity evidence surface 现在新增：
  - pilot calibration tightened / preserved summary
  - latest effectiveness summary
  - repeat ineffective summary
- continuity runbook 现在会在 ineffective / no-signal posture 下优先建议 stop retry / inspect anchor / escalate review

### 2.4 Operator surfaces

- `features/meetings/meeting-v2-runtime-card.tsx`
  - 新增 `continuity-recovery-calibration`
  - 新增 `continuity-remediation-effectiveness`
- `features/internal-operating-workspace/runtime-operator-panel.tsx`
  - continuity summary 增加 `lowConfidenceContinuitySessions` / `ineffectiveContinuitySessions`
  - continuity queue 增加 calibration confidence、latest effectiveness 与 updated evidence summary

### 2.5 Eval / tests / e2e

- `lib/helm-v2/eval-harness.ts`
  - 新增 `runHelmV22ContinuityPilotCalibrationEvalHarness()`
- `lib/helm-v2/eval-harness.test.ts`
  - 新增 PR26 harness coverage
- `lib/helm-v2/runtime-upgrade.test.ts`
  - 新增 calibration / ineffective loop / workspace queue coverage
- 新增：
  - `scripts/helm-v2-2-continuity-pilot-calibration-evals.ts`
  - `evals/helm-v2/continuity-pilot-calibration-remediation-effectiveness-v2_2-golden-samples.json`
- e2e 更新：
  - `tests/e2e/continuity-recovery.spec.ts`
  - `tests/e2e/continuity-remediation-analytics.spec.ts`
  - ineffective reprune loop e2e 以真实当前链路为准：校准结果保持 `REVIEW_REQUIRED -> REVIEW_REQUIRED · LOW`，并验证 no blind retry

## 3. 本轮未做

本轮明确没有进入：

- continuity auto-remediation orchestrator
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- execution-authority expansion
- full compaction engine

## 4. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- no second app tree
- no shell thinning
- no route/query rewrite

## 5. 验证

本轮实际已通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`
- `npm run eval:helm-v2-2-continuity-remediation-analytics`
- `npm run eval:helm-v2-2-continuity-pilot-calibration`

结果摘要：

- `vitest`: `98` files / `369` tests passed
- `playwright`: `21` tests passed
- `quality:regression`: `51` files / `180` tests passed
- PR26 pilot calibration eval: `4/4` passed
- PR25 remediation analytics eval: `4/4` passed

## 6. 当前结论

PR26 已把 continuity surface 从“能解释 remediation”推进到“能校准 recovery state、能评估 remediation effectiveness、能识别 repeated ineffective loop”。  
这仍然是一层 continuity operator hardening，不是新的执行面，也不是权限扩张。
