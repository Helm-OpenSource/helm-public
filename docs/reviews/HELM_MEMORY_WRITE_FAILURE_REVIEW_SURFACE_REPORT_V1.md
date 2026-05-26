---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Failure Review Surface Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005C failure review diagnostics readout implemented

## 1. 本轮目标

完成 `MEM-WRITE-005C`：在 `MEM-WRITE-005B` 已经写入 `MEETING_MEMORY_FACT_WRITE_FAILED` audit / event metadata 之后，把失败批次接到 diagnostics 只读复盘读面，让 operator 能看到失败类别、原因、blocked / partial-failed batch posture、retryable 候选与 operator-review-required 数量。

本轮仍不启动：

1. 自动 retry executor。
2. 正式 operator queue / owner assignment。
3. 事务化 bulk upsert 或 DB-level unique guard。
4. canonical fact rewrite、auto-promotion 或 distillation runtime。
5. recommendation ranking owner、commitment authority 或 auto-send 扩面。

## 2. 本轮改动

代码：

- `lib/observability/memory-metrics.service.ts`
  - 新增 `buildMemoryWriteFailureReviewOverview`，从 `MEETING_MEMORY_FACT_WRITE_FAILED` audit payload 聚合写入失败复盘口径。
  - 输出窗口内 `failureEventCount`，并用最近 50 条 audit sample 计算 blocked / partial-failed batch count、retryable / non-retryable / operator-review-required count、duplicate suppression / conflict candidate count、failure class / reason breakdown 和 recent batch refs。
  - 明确 `boundaryNote`：该读面只读，不自动 retry，不改写 canonical facts，不改变 recommendation / commitment authority。
- `features/diagnostics/diagnostics-client.tsx`
  - diagnostics 的 LLM / ASR / memory 区块新增 fact write failures、blocked write batches、manual retry candidates、operator review writes 指标。
  - 新增 write failure review、failure classes、failure reasons、recent write failure batches 只读列表。
- `lib/observability/memory-metrics.test.ts`
  - 覆盖 failure audit 聚合、fallback count、review posture 与 no-auto-retry boundary note。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_DEDUPE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_BATCH_FAILURE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_FAILURE_REVIEW_SURFACE_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| failure audit readout | diagnostics 会读取 `MEETING_MEMORY_FACT_WRITE_FAILED` audit payload 并输出复盘 |
| window count + recent sample | failure event total 使用窗口内 count，细分 breakdown 明确来自最近 50 条 sample |
| batch posture visibility | blocked / partial-failed batch 与 fail-fast / collect-all policy 在 recent sample 内可见 |
| failure taxonomy visibility | retryable / non-retryable / operator-review-required 以及 class / reason breakdown 在 recent sample 内可见 |
| dedupe conflict context | duplicate suppression 与 conflict candidate count 会随失败批次进入 recent sample 复盘 |
| read-only boundary | readout 不触发 retry、rewrite、commitment、recommendation ranking 或 external send |
| targeted test | 新增 pure observability test 覆盖聚合与边界文案 |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| manual retry handling | 当前只展示 retryable 候选，不执行重试 |
| formal operator queue | 当前是 diagnostics readout，不是 owner-assigned queue |
| compensation / rollback | partial-failed 只可见，不自动补偿前序成功写入 |
| DB-level idempotency | 仍不是 unique constraint / transaction upsert |
| broader write lanes | commitment / blocker 仍未进入同一 batch failure result |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry | 需要 executor、backoff、idempotency receipt 与 operator acknowledgement，不应混入 diagnostics readout |
| operator queue | 本轮只处理读面，避免把 diagnostics 扩成 workflow / orchestration 平面 |
| canonical fact rewrite | failure review 只能帮助判断，不改写已确认事实 |
| recommendation / commitment 扩权 | write failure visibility 不应改变 judgement / commitment authority |
| shared MySQL reset | 当前 datasource 指向 shared `helm2026`，不能默认 reset |

## 6. 风险项

1. readout 依赖 `MEETING_MEMORY_FACT_WRITE_FAILED` audit payload；历史失败如果没有按 `MEM-WRITE-005B` 结构写入，只能显示 `unknown` fallback。
2. breakdown 当前基于最近 50 条 failure audit sample；窗口总数可见，但全量 class / reason breakdown 需要后续 aggregate table 或 payload summary。
3. partial-failed batch 的前序成功写入不会自动补偿；operator 需要后续 queue / runbook 承接。
4. retryable failure 只是候选信号；没有 executor 时仍需人工决定是否重试。
5. diagnostics 信息密度继续上升，后续正式 queue 需要把 owner / next action 单独收口。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/observability/memory-metrics.test.ts lib/memory/memory-fact-batch-write.test.ts lib/memory/meeting-memory-pipeline-write-failure.test.ts lib/memory/write-dedupe.test.ts lib/memory/retrieval-pack-adapter.test.ts lib/evals/memory-evals.test.ts
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
npm run self-check
npm run check:boundaries
npm run eval:memory
npm run eval:recommendation
npm run test -- lib/observability/memory-metrics.test.ts
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
| targeted memory tests | 通过 | 6 files / 19 tests，覆盖 write failure readout、batch failure、pipeline failure boundary、dedupe、retrieval pack 与 memory eval helper |
| `prisma validate` | 通过 | schema valid；保留既有 `relationMode = "prisma"` index warnings 与 Prisma config deprecation warning |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | 总体 3 / 3；既有 `duplicate_omission` category 仍为 0 / 3 |
| `npm run eval:recommendation` | 未通过 | 0 / 4；失败集中在既有 `decisionRole / decisionLabel` 与部分 supporting evidence 断言 |
| targeted observability retest | 通过 | 1 file / 4 tests，包含 sample count 与 visible boundary 修正后的聚合断言 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 warnings |
| `npm run test` | 未全绿 | 229 / 235 test files、988 / 1003 tests 通过；剩余 15 个失败均为 Helm v2 runtime tests 无法连接默认本地 `127.0.0.1:3306` |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run e2e` | 阻断 | 脚本缺少 create database 权限后 fallback 到 `db:reset`，但当前 datasource 指向 shared `helm2026`，reset guard 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

未单独执行 `npm run db:reset`：当前 datasource 是 shared MySQL dev database，本轮不对共享库做破坏性 reset。

## 8. 下一阶段最该做的 5 件事

1. 增加 bounded retry executor / backoff / receipt，但保持默认人工确认。
2. 把 operator-review-required failure 接到正式 queue / owner assignment / acknowledgement。
3. 为 partial-failed batch 设计补偿或 replay-safe runbook。
4. 评估 `MemoryFact` normalized write key 的 DB-level unique guard 或 transaction upsert。
5. 将 commitment / blocker lane 纳入同一 write result 与 failure taxonomy。
