---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Operator Queue Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005D read-only operator queue substrate implemented

## 1. 本轮目标

完成 `MEM-WRITE-005D`：在 `MEM-WRITE-005C` 的 diagnostics failure review readout 之上，增加一层只读 operator queue substrate，把 `MEETING_MEMORY_FACT_WRITE_FAILED` audit payload 转成可排序、可审查、可解释的人工处置项。

本轮仍不启动：

1. 自动 retry executor。
2. owner assignment、acknowledgement 或 workflow 执行队列。
3. 事务化 bulk upsert 或 DB-level unique guard。
4. canonical fact rewrite、auto-promotion 或 distillation runtime。
5. recommendation ranking owner、commitment authority 或 auto-send 扩面。

## 2. 本轮改动

代码：

- `lib/memory/write-failure-operator-queue.ts`
  - 新增 `buildMemoryWriteFailureOperatorQueue` pure builder。
  - 将 retryable / operator-review-required / non-retryable / malformed payload 分别映射到 `retry_manual_confirm`、`merge_conflict_review`、`source_data_repair`、`inspect_audit_payload`。
  - 所有 queue item 固定 `canAutoRetry: false`，并带边界说明，避免把候选项误读为执行授权。
  - 区分 `payloadStatus: valid / empty / malformed`，避免无效 JSON、空 payload 与缺失 `factWriteFailures` 被吞成同一个原因。
  - 暴露 `queueItemCount / visibleQueueItemCount / omittedQueueItemCount / itemLimit / hasMoreItems`，避免有上限截断时 operator 误判队列规模。
- `lib/observability/memory-metrics.service.ts`
  - `memoryWriteFailureReview` 增加 `operatorQueue`。
  - queue 与现有 failure review 共享 failure audit sample，但保持 read-only diagnostics 语义。
- `features/diagnostics/diagnostics-client.tsx`
  - diagnostics memory 区块新增 operator queue 概览、最近 queue item 和边界说明。
  - 展示 payload status、next action、retry readiness 和截断信息。
- `lib/memory/write-failure-operator-queue.test.ts`
  - 覆盖 retryable manual-confirm、conflict review、source repair、payload inspection、payload status 区分和 bounded item limit。
- `lib/observability/memory-metrics.test.ts`
  - 覆盖 observability overview 里 operator queue 的聚合口径与 no-auto-retry 边界。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_OPERATOR_QUEUE_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`
- `WORKING-CONTEXT.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| read-only queue substrate | failure audit sample 可转为 operator queue item |
| review posture mapping | retry、conflict、source repair、payload inspection 四类 posture 可见 |
| no-auto-retry boundary | queue item 只表示人工复核候选，不执行重试 |
| malformed payload visibility | malformed / empty / missing failures 不再混成同一个 fallback |
| bounded queue visibility | 总数、展示数、省略数和 item limit 同时可见 |
| diagnostics readout | operator queue 已接入 diagnostics memory 区块 |
| targeted tests | 新增 pure builder test，并扩展 observability test |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| retry contract | `MEM-WRITE-005E` 已补 bounded retry contract substrate；`MEM-WRITE-005F` 已补 receipt persistence 与 owner-aware review surface；真实 executor 和人工确认 workflow 仍待下一层 |
| owner workflow | `MEM-WRITE-005F` 已把 Meeting owner 投影到 receipt review surface；acknowledgement、SLA 与 resolution state 仍待下一层 |
| replay safety | 当前只提供 next action，不重建 source input 或执行 replay |
| DB-level idempotency | 仍不是 transaction upsert 或 unique guard |
| broader write lanes | commitment / blocker 仍未纳入同一 operator queue |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry | 当前 audit payload 不足以安全重建完整 `CreateFactInput`；自动执行需要 receipt、backoff、幂等锁与人工确认 |
| workflow queue | 本轮只做 diagnostics substrate，避免把 Mem 线扩成 orchestration platform |
| canonical fact rewrite | queue 只能提示人工处理路径，不改写已确认事实 |
| recommendation / commitment 扩权 | memory write failure visibility 不应改变 judgement / commitment authority |
| shared MySQL reset | 当前不对 shared `helm2026` 做破坏性验证 |

## 6. 风险项

1. queue 依赖最近 failure audit sample；窗口总数可见，但超出 sample 的每项 queue 仍不可见。
2. 旧 audit payload 如果没有 `factWriteFailures`，只能进入 payload inspection fallback。
3. `retry_manual_confirm` 只是人工确认候选；没有 executor 前仍需要 operator 另行处理 source 和目标对象。
4. diagnostics 信息密度继续升高，`MEM-WRITE-005F` 已先补 owner-aware receipt review readout；下一层应把 queue/receipt 迁到更明确的 operator workflow surface。
5. DB-level idempotency 仍未完成，写路径可靠性还没有达到完整生产恢复语义。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/write-failure-operator-queue.test.ts lib/observability/memory-metrics.test.ts
npm run typecheck
git diff --check
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
npm run test
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run eval:memory
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted operator queue tests | 通过 | 2 files / 7 tests，覆盖 queue builder 与 observability overview |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 unused-vars warnings |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run test` | 未全绿 | 230 / 236 test files、991 / 1006 tests 通过；15 个失败均为 Helm v2 runtime tests 连接不到本机 MySQL `127.0.0.1:3306` |
| `prisma validate` | 通过 | schema valid；保留既有 `relationMode = "prisma"` index warnings 与 Prisma config deprecation warning |
| `npm run eval:memory` | 通过 | 总体 3 / 3；既有 `duplicate_omission` category 仍为 0 / 3 |

未单独执行 `npm run db:reset` / `npm run e2e`：当前不对 shared MySQL dev database 做破坏性 reset，且本机默认 MySQL `127.0.0.1:3306` 当前不可达；Mem 线此前已用物理隔离的 `helm2026_ci_verify` 完成 migration / reset / seed proof。

## 8. 下一阶段最该做的 5 件事

1. 设计真实 retry executor / attempt ledger，但保持 review-first 和 no-auto-execute。
2. 为 malformed / missing failure payload 增加写入侧 guard 或 audit schema assertion。
3. 评估 `MemoryFact` normalized write key 的 DB-level unique guard 或 transaction upsert。
4. 将 commitment / blocker lane 纳入同一 write result 与 failure taxonomy。
5. 把 diagnostics 内的 queue/receipt readout 迁到更明确的 owner review workflow surface。
