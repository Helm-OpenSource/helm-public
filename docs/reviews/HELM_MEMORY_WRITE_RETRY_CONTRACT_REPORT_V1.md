---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Retry Contract Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005E bounded retry contract substrate implemented

## 1. 本轮目标

完成 `MEM-WRITE-005E`：在 `MEM-WRITE-005D` 的 read-only operator queue substrate 之上，增加 bounded retry executor 的前置 contract。该 contract 只生成人工确认前的 retry plan、receipt draft、backoff policy 和 idempotency lock key，不执行 retry，不写数据库，不改变 canonical facts。

本轮仍不启动：

1. 自动 retry executor。
2. retry API、operator acknowledgement write path 或 owner assignment workflow。
3. 真实 idempotency lock table / DB-level unique guard。
4. canonical fact rewrite、auto-promotion 或 distillation runtime。
5. recommendation ranking owner、commitment authority 或 auto-send 扩面。

## 2. 本轮改动

代码：

- `lib/memory/write-failure-retry-contract.ts`
  - 新增 `buildMemoryWriteRetryContract` pure builder。
  - 以 operator queue item 为输入，输出 `manual_confirmation_required / blocked_missing_retry_payload / blocked_conflict_review_required / blocked_non_retryable / blocked_payload_inspection_required`。
  - 为可进入人工确认的 retry candidate 生成 deterministic `idempotencyLockKey`，当前使用 object/source/fact/title 的可用语义身份与 hash，不使用 audit id，避免同 audit 内不同失败事实误合并，也能对跨 audit 同语义候选保持一致；并固定 attempt limit = 3、backoff delays = `0 / 5 / 15` minutes。
  - 每个 item 都生成 `receiptDraft`，但 receipt status 只允许 `plan_only_pending_manual_confirmation` 或 `blocked`。
  - 所有 item 固定 `canExecuteAutomatically: false`，并要求人工重建 fact content、确认 workspace/object/source、检查 duplicate/conflict、写入 retry receipt 后才允许进入未来 executor。
- `lib/observability/memory-metrics.service.ts`
  - `memoryWriteFailureReview` 增加 `retryContract`，与 operator queue 共享 bounded sample。
- `features/diagnostics/diagnostics-client.tsx`
  - diagnostics memory 区块新增 retry contract 概览、最近 contract item 和边界说明。
- `lib/memory/write-failure-retry-contract.test.ts`
  - 覆盖 manual-confirm receipt draft、conflict/non-retryable/payload inspection blocking、缺 idempotency scope blocking。
- `lib/observability/memory-metrics.test.ts`
  - 覆盖 retry contract summary 与 no-auto-execute boundary。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_RETRY_CONTRACT_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`
- `WORKING-CONTEXT.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| retry contract substrate | queue item 可转为 bounded retry plan |
| receipt draft | 每个 item 有 receipt version、status、source audit、queue item、attempt limit 和 backoff policy |
| idempotency lock key | 具备 object/source/fact/title scope 的 retry candidate 会得到 deterministic lock key |
| manual confirmation gate | 所有可 retry 项必须人工确认，不能自动执行 |
| blocked posture | conflict、non-retryable、payload inspection、缺 retry payload 会被显式阻断 |
| diagnostics readout | retry contract 已进入 diagnostics memory 区块 |
| targeted tests | 新增 pure builder test，并扩展 observability test |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| retry executor | `MEM-WRITE-005F` 已补 receipt persistence 与 owner-aware review surface；真实 executor、DB-level idempotency lock、backoff scheduler 和 operator acknowledgement 仍待下一层 |
| idempotency lock | 当前只是 deterministic key，不是 DB-level lock |
| source rebuild | 当前只要求人工重建 fact content，不自动从 source 重建完整 `CreateFactInput` |
| owner workflow | `MEM-WRITE-005F` 已把 Meeting owner 显示到 receipt review surface；SLA、acknowledgement 与 resolution state 仍待下一层 |
| broader write lanes | commitment / blocker 仍未纳入同一 retry contract |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry | failure audit 不保存完整 `content / actor context / normalizedValue`，不能安全直接重放 |
| retry API | 没有 receipt persistence 与 idempotency lock 前，暴露 API 会制造误执行入口 |
| DB lock / unique guard | 本轮只冻结 contract，避免把 schema migration 混入 retry contract slice |
| canonical fact rewrite | retry contract 只为失败写入提供人工处置路径，不改写已确认事实 |
| recommendation / commitment 扩权 | retry contract 不能改变 judgement / commitment authority |

## 6. 风险项

1. retry contract 基于 operator queue visible sample；超出 queue item limit 的失败不会进入本轮 contract readout。
2. idempotency lock key 当前只是计划字段，不具备真实并发互斥能力；content hash 仍需等 source rebuild 后进入 receipt persistence。
3. `manual_confirmation_required` 仍缺完整 `CreateFactInput`，未来 executor 必须先重建和确认 content。
4. `MEM-WRITE-005F` 已把 receipt persistence 和 owner-aware review surface 接到 diagnostics；下一层应继续迁到更正式的 operator review workflow，而不是在 diagnostics 继续堆执行入口。
5. DB-level idempotency、transaction upsert 与 commitment / blocker lane 仍未完成。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/write-failure-retry-contract.test.ts lib/memory/write-failure-operator-queue.test.ts lib/observability/memory-metrics.test.ts
npm run typecheck
git diff --check
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted retry contract tests | 通过 | 3 files / 11 tests，覆盖 retry contract、operator queue 与 observability overview |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 unused-vars warnings |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |

reviewer subagent 复核：

- 未发现自动 retry、DB write、canonical fact rewrite、recommendation ranking owner 或 commitment authority 扩张路径。
- 指出 idempotency key 不能用 auditId 作为主要身份；已修正为 object/source/fact/title 的可用语义身份 + hash，并补同 audit 不同 title、跨 audit 同 title 的测试。

未单独执行 `npm run db:reset` / `npm run e2e` / full `npm run test`：当前不对 shared MySQL dev database 做破坏性 reset，且本机默认 MySQL `127.0.0.1:3306` 在上一轮全量测试中不可达；Mem 线此前已用物理隔离的 `helm2026_ci_verify` 完成 migration / reset / seed proof。

## 8. 下一阶段最该做的 5 件事

`MEM-WRITE-005F` follow-through：retry receipt persistence 与 owner-aware operator review surface 已落地为 `AuditLog` receipt ledger + diagnostics readout。它仍然只是 receipt/review only, not executor。

1. 设计真实 idempotency lock / attempt ledger。
2. 为 source rebuild 增加安全的 `CreateFactInput` reconstruction gate。
3. 设计 review-first bounded retry executor，不允许自动执行或扩权。
4. 将 commitment / blocker lane 纳入同一 write result 与 retry contract。
5. 将 diagnostics readout 迁到更正式的 owner review workflow / operator surface。
