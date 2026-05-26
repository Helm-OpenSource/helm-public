---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Retry Attempt Ledger And Source Rebuild Gate Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005G retry attempt ledger + source rebuild gate implemented

## 1. 本轮目标

完成 `MEM-WRITE-005G`：在 `MEM-WRITE-005F` 的 retry receipt persistence 与 owner-aware operator review surface 之上，增加 retry attempt ledger、logical idempotency lock read model 与 source rebuild gate 的第一层。

本轮只做：

1. 将 retry attempt / logical lock 从 receipt 之后推进到可持久化的 `AuditLog` attempt payload。
2. 为 diagnostics 增加 retry attempt ledger readout：attempt audit、unmatched attempt、invalid payload、missing receipt lock、receipt not confirmed、source rebuild required、duplicate idempotency conflict、attempt limit。
3. 为每个 receipt ledger item 生成 source rebuild gate，显式暴露缺失的 `CreateFactInput` material（如 `content`、`actor_context`、`normalized_value`）。
4. 保留 attempt limit 与 bounded backoff policy，并固定 `canExecuteAutomatically: false`。

本轮仍不启动：

1. 自动 retry executor。
2. retry API 或 UI action button。
3. DB-level idempotency lock table / unique guard。
4. source reconstruction proof 或自动重建完整 `CreateFactInput`。
5. canonical fact rewrite、auto-promotion、commitment authority 或 auto-send 扩面。

边界句：本切片只负责 retry attempt ledger 与 source rebuild gate；它记录人工 gate、logical lock 与 backoff 状态，不执行 retry，不自动重建事实输入，不改写 canonical facts，不生成自动发送/自动承诺能力，也不扩 recommendation / commitment authority。

## 2. 本轮改动

代码：

- `lib/memory/write-retry-attempt-ledger.ts`
  - 新增 `MEMORY_WRITE_RETRY_ATTEMPT_RECORDED` audit action constant。
  - 新增 `buildMemoryWriteRetrySourceRebuildGate`，把 receipt item 转成 source rebuild gate。
  - 新增 `buildMemoryWriteRetryAttemptPayload` 与 `recordMemoryWriteRetryAttempt`，只写 attempt audit，不触碰 `MemoryFact`，不执行 retry。
  - 新增 `buildMemoryWriteRetryAttemptLedger`，把 receipt ledger 与 attempt audits 合成 logical idempotency lock read model。
  - 识别 duplicate logical lock conflict、attempt limit reached、unmatched attempt audit 与 invalid attempt payload。
- `lib/observability/memory-metrics.service.ts`
  - 查询 `MEMORY_WRITE_RETRY_ATTEMPT_RECORDED` audit sample。
  - 在 `memoryWriteFailureReview` 下新增 `retryAttemptLedger`。
- `features/diagnostics/diagnostics-client.tsx`
  - diagnostics memory 区块新增 retry attempt gate、recent retry attempt locks、retry source rebuild gate 与 boundary 只读 readout。
- `lib/memory/write-retry-attempt-ledger.test.ts`
  - 覆盖 source rebuild required、receipt 未确认阻断、AuditLog-only attempt persistence、duplicate logical lock conflict、attempt limit 与 malformed / unmatched audit。
- `lib/observability/memory-metrics.test.ts`
  - 扩展 `memoryWriteFailureReview` 断言，覆盖 attempt ledger readout。

文档：

- `PLANS.md`
- `WORKING-CONTEXT.md`
- `docs/README.md`
- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_RETRY_RECEIPT_PERSISTENCE_AND_OWNER_AWARE_OPERATOR_REVIEW_SURFACE_REPORT_V1.md`
- `docs/reviews/HELM_MEMORY_WRITE_RETRY_ATTEMPT_LEDGER_AND_SOURCE_REBUILD_GATE_REPORT_V1.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| attempt persistence 入口 | `recordMemoryWriteRetryAttempt` 可把 attempt / logical lock 状态写入现有 `AuditLog` |
| attempt ledger readout | receipt ledger item 可与 persisted attempt audit 匹配，展示 latest attempt、attempt count、remaining attempt 与 backoff |
| source rebuild gate | confirmed receipt 之后仍会检查 `content / actor_context / normalized_value / source / idempotency_lock` 缺口 |
| logical idempotency conflict readout | 同一 lock 出现多个 `lock_reserved` audit 时，ledger 标记 `blocked_idempotency_conflict`，不展示为可执行 |
| orphan / malformed attempt visibility | unmatched attempt audit 与 invalid payload 会计数，避免 operator 误判 ledger 完整 |
| no-auto-execute boundary | attempt payload、ledger item、source gate 与 diagnostics readout 均固定 `canExecuteAutomatically: false` |
| targeted tests | 新增 attempt ledger test，并扩展 observability test |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| retry executor | 当前只有 attempt/read model；真实 executor、scheduler 和 transactional write path 仍未启动 |
| DB-level idempotency | 当前仍是 AuditLog-backed logical lock，不是 DB-level lock、unique guard 或 transactional upsert |
| source reconstruction | 当前 gate 只暴露缺失输入，不从 MeetingNote 自动重建完整 `CreateFactInput` |
| duplicate / conflict proof | 当前 gate 要求人工检查，尚未把 rebuild candidate 接到纯 duplicate/conflict plan proof |
| owner workflow | 当前只读显示 owner；acknowledgement、SLA、resolution state 仍待下一层 |
| broader write lanes | commitment / blocker 仍未纳入同一 retry attempt flow |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry | failure audit / receipt / attempt audit 仍不足以安全重放完整 fact write；必须先完成 source reconstruction proof 与 DB-level guard |
| retry API / UI action | 没有真实 executor 与 DB-level lock 前，暴露 action 会制造误执行入口 |
| 新表或 migration | 本轮使用现有 `AuditLog` 做 attempt ledger，避免把 schema 变更混入 read-model slice |
| 自动 source rebuild | Meeting source 可能发生变化，且 fallback draft 不能冒充可靠事实内容 |
| canonical fact rewrite | attempt ledger 只记录人工 gate 状态，不改写已确认事实 |
| recommendation / commitment 扩权 | attempt gate 不改变 judgement、ranking、approval 或 commitment authority |

## 6. 风险项

1. `AuditLog` 只能做 logical lock read model，不是数据库互斥锁；高并发 executor 前仍必须补 DB-level idempotency guard。
2. attempt ledger 仍基于最近 failure / receipt / attempt audit sample；超出窗口的 item 不会完整展示。
3. source rebuild gate 目前只依据 receipt item 与 missing inputs 判断，不证明 MeetingNote 仍存在或未被修改。
4. `confirmed_ready_for_executor` 仍只是进入 attempt gate 的人工确认状态，不代表当前系统已执行 retry。
5. diagnostics 信息密度继续升高，下一层应迁到更正式的 owner review workflow surface。

## 7. 验证结果

已运行：

```bash
npm run test -- lib/memory/write-retry-attempt-ledger.test.ts lib/memory/write-retry-receipt-ledger.test.ts lib/memory/write-failure-retry-contract.test.ts lib/memory/write-failure-operator-queue.test.ts lib/observability/memory-metrics.test.ts
npm run typecheck
git diff --check
rg -n "createMemoryFact|createMemoryFactsWithWriteResult" lib/memory/write-retry-attempt-ledger.ts
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
npm run test
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted attempt / retry tests | 通过 | 5 files / 21 tests，覆盖 attempt ledger、receipt ledger、retry contract、operator queue 与 observability overview |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `git diff --check` | 通过 | 未发现 whitespace / patch 格式问题 |
| no real write import scan | 通过 | `write-retry-attempt-ledger.ts` 没有引用 `createMemoryFact` 或 `createMemoryFactsWithWriteResult` |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | recommendation / commitment / authority 边界检查通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 个 unused-vars warnings |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run test` | 未全绿 | 233 / 239 test files、1005 / 1020 tests 通过；15 个失败均为 Helm v2 runtime tests 连接不到本机 MySQL `127.0.0.1:3306` |

未单独执行 `npm run db:reset` / `npm run e2e`：当前不对 shared MySQL dev database 做破坏性 reset，且本切片不新增 schema migration；Mem 线此前已用物理隔离的 `helm2026_ci_verify` 完成 migration / reset / seed proof。

## 8. 下一阶段最该做的 5 件事

1. 已由 `MEM-WRITE-005H/005I/005J` 补上 DB-level idempotency guard、source reconstruction proof 与 review-first bounded executor；见 `HELM_MEMORY_WRITE_RETRY_DB_IDEMPOTENCY_SOURCE_PROOF_AND_BOUNDED_EXECUTOR_REPORT_V1.md`。
2. 把 diagnostics 内的 retry receipt / attempt / executor readout 迁到更正式的 owner review workflow surface。
3. 将 commitment / blocker lane 纳入同一 write result、retry contract、receipt ledger 与 attempt gate。
4. 为 executor 继续补 clean DB migration-chain proof 与更窄 transaction seam。
5. 进入 Phase 4 review-safe distillation candidate。
