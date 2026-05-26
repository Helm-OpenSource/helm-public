---
status: archived
owner: helm-core
created: 2026-04-18
review_after: 2026-10-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.1 SWARM-002 Read-only Worker Fan-out Freeze Report V1

## 结论

`SWARM-002` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- 当前已经把 read-only worker 的 `allowlist / handoff preview / request lifecycle / lane intent / placeholder seam / execution seam / materialization seam / result-side seam / adoption seam` 收进同一条 typed contract spine
- `runThread`、operator debugger、meeting runtime surface 和 `/operating` continuity queue 已经开始共享同一份 read-only worker truth
- 最小 runtime events 已经形成 bounded record seam，但仍然只到 `request / intent / placeholder / execution record / materialization record / adoption record`
- 这仍然不是真实 read-only worker fan-out，也不是 verifier merge lane、operator swarm control plane 或 broader authority plane

## 已经完整成立

- `swarmReadOnlyWorkerContract` 已经统一收口 `search / grep / evidence_mining` 三条 allowlisted worker lane
- `artifact-first / no-transcript-merge` 边界已经稳定接回 contract 与 surface
- `requestLifecycleState / handoffPreviewState / packetConsumptionIntentState` 已经成立
- `artifactBundlePlaceholderState / handoffConsumptionState` 与对应 record seam 已经成立
- `executionPreflightState / executionGuardContract / executionRecordState / executionLifecycleContract` 已经成立
- `executionCandidateContract` 已经把 result-side execution candidate truth 显式化
- `artifactMaterializationGuardContract / artifactMaterializationRecordState / artifactMaterializationLifecycleContract` 已经成立
- `resultSideOutputContract / resultSideOutputGuardContract / resultSideOutputLifecycleContract` 已经成立
- `outputConsumptionContract / resultAdoptionContract / outputAdoptionGuardContract / outputAdoptionRecordState / outputAdoptionLifecycleContract / resultAdoptionResultSideContract` 已经成立
- 最小 runtime events 已经成立：
  - `swarm.spawn.requested`
  - `swarm.read-only-worker.intent.recorded`
  - `swarm.read-only-worker.placeholder.recorded`
  - `swarm.read-only-worker.execution.recorded`
  - `swarm.read-only-worker.materialization.recorded`
  - `swarm.read-only-worker.adoption.recorded`
- `README / docs / PLANS / self-check` 已同步到同一版 discoverability truth

## 已成形但仍需下一层

- 当前只到 bounded record seam，还没有真实 read-only worker fan-out
- 当前还没有真实 artifact bundle 持久化
- 当前还没有真实 output consumption / adoption result 执行结果
- 当前还没有 verifier / arbiter merge lane
- 当前 operator readout 仍然只是 bounded read-model，不是 swarm control plane

## 刻意未做

- 不做真实多 worker 并行执行
- 不做 nested spawn
- 不做 transcript merge
- 不做 verifier / arbiter merge lane
- 不做 operator pause / resume / kill
- 不做 candidate consolidation fan-out
- 不做 broader workflow engine
- 不做 broad auto-write / auto-send / authority 扩面

## 风险项

- `typecheck` 仍会被 current-main 既有基线问题挡住：
  - `lib/connectors/google.ts`
  - `lib/notifications/system-mail.ts`
- `meeting-v2-runtime-card.tsx` 的单文件 `eslint` 仍有既有慢点；本阶段 diff 已人工复核
- 当前 contract stack 已经足够深，如果不在这里冻结，继续叠派生 summary 的收益会快速下降

## 必须继续诚实保留的边界

- 这仍然不是真实 read-only worker fan-out
- 这仍然不是真实 artifact bundle persistence
- 这仍然不是 verifier merge lane
- 这仍然不是 operator swarm dashboard / control plane
- 这仍然不是 broader authority plane
- recommendation / explanation 仍然不等于 commitment

## 当前基线 / sprint 目标是否清楚

清楚。

当前这条线的冻结目标是：

- 把 `SWARM-002` 当前 contract stack 冻成 current-main 可验证 truth
- 明确它仍然只是 read-only worker admission / preview / result-side seam truth
- 在进入真实 fan-out 之前，把 request / intent / placeholder / execution / materialization / adoption 的 bounded readout 先收干净

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

这一阶段没有把：

- read-only worker preview 写成 execution commitment
- result-side output 写成 customer-facing deliverable
- operator readout 写成自动 fan-out 承诺
- review-first boundary 写成 broader authority

## 验证

当前这轮 freeze 实际已验证：

```bash
ALLOW_DB_RESET=true npm run db:reset
npx vitest run lib/helm-v2/run-thread-contract.test.ts lib/helm-v2/operator-debugger-read-model.test.ts lib/helm-v2/runtime-upgrade.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
git diff --check
```

当前结果：

- 通过：
  - `db:reset`
  - 定向 `vitest`：`3 files / 88 tests` 全绿
  - `home-surface-routing.test.ts`
  - `shared-surface-hierarchy-guards.test.ts`
  - `self-check`
  - `check:boundaries`
  - `lint`
  - `git diff --check`
- 阻塞：
  - `typecheck` 仍被 current-main 既有依赖缺口挡住：
    - `lib/connectors/google.ts`
    - `lib/notifications/system-mail.ts`
  - `test` 仍被 current-main 既有依赖缺口挡住：
    - `lib/connectors/google.test.ts`
    - `lib/notifications/system-mail.test.ts`
  - `build` 与 `e2e` 仍被 current-main 既有 build blocker 挡住：
    - `google/system-mail` 依赖缺口
    - Next 16 / Turbopack 的 `next/dist/esm/*` 模块解析失败

因此，这条 freeze 当前只能诚实表述为：

- `SWARM-002` 自身 contract slice 已验证
- 整仓标准链未全绿，freeze verification 仍被仓库基线问题阻塞

## 下一阶段最该做的 5 件事

1. 先冻结 `SWARM-002` 当前 contract stack，不再继续堆新的派生 summary
2. 从最新 `main` 决定是否进入真实 read-only worker execution slice
3. 把真实 fan-out、bundle persistence、execution result 保持在同一条窄执行线里，不和 merge lane 混做
4. 把 verifier / arbiter merge lane 保持到独立切片，不混进 `SWARM-002`
5. 在宣称整仓标准链全绿之前，先处理 current-main 的 connector / mail type 基线问题
