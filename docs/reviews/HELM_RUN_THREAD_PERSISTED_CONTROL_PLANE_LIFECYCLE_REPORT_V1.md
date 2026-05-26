---
status: archived
owner: helm-core
created: 2026-04-13
review_after: 2026-10-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Run-Thread Persisted Control-Plane Lifecycle Report V1

## 结论

这一层已经成立：

- `RuntimeSession.controlPlaneLifecycleJson / controlPlaneLifecycleUpdatedAt` 现在会保存一份 bounded thread-level control-plane snapshot。
- `runThread.persistedControlPlaneLifecycle` 现在会显式给出 `missing / synced / drifted / invalid`。
- `trace / checkpoint resume / continuity queue / meeting runtime surface / /operating` 现在都能直接读到 persisted snapshot 是否与 event-derived canonical truth 对齐。
- `login / demo / workspace` 首屏现在会通过 root boot script 同步写入 `data-workspace-*` 属性，避免首屏 hydration 完全依赖 client effect。

按 Helm 的统一分级，这一层当前应落为：`已成形但仍需下一层`。

当前这一子线的阶段冻结报告见 [`HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_FREEZE_REPORT_V1.md`](./HELM_RUN_THREAD_PERSISTED_CONTROL_PLANE_LIFECYCLE_FREEZE_REPORT_V1.md)。

## 已经完整成立

- persisted lifecycle snapshot 的 schema、parse、diff、guard/repair policy 和 runtime contract 已经明确。
- `RuntimeSession` 的持久化字段和 migration 已经落地。
- persisted lifecycle refresh 已经接入 runtime control-plane 相关 write path。
- continuity queue、trace、resume、meeting runtime surface、`/operating` 已经接到同一份 persisted lifecycle read seam。
- persisted lifecycle 与 operator debugger 的 `trace / replay / checkpoint` contract 已进入第一层：`debugger.persistedLifecycleTrace` 现在会显式给出 `backfill_required / fallback_to_event_truth / refresh_required / aligned`，并把当前 anchor 收成 `checkpoint / replay / human_input / none`；persisted snapshot 本身也已经把 `resumeState / latestCheckpoint / checkpointLineageDepth / replayRequest / replayEventLogEntries / humanInputCheckpoint` 收成 material state。
- persisted lifecycle 的 compactor/reconciler guard policy 已进入第一层执行面：`guardPolicy` 现在会显式给出 `fallback_to_event_truth / backfill_required / rewrite_required / reuse_current_snapshot / reuse_compacted_snapshot`，并且 `persistRuntimeSessionControlPlaneLifecycleSnapshot()` 已经按同一份 policy 做 reuse 或 rewrite，而不是继续绕过 read contract 自己判断。
- persisted lifecycle 与 replay/recovery write path 的更深一层 contract 也已进入第一层：单槽 snapshot 现在会额外记录 `lastRefreshReason / lastRefreshSource / writeAnchor / writeCheckpointKey / writeResumeToken`，并通过 `persistedControlPlaneLifecycle.writeSide` 与 `debugger.persistedLifecycleTrace.writeSideState` 显式告诉 operator 这次 persisted refresh 到底是 `control_event / continuity_checkpoint / checkpoint_resume / context_edit / verification_review / meeting_ingest` 里的哪一类，以及当前持久化的是 `thread_truth / checkpoint / resume / replay / human_input` 哪一种 recovery anchor；runtime persist helper 也会把这个 write-side context 纳入 reuse/rewrite 决策，不再只看 material drift。
- README、docs index、plan、自检、boundary guard 和回归测试已经同步。

## 已成形但仍需下一层

- 当前 persisted snapshot 仍然只是 bounded thread-level state，不是完整 persisted control plane。
- persisted lifecycle compaction / reconciliation policy 已经进入第一层：单槽 persisted snapshot 现在固定采用 `replace_on_material_state_change`，并把对齐语义固定为 `bounded_snapshot_with_event_truth_fallback`；同时 guard/repair policy 也已经进入第一层：repair 边界现在固定为 `review_first_single_slot_rewrite_only`，只允许在安全 refresh 上做 backfill 或 rewrite；persisted snapshot 也已经开始把 replay/recovery write-side context 一起持久化，但这仍然只是 bounded snapshot policy，不是完整 replay / recovery engine。
- 还没有统一的 persisted lifecycle replay / recovery engine。
- persisted lifecycle 与 operator debugger trace/replay/checkpoint contract 现在虽然已经开始共享 persisted recovery anchor，但仍只完成了第一层 read seam，还没有进入更完整的 replay/recovery engine。

## 刻意未做

- 不做新的 workflow engine。
- 不做新的 execution authority。
- 不引入新的 persisted control-plane table。
- 不把这一层包装成完整 orchestration platform。

## 风险项

- 如果未来 write path 扩面但忘记补 refresh，persisted snapshot 仍可能进入 `drifted`。
- `next build` 仍会打印既有的 Turbopack/NFT tracing warning；这不是本层引入的新失败。
- 本地依赖树偶发会残留 `node_modules/@types/* 2` 之类重复副本；这次已清理，它属于环境噪音，不是 persisted lifecycle 逻辑错误。

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
  lib/helm-v2/runtime-upgrade.test.ts
```

## 下一层建议

1. 把 persisted lifecycle 继续往 replay/recovery write path 收紧，让 bounded snapshot refresh、repair policy 和 recovery write seam 共用更明确的控制面语义。
2. 把 persisted lifecycle 再往前推进到更明确的 compaction / reconciliation compactor / recovery policy，而不扩大成 workflow engine。
3. 把 persisted lifecycle debugger seam 继续往 replay/recovery repair policy 收紧，但不扩成 workflow engine。
