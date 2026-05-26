---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Run-Thread Persisted Control-Plane Lifecycle Freeze Report V1

## 结论

`run-thread persisted control-plane lifecycle` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- `RuntimeSession.controlPlaneLifecycleJson / controlPlaneLifecycleUpdatedAt` 已经能稳定保存 bounded thread-level control-plane snapshot
- persisted lifecycle 的 `compaction / reconciliation / repair / guard` policy 已经进入统一 contract，并真实接入 runtime persist helper
- persisted lifecycle 与 debugger `trace / replay / checkpoint` contract、以及 replay/recovery write path 已经进入第一层统一
- 但这仍然不是完整 persisted control-plane engine，也不是 replay/recovery execution plane

## 已经完整成立

- `runThread.persistedControlPlaneLifecycle` 已经显式给出 `missing / synced / drifted / invalid`，并把单槽 persisted snapshot 的对齐状态稳定投影到 trace、checkpoint resume、continuity queue、meeting runtime surface 与 `/operating`
- persisted snapshot 的 `compactionPolicy / reconciliationPolicy / repairPolicy / guardPolicy` 已明确成立，并固定为 `replace_on_material_state_change`、`bounded_snapshot_with_event_truth_fallback` 与 `review_first_single_slot_rewrite_only`
- runtime persist helper 已不再绕过 contract 自己判断，而是按同一份 guard policy 明确执行 `fallback_to_event_truth / backfill_required / rewrite_required / reuse_current_snapshot / reuse_compacted_snapshot`
- persisted snapshot 已把 `resumeState / latestCheckpoint / checkpointLineageDepth / replayRequest / replayEventLogEntries / humanInputCheckpoint` 收成 material state
- persisted snapshot 也已经把 `lastRefreshReason / lastRefreshSource / writeAnchor / writeCheckpointKey / writeResumeToken` 持久化下来，并通过 `persistedControlPlaneLifecycle.writeSide` 与 `debugger.persistedLifecycleTrace` 暴露给 operator
- persisted lifecycle 与 replay/recovery write path 已进入第一层统一：`control_event / meeting_ingest / continuity_checkpoint / verification_review / context_edit / checkpoint_resume` 这些 bounded write path 现在都会显式写入 refresh reason
- login / demo / workspace 首屏 hydration contract 已补齐，`data-workspace-*` 不再完全依赖 client effect
- README、docs index、PLANS、自检、boundary guard 和回归测试已经同步

## 已成形但仍需下一层

- 当前 persisted lifecycle 仍然只是 bounded single-slot snapshot，不是完整 persisted control plane
- 当前 persisted lifecycle 与 debugger `trace / replay / checkpoint` 的统一仍主要是第一层 contract/read seam，还不是完整 replay/recovery engine
- 当前 write-side contract 已能持久化 refresh reason 与 recovery anchor，但还没有进入更明确的 replay/recovery execution lifecycle
- 当前 compaction/reconciliation/repair policy 已能决定 reuse 或 rewrite，但还没有独立的 compactor/reconciler control plane

## 刻意未做

- 不做新的 persisted control-plane table
- 不做 workflow engine
- 不做 replay engine
- 不做 broader execution authority
- 不把这一层包装成完整 orchestration platform

## 风险项

- 如果未来继续扩 write path 但漏接 refresh reason 或 write-side anchor，persisted snapshot 仍可能进入 `drifted`
- 当前 persisted lifecycle 仍依赖 event-derived canonical truth；一旦 event truth 自身出现缺口，persisted snapshot 只能 fallback，不能自行修复为完整 engine
- [`next.config.ts`](/Users/tommyqian/Documents/GitHub/helm2026/next.config.ts) 仍有既有的 Turbopack/NFT tracing warning；这不是本阶段引入的新失败

## 必须继续诚实保留的边界

- 这仍然不是完整 persisted control-plane engine
- 这仍然不是 replay/recovery engine
- 这仍然不是 workflow engine
- 这仍然不是 broader execution authority plane
- 当前主动机制仍默认以 `建议 / 准备 / 升级 / review-first` 为主，不默认拥有高风险自动承诺和高风险自动发送权限

## 当前基线 / sprint 目标是否清楚

清楚。

当前这条子线的收口目标是：

- 把 persisted lifecycle 的 bounded snapshot、policy、debugger trace seam 和 replay/recovery write-side contract 冻成 current-main truth
- 再把 README / docs index / self-check / regression 入口同步到同一版 discoverability
- 继续明确这仍然只是 persisted lifecycle 的下一层，不是完整 control-plane engine

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

这一阶段没有把：

- recommendation 写成 commitment
- replay/recovery control contract 写成自动执行承诺
- runtime trace / persisted lifecycle surface 写成客户承诺面

## 验证

完整标准链通过：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

定向测试通过：

```bash
npx vitest run \
  lib/helm-v2/run-thread-persisted-control-plane-lifecycle.test.ts \
  lib/helm-v2/run-thread-contract.test.ts \
  lib/helm-v2/operator-debugger-read-model.test.ts \
  lib/helm-v2/runtime-upgrade.test.ts
```

## 下一阶段最该做的 5 件事

1. 把 persisted lifecycle 再往前推进到更明确的 replay/recovery execution lifecycle，而不是继续只加 read summary。
2. 把 persisted lifecycle 与 debugger `trace / replay / checkpoint / human input` 继续收成更稳定的 operator debugger contract。
3. 把 compaction/reconciliation/repair policy 从当前 bounded helper 再推进到更明确的 compactor/reconciler guard policy。
4. 继续收紧 persisted lifecycle 的 write-side drift guard，避免后续 write path 扩面时漏接 refresh reason。
5. 在不扩 authority 的前提下，为 replay/recovery write-side contract 增加更清楚的 repair/closeout boundary。
