---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Dedupe Report v1

更新时间：2026-04-20
状态：MEM-WRITE-005 first write guard implemented; MEM-WRITE-005B batch failure semantics added; MEM-WRITE-005C readout added

## 1. 本轮目标

完成 `MEM-WRITE-005` 的第一层：让 meeting memory pipeline 在写入 `MemoryFact` 前具备 normalized duplicate guard 与 conflict candidate posture，避免同一 meeting note 重跑时无界增加重复 fact，同时不把事实冲突误吞成重复。

本轮仍不启动：

1. 完整 batch write / transaction upsert rewrite。
2. retryable / non-retryable / operator-review-required failure semantics。
3. commitment / blocker lane 的新 dedupe guard。
4. canonical fact rewrite、auto-promotion 或 distillation runtime。
5. recommendation ranking owner、commitment authority 或 auto-send 扩面。
6. shared dev DB reset。

## 2. 本轮改动

代码：

- `lib/memory/write-dedupe.ts`
  - 新增 `normalizeMemoryFactWriteText`、`buildMemoryFactWriteKey`、`buildMemoryFactConflictKey` 与 `buildMemoryFactWritePlan`。
  - duplicate write key 使用 `workspace + source + object + factType + normalized content/title`。
  - conflict key 使用同一 scope 下的 `normalizedValue` semantic key，用来发现同一 normalized fact key 下内容不同的候选冲突。
  - 输出 `createDrafts`、`duplicateSuppressions`、`conflictCandidates` 与 `memoryWriteGuard` summary。
- `lib/memory/meeting-memory-pipeline.service.ts`
  - meeting fact 写入前调用 `buildMemoryFactWritePlan`。
  - 只写入 `createDrafts`，把 suppress 与 conflict candidate summary 写入 audit / event metadata。
  - 返回 `memoryWriteGuard` summary 给调用方观察。
- `lib/memory/write-dedupe.test.ts`
  - 覆盖 normalized key、existing duplicate、in-batch duplicate、existing conflict 与 in-batch conflict。
- `prisma/schema.prisma`
- `prisma/migrations/20260420000200_memory_write_dedupe_index/migration.sql`
  - 为 `MemoryFact(workspaceId, sourceType, sourceId, objectType, objectId, factType)` 增加读取索引，支撑 source/object/fact guard 查询。

文档：

- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_DEDUPE_REPORT_V1.md`
- `docs/README.md`
- `PLANS.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| normalized write key | meeting `MemoryFact` writes 现在有稳定 duplicate key，不再只靠原始字符串完全相等 |
| existing duplicate suppression | 已存在同 source/object/fact/content 的事实会被 suppress，不再重复写入 |
| in-batch duplicate suppression | 同一 LLM / fallback extraction 批次内的重复 fact 会被 suppress |
| conflict candidate posture | 同一 normalized semantic key 但内容不同的 fact 不会被当成 duplicate 写入，会进入 conflict candidate metadata |
| audit visibility | `memoryWriteGuard`、`duplicateSuppressions`、`conflictCandidates` 已进入 memory audit / event metadata |
| first index pass | 已补 source/object/fact 组合索引，支撑 meeting note source 下的 bounded guard 查询 |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| batch write semantics | 后续 `MEM-WRITE-005B` 已补 fail-fast batch write result；仍不是完整事务化 bulk upsert |
| failure semantics | 后续 `MEM-WRITE-005B` 已补 retryable / non-retryable / operator-review-required 分类；自动 retry executor 仍待下一层 |
| operator review surface | failure audit 已进入 diagnostics 只读 readout；conflict candidate 的正式 reviewer queue 仍待下一层 |
| broader write lanes | commitment / blocker 仍沿用既有简单重复文本判断 |
| concurrency hardening | 当前是 application-level guard，没有新增唯一约束；并发双写仍需后续 DB-level 或 transactional guard 评估 |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| canonical fact rewrite | duplicate guard 不能自动改写已确认事实 |
| auto-promotion / distillation runtime | 继续保留 review-first posture |
| recommendation ranking 改写 | memory write guard 只影响写入候选，不接管 judgement / ranking owner |
| commitment authority 扩面 | conflict candidate 不等于承诺、合同或官方 follow-through |
| shared MySQL reset | 当前 datasource 指向 shared `helm2026`，不能默认执行破坏性 reset |

## 6. 风险项

1. `normalizedValue` 只有在 extraction 提供 semantic key 时才能形成 conflict posture；缺失时只能使用 content/title duplicate guard。
2. application-level duplicate guard 在高并发重复请求下仍可能存在 race，需要后续评估唯一约束或 transactional write。
3. conflict candidate 当前只进入 audit metadata；如果没有 reviewer readout，operator 仍需要通过 event/audit trace 查找。
4. commitment / blocker lane 暂未进入同一 normalized guard，Phase 3 不能写成完整 memory write-back 已完成。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/write-dedupe.test.ts lib/memory/retrieval-pack-adapter.test.ts lib/observability/memory-metrics.test.ts lib/evals/memory-evals.test.ts
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
| targeted memory tests | 通过 | 4 files / 12 tests，通过 write guard、retrieval pack adapter、observability 与 memory eval helper |
| `prisma validate` | 通过 | schema valid；保留既有 `relationMode = "prisma"` index warnings 与 Prisma config deprecation warning |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run eval:memory` | 通过 | 总体 3 / 3；`duplicate_omission` category 仍为 0 / 3，说明 runtime write guard 第一层已补，但 golden eval duplicate 口径仍待下一层升级 |
| `npm run eval:recommendation` | 未通过 | sandbox 内先被 `tsx` IPC pipe EPERM 拦截；按本地权限重跑后 0 / 4，失败集中在既有 `decisionRole / decisionLabel` 与部分 supporting evidence 断言 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 warnings |
| `npm run test` | 未全绿 | 227 / 233 test files、981 / 996 tests 通过；剩余 15 个失败均为 Helm v2 runtime DB tests 无法连接默认本地 `127.0.0.1:3306` |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run e2e` | 阻断 | 脚本缺少 create database 权限后 fallback 到 `db:reset`，但当前 datasource 指向 shared `helm2026`，仓库 reset guard 拒绝 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |

未单独执行 `npm run db:reset`：当前 datasource 是 shared MySQL dev database，本轮不对共享库做破坏性 reset。

## 8. 下一阶段最该做的 5 件事

1. 把 meeting fact write guard 的 conflict candidate 接到 reviewer / operator readout。
2. 在 `MEM-WRITE-005B` 第一层 batch result 之后，继续设计事务化 bulk upsert 或 DB-level concurrency guard。
3. 在 retryable / non-retryable / operator-review-required classification 与 diagnostics readout 之后，补自动 retry executor 与正式 operator queue。
4. 评估 commitment / blocker 是否需要同一 normalized write guard。
5. 在 staging / CI temp MySQL 上 apply MEM-QUERY-003 与 MEM-WRITE-005 migrations，并补 explain / lock 风险记录。
