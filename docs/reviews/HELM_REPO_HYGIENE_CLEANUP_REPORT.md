---
status: archived
owner: helm-core
created: 2026-04-06
review_after: 2026-10-03
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Repo Hygiene Cleanup Report

更新时间：2026-04-05
状态：Completed
范围：restore head validation chain to green under current-main truth

## 1. 结论

当前 head 的主验证链已经恢复到可通过状态。

本轮不是功能开发，而是一次 repo hygiene cleanup：

1. 恢复 current-main truth drift
2. 清理生成产物冲突
3. 把仓库重新拉回可验证、可交付状态

## 2. 目标

按仓库 `AGENTS.md` 的 Done 定义，修复以下链路：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

并生成一份可归档的 cleanup report。

## 3. 根因拆解

### 已经完整定位

1. `README.md` 与 `docs/README.md` 删除了 Helm v2.1 / v2.2 runtime hardening、verified coordination、budgeted continuity、continuity stable closeout 相关真值入口，导致：
   - `self-check` 大面积失败
   - `check:boundaries` 缺少关键边界文案
2. `package.json` 删除了 `eval:helm-v2-1-*` 与 `eval:helm-v2-2-*` 的脚本入口，导致 discoverability 自检失败。
3. `prisma/schema.prisma` 删除了 Helm v2.1 runtime substrate 的枚举、`Workspace` relation 和 runtime models，导致 schema 与 current-main truth 失配。
4. `.next/types` 存在重复生成文件：
   - `routes.d 2.ts`
   - `validator 2.ts`
   导致 `typecheck` 重复声明失败。

### 已成形但仍需下一层

- 当前仓库仍有一些本地未提交的无关文件和技能目录，不属于本轮 cleanup 范围。

### 刻意未做

- 不顺手扩功能
- 不做结构重构
- 不改路线图
- 不把 cleanup 扩成新的产品 / runtime sprint

### 风险项

- 这次修复的是 current-main truth drift；如果后续继续手动删除 README / docs index / schema 的 freeze 真值，验证链会再次回红。

## 4. 修复内容

### 4.1 文档与索引真值恢复

恢复了 `README.md` 和 `docs/README.md` 中被删掉的 Helm v2.1 / v2.2 continuity 与 runtime hardening 入口，重新对齐：

- runtime hardening
- verified coordination
- budgeted session continuity
- continuity diagnostics
- v2.2 continuity observability / calibration / remediation / pilot review / stable closeout

同时补回了边界守卫所需的关键表达，例如：

- `autonomous commitment`
- `source-consistent brief`

### 4.2 Eval discoverability 恢复

恢复了 `package.json` 中被删掉的 eval scripts，包括：

- `eval:helm-v2-1-phase1` 到 `eval:helm-v2-1-phase6`
- `eval:helm-v2-1-budgeted-session-continuity`
- `eval:helm-v2-2-phase1` 到 `eval:helm-v2-2-phase21`
- 以及所有 v2.2 continuity named aliases

### 4.3 Prisma runtime substrate 恢复

恢复了 `prisma/schema.prisma` 中被删掉的 Helm v2.1 runtime substrate：

- 枚举：
  - `RuntimeSessionStatus`
  - `RuntimeCheckpointStatus`
  - `RuntimeMemoryCandidateStatus`
  - `RuntimeMemoryPromotionStatus`
  - `VerificationReportStatus`
  - `TruthConflictStatus`
  - `ProblemSpaceStatus`
  - `EdgeBriefAudience`
  - `CompositionFailureClass`
  - `ConsolidationJobStatus`
  - `InitiativeRunStatus`
- `Workspace` relation fields
- runtime models：
  - `RuntimeSession`
  - `PersistedPayload`
  - `ContextEditEvent`
  - `SessionNotebook`
  - `SessionCheckpoint`
  - `MemoryCandidate`
  - `MemoryPromotion`
  - `VerificationReport`
  - `SignalEvent`
  - `TruthConflict`
  - `WorldModelSnapshot`
  - `ProblemSpace`
  - `DriAssignment`
  - `EdgeBrief`
  - `CompositionFailure`
  - `CapabilityCatalogEntry`
  - `PromptCacheTelemetry`
  - `ArtifactVersion`
  - `ConsolidationJob`
  - `HandoffPacket`
  - `InitiativeRun`
  - `CoordinationMetricsDaily`

### 4.4 生成产物冲突清理

删除了重复生成的 `.next/types` 文件，消除了 `typecheck` 的重复声明冲突。

## 5. 验证结果

本轮按用户指定链路重新验证，结果如下：

- `npm run db:reset`：PASS
- `npm run self-check`：PASS
- `npm run check:boundaries`：PASS
- `npm run typecheck`：PASS
- `npm run lint`：PASS
- `npm run test`：PASS
- `npm run build`：PASS

说明：

- 这次按任务要求停在 `build`
- `e2e` 和 `quality:regression` 没有作为本轮强制链路执行

## 6. 受影响组件

- `README.md`
- `docs/README.md`
- `package.json`
- `prisma/schema.prisma`
- `.next/types/*`

## 7. 边界保持情况

本轮没有改变以下边界：

- `workspace-first`
- `controlled-trial`
- `judgement-first`
- `recommendation != commitment`
- `no auto-send`
- `no broad auto-write`
- `no execution-authority expansion`

## 8. 剩余风险

1. `prisma` 仍有非阻塞 deprecation 提示：`package.json#prisma` 后续应迁到 `prisma.config.ts`
2. `lib/helm-v2/runtime-upgrade.ts` 仍有 Babel large-file deopt note
3. 如果后续继续手动删改 freeze docs / docs index / schema，而不同时更新 guard，自检仍会再次回红

## 9. 下一步建议

1. 把这次 cleanup 视为一次 hygiene baseline，而不是功能 sprint
2. 后续任何大改动前先跑最少链路：
   - `self-check`
   - `check:boundaries`
   - `typecheck`
3. 涉及 README / docs index / schema 的改动，默认同时检查 guard，不要只改一层
