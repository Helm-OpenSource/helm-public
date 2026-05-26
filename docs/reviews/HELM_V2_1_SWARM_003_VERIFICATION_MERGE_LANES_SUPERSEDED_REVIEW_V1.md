---
status: active
owner: helm-core
created: 2026-04-24
review_after: 2026-07-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v2.1 SWARM-003 Verification Merge Lanes Superseded Review V1

## 结论

对 `origin/codex/swarm-003-verification-merge-lanes` 上仍未进入 `origin/main` 的 10 个提交逐个复核后，当前判断是：

1. 功能主体已经被 `main` 上的 `SWARM-003 / SWARM-004 / SWARM-005 / SWARM-006 / SWARM-007 / SWARM-008` 窄切片和分流边界覆盖；其中 `SWARM-005` 继续只拥有 candidate-only consolidation，不吸收这 10 个提交里的旧 control / adjacency helper。
2. 旧分支里的 helper、UI surface 和 docs wording 不应整提交 cherry-pick，否则会重新引入已经被 re-baseline 收窄掉的 `SWARM-004A/004B/004C/004D/004E/004F` 风格扩散。
3. 唯一保留的最小必要内容，是旧分支里对 `truthConflicts` 和 cache telemetry 的 defensive read hardening；它不改变权限、状态机或产品面，只降低 optional relation / empty telemetry 在 runtime read path 上造成异常的风险。

## 审查范围

本轮审查范围是以下 10 个提交：

| Commit | 标题 | 处理结论 |
| --- | --- | --- |
| `154f08a53` | `feat: add swarm verification merge lanes` | 部分保留。主功能已由当前 `runThread.swarmVerificationMergeLaneContract`、meeting action、meeting runtime surface、`/operating` readout 和测试覆盖；仅保留 defensive `truthConflicts` / cache telemetry hardening。 |
| `67170d31` | `feat: add swarm read-only control summary` | Superseded。旧 `swarm-control-summary` 被当前 `SWARM-004` 的 `/operating`-only `swarm-operator-control-surface` 和后续 operator summary 链替代。 |
| `8db039b6` | `feat: add swarm fallback request seam` | Superseded。fallback 现在按 `SWARM-004` 明确桥接到 bounded operator takeover lifecycle，不再使用旧 summary helper。 |
| `bc697436` | `feat: add swarm takeover lifecycle surface parity` | Superseded。takeover lifecycle parity 已被 `SWARM-007` 的 `takeover-remediation-handoff-readout` 覆盖。 |
| `428d33a4` | `feat: add shared continuity remediation handoff` | Superseded。旧独立 remediation handoff 被 `SWARM-007` 的 takeover / remediation shared readout 合并覆盖。 |
| `0984d2a9` | `feat: add shared close request handoff` | Superseded。close request readout 已进入 `SWARM-008` 的 `close-settlement-handoff-readout`。 |
| `2eb815ca` | `feat: add shared settlement review handoff` | Superseded。settlement review readout 已进入 `SWARM-008` 的 `close-settlement-handoff-readout`。 |
| `ff386bb4` | `feat: add shared handoff focus links` | Superseded。focus-link hardening 已由 `SWARM-008` 对 settlement review / closeout confirmation / closeout refresh / close request 的 focus selection 覆盖。 |
| `fa99bdec` | `feat: add persisted lifecycle trace readout` | Superseded。persisted trace compact / reference / provenance / integrity readout 已由 `SWARM-006` 当前 helper 覆盖。 |
| `f4f64d40` | `feat: add persisted lifecycle trace provenance readout` | Superseded。provenance / integrity readout 已由 `SWARM-006` 覆盖；旧分支的 persisted-trace-specific focus href 不保留，以免扩大当前 closeout 后的 scope。 |

## Cherry-pick 结果

本轮没有整提交 cherry-pick。实际落地为从 `154f08a53` 中手工挑出最小防御性差异：

1. `buildRuntimeCacheHealth()` 接受 `null / undefined`，内部归一为空数组。
2. runtime read / prune / resume / remediation / trace / meeting summary 路径中的 `truthConflicts` 读取统一使用 `?? []`。

这些改动保持以下边界：

1. 不新增 action。
2. 不新增 persistence。
3. 不改变 `SWARM-004 / 006 / 007 / 008` 的 owner 分流。
4. 不恢复旧 `SWARM-004A+` suffix train。
5. 不把 persisted trace / takeover / close / settlement adjacency 重新塞回 `SWARM-003`。

## 剩余风险

1. 本轮复核基于本地已有 `origin/main` / `origin/codex/swarm-003-verification-merge-lanes` 引用；如果远端分支之后又移动，需要重新 fetch 后复核。
2. defensive hardening 降低空 relation 风险，但不替代完整 DB-backed runtime e2e。
3. 旧分支的 persisted trace focus href 被刻意不保留；如果未来确实需要 persisted-trace-specific deep link，应作为新的 narrow read-only navigation backlog，而不是从 superseded branch 回灌。

## 验证建议

本轮最小验证：

```bash
npx vitest run lib/helm-v2/runtime-upgrade.test.ts
npm run self-check
npm run check:boundaries
npm run typecheck
git diff --check
```
