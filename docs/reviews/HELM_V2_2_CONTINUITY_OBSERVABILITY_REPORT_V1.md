---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.2 Continuity Observability Report v1

更新时间：2026-04-04  
状态：Implemented  
适用范围：PR22 narrow continuity observability slice

## 1. 本轮目标

PR22 只补一个窄层：  
把 v2.1 continuity runtime 的预算/回放状态，收敛成 operator 可读的风险姿态与动作建议。

目标是提升 continuity correctness 的可观测性，不是新增 execution authority。

## 2. 本轮落地内容

### 2.1 Runtime continuity risk helper

- `lib/helm-v2/runtime-upgrade.ts` 新增 `buildRuntimeContinuityRisk(...)`
- 输出统一结构：
  - `level`：`LOW | WATCH | HIGH`
  - `summary`：风险短摘要
  - `operatorAction`：一行可执行建议
- 规则实现：
  - replay `WEAK` 优先级最高，直接 `HIGH`
  - budget-sensitive/prune posture -> `WATCH`
  - 其余稳定态 -> `LOW`

### 2.2 Workspace operator overview / queue

- continuity queue 增加字段：
  - `replayStatus`
  - `payloadStateSource`
  - `riskLevel`
  - `riskSummary`
- summary 增加指标：
  - `weakReplaySessions`
  - `highRiskContinuitySessions`
  - `checkpointDerivedContinuitySessions`
- `/operating` runtime operator panel 新增对应统计卡片与 queue 元信息显示

### 2.3 Eval / test / scripts

- `lib/helm-v2/eval-harness.ts` 新增 `runHelmV22ContinuityObservabilityEvalHarness()`
- `lib/helm-v2/eval-harness.test.ts` 新增 continuity observability harness test
- `lib/helm-v2/runtime-upgrade.test.ts` 补 continuity risk 分类和 operator overview 字段断言
- 新增脚本：
  - `scripts/helm-v2-2-continuity-observability-evals.ts`
- `package.json` 新增入口：
  - `eval:helm-v2-2-phase2`
  - `eval:helm-v2-2-continuity-observability`

## 3. 本轮未做

本轮明确没有进入：

- full continuity auto-recovery orchestration
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write
- platform expansion

## 4. preserved boundaries

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

## 5. 验证

本轮已验证：

- `npm run typecheck`
- `npm run lint`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run test`
- `npm run build`
- `npm run eval:helm-v2-2-continuity-observability`

## 6. 当前结论

PR22 已把 v2.1 continuity runtime 从“能看见状态”推进到“可分级、可解释、可行动”的 operator posture。  
这是一层 observability hardening，不是权限或执行面的扩张。
