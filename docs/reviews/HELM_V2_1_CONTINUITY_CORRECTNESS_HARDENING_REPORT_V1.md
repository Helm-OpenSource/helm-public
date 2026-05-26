---
status: archived
owner: helm-core
created: 2026-04-05
review_after: 2026-10-02
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.1 Continuity Correctness Hardening Report v1

更新时间：2026-04-03
状态：Implemented
范围：PR21 narrow correctness hardening for v2.1 continuity slice

## 1. 本轮目标

PR21 只做 v2.1 continuity 纠偏，不扩平台能力：

1. `confirmedFacts` 显式只绑定 promoted truth
2. payload active/pruned state 不再只看 latest edit
3. replay fidelity 扩到 continuity 关键字段
4. continuity operator diagnostics 文档化

## 2. 已落地改动

### 2.1 Promoted truth-only continuity facts

- 新增 `buildPromotedRuntimeFacts(...)`
- prune / resume / session trace / operator continuity queue 全部改为显式调用该 helper
- continuity notebook 不再依赖“隐式 query 过滤”表达 promoted facts 语义

### 2.2 Payload current-state derivation

- 新增 `buildRuntimePayloadHandleState(...)`
- payload current-state 改为：
  - latest checkpoint snapshot
  - 或 checkpoint snapshot + later prune edits
  - 或 latest prune edit
  - 或 all persisted 默认 active
- meeting runtime summary 与 session trace 现在输出：
  - `activeHandles`
  - `prunedHandles`
  - `stateDerivation`
  - `activeInContext`

### 2.3 Replay fidelity coverage widening

- `buildResumeFidelity(...)` 新增 second-layer checks：
  - confirmed facts
  - open questions
  - evidence refs
  - loaded handles
  - pruned handles
  - budget posture
- replay summary wording 同步更新为 continuity + payload + budget posture 语义

### 2.4 Operator diagnostics and docs

- 新增 continuity operator 诊断文档：
  - `SAFE / WATCH / PRUNE / COMPACT` 定义
  - `WEAK` fidelity 排查顺序
  - payload externalization 与 `activeInContext` 语义
  - canonical continuity fields
- continuity baseline 文档同步 widened fidelity 与 payload state derivation 语义

## 3. 受影响组件

- `lib/helm-v2/runtime-upgrade.ts`
- `lib/helm-v2/runtime-upgrade.test.ts`
- `lib/helm-v2/eval-harness.ts`
- `features/meetings/meeting-v2-runtime-card.tsx`
- `docs/product/HELM_V2_1_CONTINUITY_OPERATOR_DIAGNOSTICS_V1.md`
- `docs/product/HELM_V2_1_BUDGETED_SESSION_CONTINUITY_BASELINE_V1.md`
- `docs/README.md`
- `PLANS.md`

## 4. 保留边界

以下边界保持不变：

- workspace-first
- controlled-trial
- judgement-first
- recommendation != commitment
- no auto-send
- no broad auto-write
- no second app tree
- no shell thinning
- no route/query rewrite

## 5. 显式未做

- seven-layer memory cascade completion
- dreaming consolidator
- full compaction engine
- team mode / multi-agent runtime
- broader world-model productization
- public execution surfaces
- auto-send
- broad auto-write

## 6. 验证结果

### 阶段验证（行为变更后）

- `npm run typecheck` 通过
- `npm run lint` 通过
- `npm run self-check` 通过
- `npm run check:boundaries` 通过
- `npm run test` 通过（98 files / 360 tests）
- `npm run build` 通过

### 全量收口验证

已完成并通过：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`（98 files / 360 tests）
- `npm run build`
- `npm run e2e`（15 / 15）
- `npm run quality:regression`（51 files / 180 tests）

额外稳网验证：

- `npm run network:check:strict` 通过
- `npm run e2e:retry` 通过
- `npm run quality:regression:retry` 通过

## 7. 剩余风险

1. 当前 payload state 是“当前态准确”方案，不是完整 event-sourcing 历史回放
2. continuity fidelity 已扩字段，但仍是 narrow slice proveout，不是 full recovery engine
3. 真实高并发和长时运行稳定性仍需单独 pilot 证据
