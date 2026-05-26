---
status: archived
owner: helm-core
created: 2026-04-21
review_after: 2026-10-18
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Memory Write Retry DB Idempotency, Source Proof And Bounded Executor Report v1

更新时间：2026-04-21
状态：MEM-WRITE-005H / 005I / 005J implemented

## 1. 本轮目标

完成 retry 链路的第一条可执行闭环，但继续保持 review-first 与最小权限：

1. `005H`：新增 DB-level idempotency guard，避免只依赖 `AuditLog` logical lock。
2. `005I`：新增 source reconstruction proof，证明 retry 写入可从当前 source 安全重建。
3. `005J`：新增 bounded retry executor，只在人工确认、source proof 与 DB lock 都成立时写一个 reconstructed `MemoryFact`。
4. 保留 `canExecuteAutomatically: false`，不把 retry 写成自动执行平面。

本轮仍不启动：

1. meeting memory pipeline rerun。
2. commitment / blocker / recommendation retry lane。
3. retry scheduler、后台队列或 UI action button。
4. canonical fact 自动重写、auto-promotion、auto-send 或承诺权限扩面。

## 2. 本轮改动

代码：

- `prisma/schema.prisma`
- `prisma/schema.sqlite.prisma`
- `prisma/migrations/20260421000100_memory_write_retry_lock/migration.sql`
  - 新增 `MemoryWriteRetryLock`，按 `workspaceId + idempotencyLockKey` 与 `workspaceId + writeKeyHash` 做 DB-level guard。
  - 保留 retry contract、receipt、attempt、source proof、executor payload、attempt/backoff、commit 状态与 hash proof 字段。
- `lib/memory/write-retry-idempotency-guard.ts`
  - 新增 lock reservation / update service。
  - 只允许 confirmed receipt、可用 source rebuild gate、未超 attempt limit 的 retry 进入 DB lock。
- `lib/memory/write-retry-source-reconstruction.ts`
  - 新增 `MEETING_NOTE` source proof。
  - 要求 source 存在、未在 failure audit 后被修改、具有可靠 note content、能重建唯一 candidate，并经过 duplicate / conflict dry run。
- `lib/memory/write-retry-bounded-executor.ts`
  - 新增 review-first executor。
  - 每次只消费一个 source proof，最多写一个 `MemoryFact`。
  - 遇到 DB lock / write hash conflict、backoff、attempt limit、source proof blocked、manual confirmation missing 时直接阻断。
- `lib/memory/write-retry-idempotency-guard.test.ts`
- `lib/memory/write-retry-source-reconstruction.test.ts`
- `lib/memory/write-retry-bounded-executor.test.ts`
  - 覆盖 DB lock、source proof、backoff、manual confirmation、single fact write、retryable failure 与 write hash collision。

文档：

- `PLANS.md`
- `WORKING-CONTEXT.md`
- `docs/README.md`
- `docs/product/HELM_MEMORY_REQUIREMENTS_UPGRADE_V1.md`
- `docs/reviews/HELM_NATIVE_MEMORY_EFFICIENCY_RELIABILITY_PLAN_V1.md`
- `docs/reviews/HELM_MEMORY_PHASE_0_3_FREEZE_REPORT_V1.md`

## 3. 已经完整成立

| 项 | 说明 |
| --- | --- |
| DB-level retry guard | `MemoryWriteRetryLock` 为 manually confirmed retry 提供数据库级 reservation 和 write hash guard |
| receipt / attempt gate | 005H 只接受 005F confirmed receipt 与 005G attempt/source gate，不把 audit 记录误当执行权限 |
| source reconstruction proof | 005I 能从 `MEETING_NOTE` 重建唯一 `CreateFactInput`，并阻断 missing / changed / unreliable / ambiguous / duplicate / conflict source |
| bounded executor | 005J 只写一个 reconstructed `MemoryFact`，不重跑 broader pipeline |
| backoff / attempt limit | executor 在写入前检查 bounded backoff 与 attempt limit |
| write hash conflict stop | source proof 写入 DB lock 时若撞到 `writeKeyHash` unique guard，executor 停在 idempotency block |
| no authority expansion | 所有 result 固定 `manualConfirmationRequired: true` 与 `canExecuteAutomatically: false` |

## 4. 已成形但仍需下一层

| 项 | 下一层 |
| --- | --- |
| owner workflow | 目前 executor 是 service contract；ack / SLA / resolution state 与 dedicated owner workflow surface 待补 |
| commitment / blocker retry | 当前只支持 reconstructed `MemoryFact` lane |
| transaction bundling | DB lock update 与 MemoryFact write 仍不是同一事务 wrapper；后续可做 narrower transactional seam |
| clean DB migration proof | schema validate 已通过；shared DB 仍受旧 failed migration / compatibility view blocker 影响，clean proof 继续用 `helm2026_ci_verify` 或独立 repair 任务 |
| source coverage | 005I 当前只支持 `MEETING_NOTE`，不支持 email / CRM / report source |

## 5. 刻意未做

| 项 | 原因 |
| --- | --- |
| 自动 retry scheduler | 自动调度会越过人工确认 contract |
| retry UI action button | 当前只冻结 service contract，避免 diagnostics 变成执行面 |
| meeting pipeline rerun | rerun 会重新触发 broader side effects，不符合 single fact bounded retry |
| commitment / recommendation 写入 | 本轮只修复 MemoryFact write reliability，不扩 judgement / commitment authority |
| source fallback 写入 | generic fallback content 不能冒充可靠 source proof |

## 6. 验证结果

已运行：

```bash
npm run test -- lib/memory/write-retry-idempotency-guard.test.ts lib/memory/write-retry-source-reconstruction.test.ts lib/memory/write-retry-bounded-executor.test.ts
npx prisma validate --schema prisma/schema.prisma
SQLITE_SOURCE_DATABASE_URL=file:./dev.db npx prisma validate --schema prisma/schema.sqlite.prisma
SQLITE_SOURCE_DATABASE_URL=file:./dev.db npm run db:generate
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
npm run test
npm run eval:memory
npm run eval:recommendation
```

结果：

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| targeted 005H/005I/005J tests | 通过 | 3 files / 18 tests |
| Prisma MySQL schema validate | 通过 | 仅保留既有 relationMode warning |
| Prisma SQLite schema validate | 通过 | 需要显式 `SQLITE_SOURCE_DATABASE_URL` |
| `npm run db:generate` | 通过 | MySQL Prisma Client 与 SQLite generated client 均生成成功 |
| `npm run typecheck` | 通过 | `next typegen` 与 `tsc --noEmit` 通过 |
| `npm run self-check` | 通过 | 11 / 11 |
| `npm run check:boundaries` | 通过 | boundary guard 通过 |
| `npm run lint` | 通过 | 0 errors；保留既有 5 warnings |
| `npm run build` | 通过 | production build 通过；保留既有 Turbopack NFT trace warning |
| `npm run quality:regression` | 通过 | 51 files / 180 tests |
| `npm run test` | 未全绿 | 236 / 242 files、1023 / 1038 tests 通过；15 个失败均为 Helm v2 runtime tests 连接不到本机 MySQL `127.0.0.1:3306` |
| `npm run eval:memory` | 通过但有风险 | total 3 / 3 passed；`duplicate_omission` category 仍 0 / 3 |
| `npm run eval:recommendation` | 未通过 | 0 / 4；既有 decisionRole / decisionLabel / evidence expectation drift |

## 7. 下一步

1. 进入 `MEM-FREEZE-007`，冻结 Phase 0-3 当前 truth。
2. 后续新切片优先做 Phase 4 review-safe distillation candidate。
3. 若继续 retry lane，应先做 owner workflow hardening，再考虑 commitment / blocker lane。
