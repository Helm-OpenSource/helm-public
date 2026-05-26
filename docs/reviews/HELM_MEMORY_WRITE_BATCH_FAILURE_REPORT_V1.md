---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Batch Failure Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005B batch failure semantics implemented; MEM-WRITE-005C readout added

## 1. 本轮目标

完成 `MEM-WRITE-005B`：在 `MEM-WRITE-005` normalized duplicate / conflict guard 之后，为 meeting `MemoryFact` 写入补第一层 batch result 与 failure classification，让写入失败不会静默成功，也不会继续生成 timeline / briefing 成功链路。

本轮仍不启动：

1. 自动 retry executor。
2. 事务化 bulk upsert 或 DB-level unique guard。
3. operator review UI / queue。
4. commitment / blocker lane 的新 batch failure semantics。
5. canonical fact rewrite、auto-promotion、distillation runtime。
6. recommendation ranking owner、commitment authority 或 auto-send 扩面。

## 2. 本轮改动

代码：

- `lib/memory/memory-fact.service.ts`
  - 新增 `MemoryFactBatchWriteResult`、`MemoryFactBatchWriteFailure` 与 `classifyMemoryFactWriteFailure`。
  - 新增 `createMemoryFactsWithWriteResult`，以 fail-fast batch result 返回 `complete / partial_failed / blocked`。
  - 将失败分成 `retryable`、`non_retryable`、`operator_review_required`。
  - 保留 `createMemoryFacts` 原有逐条抛错行为，避免影响其他调用方。
- `lib/memory/meeting-memory-pipeline.service.ts`
  - meeting pipeline 改用 `createMemoryFactsWithWriteResult`。
  - fact write failure 时写 `MEETING_MEMORY_FACT_WRITE_FAILED` audit / event metadata。
  - failure 后立即抛错，阻断后续 commitment / blocker / timeline / briefing 成功链路。
- `lib/memory/memory-fact-batch-write.test.ts`
  - 覆盖 batch success、fail-fast retryable、collect-all failure summary、unknown operator review、timeout / transaction conflict / missing record 分类。
- `lib/memory/meeting-memory-pipeline-write-failure.test.ts`
  - 覆盖 fact write failure 时写失败 audit，并确认不会继续写 commitment、blocker、timeline、briefing 或 meeting summary。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_DEDUPE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_BATCH_FAILURE_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| batch write result | `createMemoryFactsWithWriteResult` 返回 input / attempted / created / failed summary |
| failure classification | transient DB / timeout / transaction conflict 进入 retryable，object / validation 进入 non-retryable，unique conflict / unknown 进入 operator-review-required |
| fail-fast pipeline posture | meeting fact write failure 会终止后续 timeline / briefing 成功链路 |
| failure audit metadata | failure event 记录 `memoryWriteGuard`、`memoryWriteBatch`、duplicate suppression、conflict candidates 与 fact write failures |
| compatibility | 原 `createMemoryFacts` 仍保留逐条抛错行为，其他调用方不被强制改 contract |
| test coverage | 新增 pure batch tests 与 meeting pipeline failure-boundary test |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| retry execution | 当前只分类 retryable，不自动重试 |
| transaction / upsert | 当前是 fail-fast sequential guarded batch，不是 DB-level unique constraint 或 transaction upsert |
| operator review surface | 后续 `MEM-WRITE-005C` 已把 failure audit 接入 diagnostics 只读 readout；正式 operator queue 仍待下一层 |
| broader write lanes | commitment / blocker 仍未进入同一 batch failure result |
| staging migration proof | 新索引 migration 仍需在 staging / CI temp MySQL 上 apply 与 explain |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry | 需要独立 executor / backoff / idempotency receipt，不在本轮混入 |
| canonical fact rewrite | failure classification 只能阻断与提示，不改写已确认事实 |
| ranking / policy 改写 | memory write result 不参与 recommendation ranking 或 policy owner |
| broad auto-write | 本轮只处理 meeting `MemoryFact` lane |
| shared MySQL reset | 当前 datasource 指向 shared `helm2026`，不能默认 reset |

## 6. 风险项

1. partial failure 时可能已有前序 facts 写入成功；当前会阻断后续链路并记录 `partial_failed`，但还没有补偿 / rollback。
2. retryable 只被分类并可在 diagnostics 读到，不自动执行重试；operator 仍需要后续 executor 或脚本承接。
3. operator-review-required 已可在 diagnostics 复盘，但仍未进入正式 review queue。
4. 没有 DB-level unique constraint 时，并发双写 race 仍需后续治理。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/memory-fact-batch-write.test.ts lib/memory/meeting-memory-pipeline-write-failure.test.ts lib/memory/write-dedupe.test.ts lib/memory/retrieval-pack-adapter.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run eval:recommendation
npm run typecheck
npm run lint
npm run test
npm run build
npm run quality:regression
npm run e2e
git diff --check
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted memory tests | 通过 | 6 files / 18 tests |
| `prisma validate` | 通过 | schema valid；保留既有 `relationMode = "prisma"` index warnings 与 Prisma config deprecation warning |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | 总体 3 / 3；既有 `duplicate_omission` category 仍为 0 / 3 |
| `npm run eval:recommendation` | 未通过 | 0 / 4；失败集中在既有 `decisionRole / decisionLabel` 与部分 supporting evidence 断言 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 warnings |
| `npm run test` | 未全绿 | 229 / 235 test files、987 / 1002 tests 通过；剩余 15 个失败均为 Helm v2 runtime DB tests 无法连接默认本地 `127.0.0.1:3306` |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run e2e` | 阻断 | 脚本缺少 create database 权限后 fallback 到 `db:reset`，但当前 datasource 指向 shared `helm2026`，仓库 reset guard 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

未单独执行 `npm run db:reset`：当前 datasource 是 shared MySQL dev database，本轮不对共享库做破坏性 reset。

## 8. 下一阶段最该做的 5 件事

1. 为 retryable failure 增加 bounded retry executor / backoff / receipt。
2. 为 operator-review-required failure 增加正式 operator queue / owner assignment，而不是只停留在 diagnostics。
3. 评估 `MemoryFact` normalized write key 是否需要 DB-level unique guard 或 transaction upsert。
4. 将 commitment / blocker lane 纳入同一 write result 口径。
5. 在 staging / CI temp MySQL 上 apply MEM-QUERY-003 与 MEM-WRITE-005 migrations，并补 explain / lock 风险记录。
